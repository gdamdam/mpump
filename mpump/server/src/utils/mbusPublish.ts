/**
 * mbusPublish — offer mpump's master output to the mbus patchbay.
 *
 * Module-scope singleton mirroring utils/linkBridge.ts's shape: plain
 * functions over module state, no React. The mbus client (see
 * src/transport/mbus) rides the same localhost link-bridge as Ableton Link but
 * on its own connection; publishing is off by default and session-transient —
 * until enabled no client exists and no socket is opened, so behavior is
 * unchanged. With the bridge absent the client retries quietly.
 *
 * AudioPort registers its end-of-chain analyser tap on construction and
 * withdraws it on close; the Settings BUS toggle flips the user intent. The
 * two are reconciled here so either can change in any order.
 */
import { createMbusClient, type MbusClient, type Publication } from "../transport/mbus";

let client: MbusClient | null = null;
let pub: Publication | null = null;
let wanted = false;
let tap: AudioNode | null = null;

/** AudioPort lifecycle: the current master tap node, or null when closed. */
export function registerMbusTap(node: AudioNode | null): void {
  tap = node;
  apply();
}

/** User intent from the Settings BUS toggle. Not persisted — off by default. */
export function enableMbusPublish(on: boolean): void {
  wanted = on;
  apply();
}

export function isMbusPublishEnabled(): boolean {
  return wanted;
}

function apply(): void {
  if (wanted && tap) {
    if (pub) return;
    client ??= createMbusClient();
    client.connect();
    pub = client.publishOutput(tap, "mpump");
  } else {
    // Not runnable: stop announcing. Drop the socket only when the user turned
    // it off — a vanished tap (AudioPort rebuild) keeps the client so the
    // re-registered tap republishes without a reconnect round-trip.
    pub?.stop();
    pub = null;
    if (!wanted) client?.disconnect();
  }
}
