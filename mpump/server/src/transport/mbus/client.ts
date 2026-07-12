/**
 * mbus client — publish and subscribe to live audio between browser tabs.
 *
 * Signaling rides the link-bridge WebSocket (ws://localhost:19876) next to
 * Ableton Link traffic; audio flows tab-to-tab over RTCPeerConnection with
 * host candidates only (no STUN/TURN — this is a localhost/LAN system).
 *
 * Dependency-free and framework-agnostic. WebSocket and RTCPeerConnection
 * construction are injectable so every protocol flow is unit-testable
 * without a browser. Connection lifecycle (URL sweep, retry, silent
 * absence) follows the house style of mpump's and mfx's Link clients:
 * the tool must stay fully usable with no bridge running.
 */

import {
  DEFAULT_WS_URLS,
  outbound,
  parseServerMessage,
  parseSignalPayload,
  type ServerMessage,
  type SignalPayload,
  type SourceInfo,
} from './protocol.js'

/** Bridge connection state. */
export type BridgeState =
  | 'idle' // never connected, or disconnect() called
  | 'connecting' // sweeping URLs / awaiting mbus/welcome
  | 'connected' // welcome received; mbus is live
  | 'bridge-too-old' // bridge reachable but no welcome within timeout; still retrying
  | 'disconnected' // connection lost (retrying if autoRetry)

export type PublicationState = 'announcing' | 'announced' | 'stopped'
export type SubscriptionState = 'connecting' | 'live' | 'failed' | 'closed'

/** A published audio output. Survives reconnects: re-announced automatically
 *  (with a fresh sourceId — ids never survive a reconnect, per protocol). */
export interface Publication {
  readonly name: string
  /** Bridge-assigned id; null until announced, refreshed after reconnect. */
  getSourceId(): string | null
  getState(): PublicationState
  /** Live peer connections currently being fed. */
  subscriberCount(): number
  onState(cb: (s: PublicationState) => void): () => void
  stop(): void
}

/** A subscription to a remote source. `node` is a stable GainNode created
 *  synchronously; remote audio is wired into it when the connection goes
 *  live, so callers can patch it into their graph immediately. */
export interface Subscription {
  readonly sourceId: string
  readonly node: AudioNode
  getState(): SubscriptionState
  onState(cb: (s: SubscriptionState) => void): () => void
  close(): void
}

/** Minimal WebSocket surface used by the client (injectable for tests). */
export interface WebSocketLike {
  readyState: number
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((e: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
}

/** Minimal RTCPeerConnection surface used by the client (injectable). */
export interface PeerConnectionLike {
  addTrack(track: MediaStreamTrack, stream: MediaStream): unknown
  createOffer(): Promise<RTCSessionDescriptionInit>
  createAnswer(): Promise<RTCSessionDescriptionInit>
  setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void>
  setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void>
  addIceCandidate(candidate?: RTCIceCandidateInit): Promise<void>
  close(): void
  connectionState: string
  onicecandidate: ((e: { candidate: { toJSON(): RTCIceCandidateInit } | null }) => void) | null
  ontrack: ((e: { track: MediaStreamTrack; streams: readonly MediaStream[] }) => void) | null
  onconnectionstatechange: (() => void) | null
}

export interface MbusClientOptions {
  /** WebSocket URLs to sweep, in order. Default: the shared loopback list. */
  urls?: readonly string[]
  /** How long to wait for mbus/welcome before declaring the bridge too old. */
  helloTimeoutMs?: number
  /** Reconnect on drop / keep trying while no bridge is running. */
  autoRetry?: boolean
  retryMs?: number
  /** RTC configuration. Default: no ICE servers (host candidates only). */
  rtcConfig?: RTCConfiguration
  /** Test seams. Defaults construct real WebSocket / RTCPeerConnection. */
  webSocketFactory?: (url: string) => WebSocketLike
  peerConnectionFactory?: (config: RTCConfiguration) => PeerConnectionLike
}

export interface MbusClient {
  connect(): void
  disconnect(): void
  getState(): BridgeState
  /** Our bridge-assigned client id (null until welcomed). */
  getClientId(): string | null
  /** Current source directory (latest snapshot; empty until welcomed). */
  getSources(): SourceInfo[]
  onState(cb: (s: BridgeState) => void): () => void
  onSources(cb: (s: SourceInfo[]) => void): () => void
  /** Publish `node`'s audio under `name`. Works offline: announced when
   *  (re)connected. One publication per output; call stop() to withdraw. */
  publishOutput(node: AudioNode, name: string): Publication
  /** Receive a remote source into `ctx`. One active subscription per
   *  sourceId per client; throws on a duplicate. */
  subscribe(sourceId: string, ctx: AudioContext): Subscription
}

const HELLO_TIMEOUT_MS = 2000
const RETRY_MS = 5000

/** Opus fmtp params requested on every local description. Receiver-directed:
 *  each side asks its peer for full-band stereo at the Opus ceiling with CBR
 *  (localhost/LAN has the bandwidth; CBR avoids bitrate-adaptation artefacts).
 *  Applied to both the publisher's offer and the subscriber's answer so the
 *  send direction that matters (publisher → subscriber) is always covered. */
const OPUS_TUNING: ReadonlyArray<readonly [string, string]> = [
  ['maxaveragebitrate', '510000'],
  ['stereo', '1'],
  ['sprop-stereo', '1'],
  ['cbr', '1'],
]

/**
 * Append the Opus tuning params to an SDP's opus fmtp line(s). Pure and
 * idempotent: params already present (any value) are never overridden, an
 * fmtp line is created after the rtpmap when missing, non-opus payloads and
 * SDP without opus are untouched, and CRLF/LF line endings are preserved.
 */
export function tuneOpusSdp(sdp: string): string {
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n'
  const lines = sdp.split(eol)
  const opusPts = new Set<string>()
  for (const line of lines) {
    const m = /^a=rtpmap:(\d+)\s+opus\//i.exec(line)
    if (m?.[1]) opusPts.add(m[1])
  }
  if (opusPts.size === 0) return sdp

  const out: string[] = []
  for (const line of lines) {
    const m = /^a=fmtp:(\d+)\s+(.*)$/.exec(line)
    if (m?.[1] && m[2] !== undefined && opusPts.has(m[1])) {
      const present = new Set(m[2].split(';').map((p) => p.split('=')[0]?.trim()))
      const missing = OPUS_TUNING.filter(([k]) => !present.has(k))
      out.push(missing.length === 0 ? line : `${line};${missing.map(([k, v]) => `${k}=${v}`).join(';')}`)
      continue
    }
    out.push(line)
    const r = /^a=rtpmap:(\d+)\s+opus\//i.exec(line)
    if (r?.[1] && !hasFmtpLater(lines, r[1])) {
      out.push(`a=fmtp:${r[1]} ${OPUS_TUNING.map(([k, v]) => `${k}=${v}`).join(';')}`)
    }
  }
  return out.join(eol)
}

function hasFmtpLater(lines: readonly string[], pt: string): boolean {
  return lines.some((l) => l.startsWith(`a=fmtp:${pt} `) || l.startsWith(`a=fmtp:${pt}\t`))
}

/** Per-peer-connection ICE state. Inbound candidates are buffered here until
 *  the pc's remoteDescription is set, then flushed in arrival order — a
 *  candidate applied before setRemoteDescription is silently dropped by the
 *  browser, which used to strand subscriptions intermittently. Each record is
 *  a distinct instance: replacing a pc discards the old record (and its
 *  buffered candidates), so stale candidates never reach the replacement. */
interface PcRecord {
  pc: PeerConnectionLike
  /** Buffered inbound candidates (null = end-of-candidates), FIFO. */
  pendingIce: Array<RTCIceCandidateInit | null>
  /** True once setRemoteDescription has resolved for this pc. */
  remoteReady: boolean
}

interface PubRecord extends Publication {
  node: AudioNode
  dest: MediaStreamAudioDestinationNode | null
  sourceId: string | null
  state: PublicationState
  listeners: Array<(s: PublicationState) => void>
  /** Peer connections keyed by subscriber clientId. */
  pcs: Map<string, PcRecord>
}

interface SubRecord extends Subscription {
  ctx: AudioContext
  gain: GainNode
  pc: PeerConnectionLike | null
  peerClientId: string | null
  state: SubscriptionState
  listeners: Array<(s: SubscriptionState) => void>
  /** Muted media-element sink required by Chromium (crbug.com/121673). */
  audioEl: HTMLAudioElement | null
  /** Media-source node feeding the gain node; disconnected on teardown. */
  mediaSrc: MediaStreamAudioSourceNode | null
  /** Remote track wired into the gain node (ontrack fired). */
  hasTrack: boolean
  /** Buffered inbound candidates (null = end-of-candidates), FIFO. */
  pendingIce: Array<RTCIceCandidateInit | null>
  /** True once setRemoteDescription has resolved for the current pc. */
  remoteReady: boolean
  /** Monotonic pc generation; a teardown/replacement bumps it so any
   *  in-flight async callback for the old pc can detect it no longer owns
   *  the subscription and bow out. */
  pcGen: number
}

const WS_OPEN = 1

export function createMbusClient(options: MbusClientOptions = {}): MbusClient {
  const urls = options.urls ?? DEFAULT_WS_URLS
  const helloTimeoutMs = options.helloTimeoutMs ?? HELLO_TIMEOUT_MS
  const autoRetry = options.autoRetry ?? true
  const retryMs = options.retryMs ?? RETRY_MS
  const rtcConfig = options.rtcConfig ?? { iceServers: [] }
  const makeSocket =
    options.webSocketFactory ??
    ((url: string) => new WebSocket(url) as unknown as WebSocketLike)
  const makePc =
    options.peerConnectionFactory ??
    ((config: RTCConfiguration) => new RTCPeerConnection(config) as unknown as PeerConnectionLike)

  let ws: WebSocketLike | null = null
  let state: BridgeState = 'idle'
  let clientId: string | null = null
  let sources: SourceInfo[] = []
  let enabled = false
  let urlIdx = 0
  let attempted = 0
  let helloTimer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const stateListeners: Array<(s: BridgeState) => void> = []
  const sourceListeners: Array<(s: SourceInfo[]) => void> = []
  const publications: PubRecord[] = []
  /** Publications awaiting mbus/announced, FIFO (protocol guarantees order). */
  const announceQueue: PubRecord[] = []
  const subscriptions = new Map<string, SubRecord>()

  function setState(next: BridgeState): void {
    if (state === next) return
    state = next
    for (const fn of [...stateListeners]) fn(state)
  }

  function setSources(next: SourceInfo[], detectVanish = true): void {
    sources = next
    for (const fn of [...sourceListeners]) fn(sources)
    // A source vanishing from a *live* directory update is how subscribers
    // learn the publisher died (no peer-gone message in v1). But an empty
    // snapshot pushed during a transient WS drop must NOT be read this way —
    // that would delete recoverable subscription intent — so teardown paths
    // pass detectVanish=false.
    if (!detectVanish) return
    const alive = new Set(sources.map((s) => s.sourceId))
    for (const sub of [...subscriptions.values()]) {
      if (!alive.has(sub.sourceId)) failSubscription(sub)
    }
  }

  function send(json: string): void {
    if (ws && ws.readyState === WS_OPEN) ws.send(json)
  }

  function clearTimers(): void {
    if (helloTimer) {
      clearTimeout(helloTimer)
      helloTimer = null
    }
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function scheduleRetry(): void {
    // Keep the informative bridge-too-old state across the retry wait rather
    // than degrading it to a generic 'disconnected'.
    if (!autoRetry || !enabled) {
      if (state !== 'bridge-too-old') setState('disconnected')
      return
    }
    if (retryTimer) clearTimeout(retryTimer)
    if (state !== 'bridge-too-old') setState('disconnected')
    retryTimer = setTimeout(open, retryMs)
  }

  function tryNextUrl(): void {
    attempted++
    urlIdx = (urlIdx + 1) % urls.length
    if (attempted < urls.length) open()
    else {
      attempted = 0
      scheduleRetry()
    }
  }

  function open(): void {
    if (ws || !enabled) return
    if (typeof WebSocket === 'undefined' && !options.webSocketFactory) {
      scheduleRetry()
      return
    }
    setState('connecting')
    let socket: WebSocketLike
    try {
      socket = makeSocket(urls[urlIdx] ?? urls[0] ?? '')
    } catch {
      tryNextUrl()
      return
    }
    ws = socket
    let opened = false

    socket.onopen = () => {
      opened = true
      attempted = 0
      send(outbound.hello())
      // No welcome within the window ⇒ a pre-mbus bridge silently dropped our
      // hello. Report it, but keep retrying: background-tab timer throttling
      // can process this timeout after a welcome that already arrived on the
      // wire (observed on macOS Chrome), so treating it as terminal strands a
      // healthy page on a false positive. A genuinely old bridge just
      // re-reports on each retry.
      helloTimer = setTimeout(() => {
        helloTimer = null
        setState('bridge-too-old')
        socket.close()
      }, helloTimeoutMs)
    }

    socket.onmessage = (e) => {
      const msg = parseServerMessage(e.data)
      if (msg) handleServerMessage(msg)
    }

    socket.onclose = () => {
      ws = null
      if (helloTimer) {
        clearTimeout(helloTimer)
        helloTimer = null
      }
      dropPeerConnections()
      if (!enabled) return // manual disconnect or bridge-too-old: state already set
      if (opened) scheduleRetry()
      else tryNextUrl()
    }

    socket.onerror = () => {
      try {
        socket.close()
      } catch {
        /* may not be open yet */
      }
    }
  }

  /** Close every peer connection; ids and RTC state never survive a drop.
   *  Subscription *intent* is preserved: each sub is torn down to bare metal
   *  and reset to 'connecting' (kept in the map, gain node intact) so the
   *  welcome re-request loop transparently rewires it into the same node. */
  function dropPeerConnections(): void {
    clientId = null
    announceQueue.length = 0
    for (const pub of publications) {
      for (const rec of pub.pcs.values()) rec.pc.close()
      pub.pcs.clear()
      pub.sourceId = null
      if (pub.state === 'announced') setPubState(pub, 'announcing')
    }
    for (const sub of [...subscriptions.values()]) resetSubForReconnect(sub)
    // detectVanish=false: an empty directory here is the drop itself, not a
    // signal that every publisher died — intent must survive to reconnect.
    setSources([], false)
  }

  function handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome': {
        if (helloTimer) {
          clearTimeout(helloTimer)
          helloTimer = null
        }
        clientId = msg.clientId
        setState('connected')
        setSources(msg.sources)
        // (Re-)announce every active publication, in creation order.
        for (const pub of publications) {
          if (pub.state !== 'stopped') announcePub(pub)
        }
        // Fire requests for subscriptions made while we were offline.
        for (const sub of subscriptions.values()) {
          if (sub.state === 'connecting' && !sub.pc) send(outbound.request(sub.sourceId))
        }
        break
      }
      case 'announced': {
        const pub = announceQueue.shift()
        if (!pub) break
        pub.sourceId = msg.sourceId
        setPubState(pub, 'announced')
        break
      }
      case 'sources':
        setSources(msg.sources)
        break
      case 'request':
        void handleRequest(msg.sourceId, msg.from)
        break
      case 'signal': {
        const payload = parseSignalPayload(msg.payload)
        if (payload) void handleSignal(msg.from, payload)
        break
      }
      case 'error':
        // Advisory (see protocol.md); flows that depend on a reply already
        // handle its absence, so errors are informational here.
        break
    }
  }

  // ── Publisher side ──────────────────────────────────────────────────────

  function setPubState(pub: PubRecord, next: PublicationState): void {
    if (pub.state === next) return
    pub.state = next
    for (const fn of [...pub.listeners]) fn(next)
  }

  function announcePub(pub: PubRecord): void {
    announceQueue.push(pub)
    send(outbound.announce(pub.name))
  }

  /** Flush a publisher pc's buffered candidates in arrival order once its
   *  remoteDescription (the answer) is set. Bails if the pc was superseded. */
  async function flushPubIce(pub: PubRecord, from: string, rec: PcRecord): Promise<void> {
    const pending = rec.pendingIce
    rec.pendingIce = []
    for (const c of pending) {
      if (pub.pcs.get(from) !== rec) return
      try {
        await rec.pc.addIceCandidate(c ?? undefined)
      } catch {
        /* stale candidate — ignore */
      }
    }
  }

  /** A subscriber asked for one of our sources: offer it audio. */
  async function handleRequest(sourceId: string, from: string): Promise<void> {
    const pub = publications.find((p) => p.sourceId === sourceId && p.state === 'announced')
    if (!pub) return
    // Lazily fan the published node into a MediaStream (one per publication,
    // shared by all subscribers). createMediaStreamDestination lives on
    // AudioContext; published nodes come from one.
    if (!pub.dest) {
      pub.dest = (pub.node.context as AudioContext).createMediaStreamDestination()
      pub.node.connect(pub.dest)
    }
    // A re-request replaces the old connection. Delete before close so the
    // old pc's close-triggered connectionstatechange can't delete the new
    // record we're about to store under the same key.
    const prior = pub.pcs.get(from)
    if (prior) {
      pub.pcs.delete(from)
      prior.pc.close()
    }
    const pc = makePc(rtcConfig)
    const rec: PcRecord = { pc, pendingIce: [], remoteReady: false }
    pub.pcs.set(from, rec)
    for (const track of pub.dest.stream.getAudioTracks()) {
      pc.addTrack(track, pub.dest.stream)
    }
    pc.onicecandidate = (e) => {
      if (pub.pcs.get(from) !== rec) return // superseded by a newer pc
      send(outbound.signal(from, {
        kind: 'ice',
        sourceId,
        candidate: e.candidate ? e.candidate.toJSON() : null,
      }))
    }
    pc.onconnectionstatechange = () => {
      if (pub.pcs.get(from) !== rec) return // a later callback must not delete a newer pc
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pub.pcs.delete(from)
      }
    }
    try {
      const offer = await pc.createOffer()
      if (pub.pcs.get(from) !== rec) {
        pc.close()
        return
      }
      const offerSdp = tuneOpusSdp(offer.sdp ?? '')
      await pc.setLocalDescription({ type: offer.type, sdp: offerSdp })
      if (pub.pcs.get(from) !== rec) {
        pc.close()
        return
      }
      send(outbound.signal(from, { kind: 'offer', sourceId, sdp: offerSdp }))
    } catch {
      if (pub.pcs.get(from) === rec) pub.pcs.delete(from)
      pc.close()
    }
  }

  // ── Subscriber side ─────────────────────────────────────────────────────

  function setSubState(sub: SubRecord, next: SubscriptionState): void {
    if (sub.state === next) return
    sub.state = next
    for (const fn of [...sub.listeners]) fn(next)
  }

  /** Tear the RTC/media half of a subscription down to nothing, exactly once.
   *  Idempotent (safe to call from any teardown path) and bumps pcGen so any
   *  in-flight async callback for the old pc detects it no longer owns the
   *  subscription. Leaves the gain node and the map entry untouched. */
  function teardownSubMedia(sub: SubRecord): void {
    sub.pcGen++
    if (sub.pc) {
      sub.pc.close()
      sub.pc = null
    }
    if (sub.mediaSrc) {
      try {
        sub.mediaSrc.disconnect()
      } catch {
        /* graph may already be torn down */
      }
      sub.mediaSrc = null
    }
    if (sub.audioEl) {
      try {
        sub.audioEl.srcObject = null
      } catch {
        /* element may already be released */
      }
      sub.audioEl = null
    }
    sub.peerClientId = null
    sub.hasTrack = false
    sub.remoteReady = false
    sub.pendingIce = []
  }

  /** Terminal failure: unrecoverable, drops intent and notifies. */
  function failSubscription(sub: SubRecord): void {
    if (sub.state === 'closed' || sub.state === 'failed') return
    teardownSubMedia(sub)
    subscriptions.delete(sub.sourceId)
    setSubState(sub, 'failed')
  }

  /** Transient drop: preserve intent. Tear down the RTC/media half but keep
   *  the sub (and its gain node) in the map, reset to 'connecting' so welcome
   *  re-requests it into the same node. */
  function resetSubForReconnect(sub: SubRecord): void {
    if (sub.state === 'closed' || sub.state === 'failed') return
    teardownSubMedia(sub)
    setSubState(sub, 'connecting')
  }

  /** Flush buffered candidates in arrival order once remoteReady. Bails if the
   *  pc was superseded (gen changed) mid-flush. */
  async function flushSubIce(sub: SubRecord, gen: number): Promise<void> {
    const pending = sub.pendingIce
    sub.pendingIce = []
    for (const c of pending) {
      if (sub.pcGen !== gen || !sub.pc) return
      try {
        await sub.pc.addIceCandidate(c ?? undefined)
      } catch {
        /* stale candidate — ignore */
      }
    }
  }

  function attachRemoteTrack(sub: SubRecord, track: MediaStreamTrack, streams: readonly MediaStream[]): void {
    const stream =
      streams[0] ?? (typeof MediaStream !== 'undefined' ? new MediaStream([track]) : null)
    if (!stream) return
    // Replacement safety: drop any prior media-source node before rewiring so
    // the graph never accumulates orphaned MediaStreamAudioSourceNodes.
    if (sub.mediaSrc) {
      try {
        sub.mediaSrc.disconnect()
      } catch {
        /* graph may already be torn down */
      }
      sub.mediaSrc = null
    }
    const src = sub.ctx.createMediaStreamSource(stream)
    src.connect(sub.gain)
    sub.mediaSrc = src
    // Chromium quirk: audio from a remote WebRTC MediaStream is silent
    // through Web Audio unless the stream also feeds a media element
    // (crbug.com/121673). A muted element satisfies it; muted playback is
    // exempt from autoplay gesture rules.
    if (typeof Audio !== 'undefined') {
      if (sub.audioEl) {
        try {
          sub.audioEl.srcObject = null
        } catch {
          /* element may already be released */
        }
      }
      const el = new Audio()
      el.muted = true
      el.srcObject = stream
      void el.play().catch(() => {})
      sub.audioEl = el
    }
    // 'live' needs media AND transport: ontrack fires at SDP time, but ICE
    // can still fail after it (e.g. incognito/firewalled loopback), and a
    // premature 'live' badge hides exactly that failure.
    sub.hasTrack = true
    if (sub.pc?.connectionState === 'connected') setSubState(sub, 'live')
  }

  /** SDP/ICE relayed from another client (routing key: payload.sourceId). */
  async function handleSignal(from: string, payload: SignalPayload): Promise<void> {
    if (payload.kind === 'answer') {
      const pub = publications.find((p) => p.sourceId === payload.sourceId)
      const rec = pub?.pcs.get(from)
      if (rec) {
        try {
          await rec.pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
          if (pub?.pcs.get(from) !== rec) return // superseded during the await
          rec.remoteReady = true
          await flushPubIce(pub, from, rec)
        } catch {
          if (pub?.pcs.get(from) === rec) pub.pcs.delete(from)
          rec.pc.close()
        }
      }
      return
    }

    const sub = subscriptions.get(payload.sourceId)
    if (payload.kind === 'offer') {
      if (!sub || sub.pc) return // no such subscription, or already offered
      const pc = makePc(rtcConfig)
      const gen = ++sub.pcGen
      sub.pc = pc
      sub.peerClientId = from
      sub.remoteReady = false
      sub.pendingIce = []
      pc.ontrack = (e) => {
        if (sub.pcGen !== gen) return // superseded pc
        attachRemoteTrack(sub, e.track, e.streams)
      }
      pc.onicecandidate = (e) => {
        if (sub.pcGen !== gen) return
        send(outbound.signal(from, {
          kind: 'ice',
          sourceId: payload.sourceId,
          candidate: e.candidate ? e.candidate.toJSON() : null,
        }))
      }
      pc.onconnectionstatechange = () => {
        if (sub.pcGen !== gen) return // a later callback must not touch a newer pc
        if (pc.connectionState === 'failed') failSubscription(sub)
        else if (pc.connectionState === 'connected' && sub.hasTrack) setSubState(sub, 'live')
      }
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp })
        if (sub.pcGen !== gen) {
          pc.close()
          return
        }
        // Remote description is set: any buffered candidates can now apply,
        // in arrival order, before we build/answer.
        sub.remoteReady = true
        await flushSubIce(sub, gen)
        if (sub.pcGen !== gen) {
          pc.close()
          return
        }
        const answer = await pc.createAnswer()
        if (sub.pcGen !== gen) {
          pc.close()
          return
        }
        const answerSdp = tuneOpusSdp(answer.sdp ?? '')
        await pc.setLocalDescription({ type: answer.type, sdp: answerSdp })
        if (sub.pcGen !== gen) {
          pc.close()
          return
        }
        send(outbound.signal(from, { kind: 'answer', sourceId: payload.sourceId, sdp: answerSdp }))
      } catch {
        if (sub.pcGen === gen) failSubscription(sub)
        else pc.close()
      }
      return
    }

    // kind === 'ice' — route to whichever side owns this exchange. A null
    // candidate is end-of-candidates (addIceCandidate with no argument).
    // Until the owning pc's remoteDescription is set, buffer in arrival order;
    // applying a candidate too early makes the browser silently drop it.
    const pubRec = publications.find((p) => p.sourceId === payload.sourceId)?.pcs.get(from)
    if (pubRec) {
      if (pubRec.remoteReady) {
        try {
          await pubRec.pc.addIceCandidate(payload.candidate ?? undefined)
        } catch {
          /* stale candidate after close — ignore */
        }
      } else {
        pubRec.pendingIce.push(payload.candidate)
      }
      return
    }
    if (sub && sub.peerClientId === from && sub.pc) {
      if (sub.remoteReady) {
        try {
          await sub.pc.addIceCandidate(payload.candidate ?? undefined)
        } catch {
          /* stale candidate after close — ignore */
        }
      } else {
        sub.pendingIce.push(payload.candidate)
      }
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  return {
    connect(): void {
      if (enabled) return
      enabled = true
      attempted = 0
      urlIdx = 0
      open()
    },

    disconnect(): void {
      enabled = false
      clearTimers()
      if (ws) {
        const socket = ws
        ws = null
        try {
          socket.close()
        } catch {
          /* already closing */
        }
      }
      dropPeerConnections()
      setState('idle')
    },

    getState: () => state,
    getClientId: () => clientId,
    getSources: () => sources,

    onState(cb: (s: BridgeState) => void): () => void {
      stateListeners.push(cb)
      return () => {
        const i = stateListeners.indexOf(cb)
        if (i >= 0) stateListeners.splice(i, 1)
      }
    },

    onSources(cb: (s: SourceInfo[]) => void): () => void {
      sourceListeners.push(cb)
      return () => {
        const i = sourceListeners.indexOf(cb)
        if (i >= 0) sourceListeners.splice(i, 1)
      }
    },

    publishOutput(node: AudioNode, name: string): Publication {
      const pub: PubRecord = {
        name,
        node,
        dest: null,
        sourceId: null,
        state: 'announcing',
        listeners: [],
        pcs: new Map(),
        getSourceId: () => pub.sourceId,
        getState: () => pub.state,
        subscriberCount: () => pub.pcs.size,
        onState(cb) {
          pub.listeners.push(cb)
          return () => {
            const i = pub.listeners.indexOf(cb)
            if (i >= 0) pub.listeners.splice(i, 1)
          }
        },
        stop() {
          if (pub.state === 'stopped') return
          if (pub.sourceId) send(outbound.unannounce(pub.sourceId))
          for (const rec of pub.pcs.values()) rec.pc.close()
          pub.pcs.clear()
          if (pub.dest) {
            try {
              pub.node.disconnect(pub.dest)
            } catch {
              /* graph may already be torn down */
            }
            pub.dest = null
          }
          const i = publications.indexOf(pub)
          if (i >= 0) publications.splice(i, 1)
          const qi = announceQueue.indexOf(pub)
          if (qi >= 0) announceQueue.splice(qi, 1)
          pub.sourceId = null
          setPubState(pub, 'stopped')
        },
      }
      publications.push(pub)
      if (state === 'connected') announcePub(pub)
      return pub
    },

    subscribe(sourceId: string, ctx: AudioContext): Subscription {
      if (subscriptions.has(sourceId)) {
        throw new Error(`already subscribed to ${sourceId}`)
      }
      const sub: SubRecord = {
        sourceId,
        ctx,
        gain: ctx.createGain(),
        pc: null,
        peerClientId: null,
        state: 'connecting',
        listeners: [],
        audioEl: null,
        mediaSrc: null,
        hasTrack: false,
        pendingIce: [],
        remoteReady: false,
        pcGen: 0,
        get node() {
          return sub.gain
        },
        getState: () => sub.state,
        onState(cb) {
          sub.listeners.push(cb)
          return () => {
            const i = sub.listeners.indexOf(cb)
            if (i >= 0) sub.listeners.splice(i, 1)
          }
        },
        close() {
          // Manual close is terminal and never resurrected: even mid-drop it
          // removes intent so a later welcome won't re-request it.
          if (sub.state === 'closed') return
          teardownSubMedia(sub)
          subscriptions.delete(sub.sourceId)
          setSubState(sub, 'closed')
        },
      }
      subscriptions.set(sourceId, sub)
      if (state === 'connected') send(outbound.request(sourceId))
      return sub
    },
  }
}
