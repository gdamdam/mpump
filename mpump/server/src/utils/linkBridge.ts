/**
 * Link Bridge client — connects to the mpump Link Bridge companion app.
 *
 * The companion app runs a WebSocket server on localhost:19876 that bridges
 * Ableton Link (UDP multicast) to the browser. This module manages the
 * WebSocket connection and provides a simple pub/sub API for Link state.
 *
 * Connection strategy:
 *   - Tries ws://127.0.0.1, ws://[::1], ws://localhost (for Safari compatibility)
 *   - Auto-detect mode: tries once on page load, silently gives up if bridge isn't running
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
}

type LinkListener = (state: LinkState) => void;

// Try multiple localhost variants — Safari blocks some from HTTPS pages
const WS_URLS = ["ws://127.0.0.1:19876", "ws://[::1]:19876", "ws://localhost:19876"];
const RETRY_MS = 5000;
let wsUrlIdx = 0;

let ws: WebSocket | null = null;
let retryTimer: number | null = null;
let listeners: LinkListener[] = [];
let lastState: LinkState = { tempo: 120, beat: 0, phase: 0, playing: false, peers: 0, clients: 0, connected: false };
let enabled = false;
let autoMode = false; // true = auto-detect (try once), false = explicit (retry on disconnect)

/** Notify all registered listeners with current state. */
function notify() {
  for (const fn of listeners) fn(lastState);
}

/** Open a WebSocket connection to the bridge. Cycles through URL variants on error. */
function connect() {
  if (ws) return;
  try {
    ws = new WebSocket(WS_URLS[wsUrlIdx]);

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
    wsUrlIdx = (wsUrlIdx + 1) % WS_URLS.length;
    if (enabled && !autoMode) scheduleRetry();
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
  connect();
}
