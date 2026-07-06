/**
 * mbus wire protocol v1 — types and inbound-message validation.
 *
 * See mbus/docs/protocol.md for the spec. Everything in this file is pure
 * (no sockets, no timers, no DOM) so the trust boundary for bridge traffic
 * is unit-testable, following the sanitizer approach in mfx's linkBridge
 * client. Inbound messages come from a local process, but a local process
 * can still be buggy or hostile — wrong-shaped messages are dropped, never
 * thrown on.
 */

/** Protocol version this client speaks. */
export const MBUS_VERSION = 1

/**
 * Loopback URL variants, tried in order. `localhost` must come first:
 * Firefox blocks insecure ws:// to IP literals (127.0.0.1, [::1]) from an
 * HTTPS page as mixed content and only exempts the `localhost` hostname
 * (Firefox bug 1376309). Chrome accepts all three; Safari blocks every
 * loopback ws:// from HTTPS. Same list and reasoning as mpump's Link client.
 */
export const DEFAULT_WS_URLS: readonly string[] = [
  'ws://localhost:19876',
  'ws://127.0.0.1:19876',
  'ws://[::1]:19876',
]

/** One entry in the bridge's source directory. */
export interface SourceInfo {
  sourceId: string
  name: string
  clientId: string
}

/** Opaque-to-the-bridge payload relayed via mbus/signal (client contract). */
export type SignalPayload =
  | { kind: 'offer'; sourceId: string; sdp: string }
  | { kind: 'answer'; sourceId: string; sdp: string }
  | { kind: 'ice'; sourceId: string; candidate: RTCIceCandidateInit | null }

/** Bridge → client messages, after validation. */
export type ServerMessage =
  | { type: 'welcome'; clientId: string; mbus: number; sources: SourceInfo[] }
  | { type: 'announced'; sourceId: string; name: string }
  | { type: 'sources'; sources: SourceInfo[] }
  | { type: 'request'; sourceId: string; from: string }
  | { type: 'signal'; from: string; payload: unknown }
  | { type: 'error'; code: string; message: string; re: string }

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** Validate a directory array; entries with missing/wrong fields are dropped. */
function sanitizeSources(v: unknown): SourceInfo[] {
  if (!Array.isArray(v)) return []
  const out: SourceInfo[] = []
  for (const item of v) {
    const rec = asRecord(item)
    const sourceId = str(rec.sourceId)
    const name = str(rec.name)
    const clientId = str(rec.clientId)
    if (sourceId !== null && name !== null && clientId !== null) {
      out.push({ sourceId, name, clientId })
    }
  }
  return out
}

/**
 * Parse one inbound WebSocket frame into a validated ServerMessage.
 * Returns null for Link traffic, unknown types, malformed JSON, or messages
 * missing required fields — all of which the client must silently ignore
 * (that is the forward-compatibility contract in the spec).
 */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null
  let json: unknown
  try {
    json = JSON.parse(data)
  } catch {
    return null
  }
  const rec = asRecord(json)
  switch (rec.type) {
    case 'mbus/welcome': {
      const clientId = str(rec.clientId)
      const mbus = typeof rec.mbus === 'number' && Number.isInteger(rec.mbus) ? rec.mbus : null
      if (clientId === null || mbus === null) return null
      return { type: 'welcome', clientId, mbus, sources: sanitizeSources(rec.sources) }
    }
    case 'mbus/announced': {
      const sourceId = str(rec.sourceId)
      const name = str(rec.name)
      if (sourceId === null || name === null) return null
      return { type: 'announced', sourceId, name }
    }
    case 'mbus/sources':
      return { type: 'sources', sources: sanitizeSources(rec.sources) }
    case 'mbus/request': {
      const sourceId = str(rec.sourceId)
      const from = str(rec.from)
      if (sourceId === null || from === null) return null
      return { type: 'request', sourceId, from }
    }
    case 'mbus/signal': {
      const from = str(rec.from)
      if (from === null || !('payload' in rec)) return null
      return { type: 'signal', from, payload: rec.payload }
    }
    case 'mbus/error': {
      const code = str(rec.code)
      if (code === null) return null
      return { type: 'error', code, message: str(rec.message) ?? '', re: str(rec.re) ?? '' }
    }
    default:
      return null // Link traffic ("link") or unknown type — not ours
  }
}

/**
 * Validate a relayed signal payload. Payloads travel end-to-end between
 * clients (the bridge never inspects them), so this is the other half of
 * the trust boundary.
 */
export function parseSignalPayload(v: unknown): SignalPayload | null {
  const rec = asRecord(v)
  const sourceId = str(rec.sourceId)
  if (sourceId === null) return null
  switch (rec.kind) {
    case 'offer':
    case 'answer': {
      const sdp = str(rec.sdp)
      if (sdp === null) return null
      return { kind: rec.kind, sourceId, sdp }
    }
    case 'ice': {
      if (!('candidate' in rec)) return null
      const c = rec.candidate
      if (c === null) return { kind: 'ice', sourceId, candidate: null }
      if (typeof c === 'object') {
        return { kind: 'ice', sourceId, candidate: c as RTCIceCandidateInit }
      }
      return null
    }
    default:
      return null
  }
}

/** Client → bridge message builders (serialization lives in one place). */
export const outbound = {
  hello(): string {
    return JSON.stringify({ type: 'mbus/hello', mbus: MBUS_VERSION })
  },
  announce(name: string): string {
    return JSON.stringify({ type: 'mbus/announce', name })
  },
  unannounce(sourceId: string): string {
    return JSON.stringify({ type: 'mbus/unannounce', sourceId })
  },
  request(sourceId: string): string {
    return JSON.stringify({ type: 'mbus/request', sourceId })
  },
  signal(to: string, payload: SignalPayload): string {
    return JSON.stringify({ type: 'mbus/signal', to, payload })
  },
}
