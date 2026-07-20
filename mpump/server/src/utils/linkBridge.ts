/**
 * Link Bridge client — connects to the mpump Link Bridge companion app.
 *
 * The companion app runs a WebSocket server on localhost:19876 that bridges
 * Ableton Link (UDP multicast) to the browser. This module manages the
 * WebSocket connection and provides a simple pub/sub API for Link state.
 *
 * Connection strategy:
 *   - Tries ws://localhost first, then ws://127.0.0.1, ws://[::1]. A blocked URL
 *     (synchronous SecurityError) rolls over to the next variant immediately.
 *   - Auto-detect mode: sweeps the variants once on page load, then gives up if the bridge isn't running
 *   - Explicit mode: retries every 5s until connected (when user enables in Settings)
 *
 * No internet connections are made — all traffic stays on localhost.
 */

/** Link session state received from the bridge at 20Hz. */
export interface LinkState {
  tempo: number;    // BPM from the Link session
  beat: number;     // Current beat position (e.g. 2.5 = halfway through beat 3)
  phase: number;    // Phase within a bar (0.0–3.999 for 4/4 time)
  playing: boolean; // Whether the Link session is playing
  peers: number;    // Number of other Link peers (e.g. Ableton Live instances)
  clients: number;  // Number of browser clients connected to the bridge
  connected: boolean; // Whether we're connected to the bridge
  /** performance.now() timestamp when this state was received — the anchor for
   *  projecting beat/phase forward. Stamped in the scheduler's clock domain
   *  (the Engine schedules against performance.now()). */
  receivedAt: number;
}

type LinkListener = (state: LinkState) => void;

/**
 * Minimal Link clock anchor for projecting the shared beat/phase forward.
 * Captured from a LinkState; `receivedAt` is a performance.now() timestamp so
 * projections land in the same clock domain the scheduler uses.
 */
export interface LinkClock {
  tempo: number;      // BPM (kept fractional — never round the session tempo)
  beat: number;       // beat position at receivedAt
  phase: number;      // phase within the bar at receivedAt (0..barBeats)
  receivedAt: number; // performance.now() ms when this anchor was captured
}

/** Project the shared beat at time `nowMs` (performance.now domain). */
export function projectBeat(c: LinkClock, nowMs: number): number {
  return c.beat + (nowMs - c.receivedAt) * (c.tempo / 60000);
}

/** Project the shared phase within a bar (wrapped to 0..barBeats). */
export function projectPhase(c: LinkClock, nowMs: number, barBeats = 4): number {
  const p = c.phase + (nowMs - c.receivedAt) * (c.tempo / 60000);
  return ((p % barBeats) + barBeats) % barBeats;
}

/**
 * Next shared bar boundary as a performance.now() timestamp (ms).
 *
 * Aligns to multiples of `barBeats` on the shared Link beat timeline (beat 0 =
 * a downbeat for every peer), so all clients land on the same bar. Takes the
 * imminent boundary — it never skips a whole bar ahead — so mpump lands on the
 * same downbeat as other peers (e.g. mchord, whose quantize has no min-lead
 * skip). Because it derives the target from the projected beat and only ever
 * returns a time >= now, a stale anchor produces a forward-aligned boundary — it
 * never rewinds and never emits a catch-up burst.
 */
export function nextBarTime(c: LinkClock, nowMs: number, barBeats = 4): number {
  const msPerBeat = 60000 / c.tempo;
  const beat = projectBeat(c, nowMs);
  const target = Math.ceil(beat / barBeats) * barBeats;
  return nowMs + Math.max(0, (target - beat) * msPerBeat);
}

/**
 * Decide how a client should follow the session transport on a Link update.
 * Returns the target local playing state, or `null` for "do nothing".
 *
 *  - First update after connect (`prev === null`): adopt only the already-playing
 *    case — join a live session (start on the next shared bar). A stopped session
 *    leaves local transport untouched, so connecting-while-stopped never starts.
 *  - Later updates: follow genuine transitions only (never re-apply a repeat).
 */
export function followTransportDecision(prev: boolean | null, next: boolean): boolean | null {
  if (prev === null) return next ? true : null;
  return next !== prev ? next : null;
}

/**
 * Decide whether a local Play/Stop should be pushed to the session. Suppresses
 * redundant commands (the session is already in the target state) to prevent
 * echo loops; the bridge treats such commands as no-ops anyway.
 */
export function shouldSendPlaying(lastKnown: boolean | null, target: boolean): boolean {
  return lastKnown !== target;
}

// Try multiple localhost variants. `localhost` must come first: Firefox blocks
// insecure ws:// to IP literals (127.0.0.1, [::1]) from an HTTPS page as mixed
// content and only exempts the `localhost` hostname (Firefox bug 1376309).
// Chrome accepts all three; Safari blocks every loopback ws:// from HTTPS.
const WS_URLS = ["ws://localhost:19876", "ws://127.0.0.1:19876", "ws://[::1]:19876"];
const RETRY_MS = 5000;
let wsUrlIdx = 0;
let sweepFails = 0; // consecutive synchronous-construction failures within one sweep

let ws: WebSocket | null = null;
let retryTimer: number | null = null;
let listeners: LinkListener[] = [];
let lastState: LinkState = { tempo: 120, beat: 0, phase: 0, playing: false, peers: 0, clients: 0, connected: false, receivedAt: 0 };
let enabled = false;
let autoMode = false; // true = auto-detect (try once), false = explicit (retry on disconnect)

/** Notify all registered listeners with current state. */
function notify() {
  for (const fn of listeners) fn(lastState);
}

/** Open a WebSocket connection to the bridge. Cycles through URL variants on error. */
function connect() {
  if (ws || (!enabled && !autoMode)) return;
  try {
    ws = new WebSocket(WS_URLS[wsUrlIdx]);
    sweepFails = 0; // constructor accepted this URL — reset the sweep counter

    ws.onopen = () => {
      enabled = true;
      lastState = { ...lastState, connected: true };
      notify();
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "link") {
          lastState = {
            tempo: msg.tempo ?? lastState.tempo,
            beat: msg.beat ?? lastState.beat,
            phase: msg.phase ?? lastState.phase,
            playing: msg.playing ?? lastState.playing,
            peers: msg.peers ?? lastState.peers,
            clients: msg.clients ?? lastState.clients,
            connected: true,
            // Stamp in the scheduler's clock domain so projections align.
            receivedAt: performance.now(),
          };
          notify();
        }
      } catch { /* ignore malformed JSON */ }
    };

    ws.onclose = () => {
      ws = null;
      if (lastState.connected) {
        lastState = { ...lastState, connected: false, peers: 0 };
        notify();
      }
      // Auto-detect mode gives up after first failure; explicit mode retries
      if (enabled && !autoMode) scheduleRetry();
    };

    ws.onerror = () => {
      // Try the next URL variant (127.0.0.1 → [::1] → localhost)
      wsUrlIdx = (wsUrlIdx + 1) % WS_URLS.length;
      ws?.close();
    };
  } catch {
    // Synchronous throw = this URL is unusable in this browser (e.g. Firefox
    // rejects ws:// to an IP literal from HTTPS with a SecurityError). Roll over
    // to the next variant immediately; only back off once a whole sweep fails,
    // so we don't spin when every variant is blocked (e.g. Safari).
    wsUrlIdx = (wsUrlIdx + 1) % WS_URLS.length;
    if (++sweepFails < WS_URLS.length) {
      window.setTimeout(connect, 0);
    } else {
      sweepFails = 0;
      if (enabled && !autoMode) scheduleRetry();
    }
  }
}

/** Schedule a reconnection attempt after RETRY_MS. */
function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = window.setTimeout(connect, RETRY_MS);
}

/** Enable or disable the Link Bridge connection. */
export function enableLinkBridge(on: boolean) {
  enabled = on;
  autoMode = false;
  if (on) {
    sweepFails = 0;
    connect();
  } else {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (ws) { ws.close(); ws = null; }
    lastState = { ...lastState, connected: false, peers: 0 };
    notify();
  }
}

/**
 * Subscribe to Link state changes.
 * Returns an unsubscribe function.
 */
export function onLinkState(fn: LinkListener) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

/** Send a tempo change to the Link session via the bridge. */
export function sendLinkTempo(tempo: number) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "set_tempo", tempo }));
  }
}

/** Send a play/stop command to the Link session via the bridge. */
export function sendLinkPlaying(playing: boolean) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "set_playing", playing }));
  }
}

/** Get the current Link state (synchronous snapshot). */
export function getLinkState(): LinkState {
  return lastState;
}

/**
 * Auto-detect: try connecting once on page load.
 * If the bridge is running, stays connected. If not, silently gives up.
 * Does not retry — use enableLinkBridge(true) for persistent connection.
 */
export function autoDetectLinkBridge() {
  if (enabled || ws) return;
  autoMode = true;
  sweepFails = 0;
  connect();
}
