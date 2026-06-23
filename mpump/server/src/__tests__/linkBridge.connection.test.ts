/**
 * @vitest-environment jsdom
 *
 * Connection-logic tests for the Link Bridge (the real module, with a mocked
 * WebSocket). These exercise the URL-rotation strategy that the pure-logic
 * tests in linkBridge.test.ts deliberately skip.
 *
 * Regression target: Firefox blocks insecure ws:// to IP literals (127.0.0.1,
 * [::1]) from an HTTPS page as mixed content — only the `localhost` hostname is
 * exempt (Firefox bug 1376309). So the bridge must try `ws://localhost` FIRST,
 * and a synchronous SecurityError from the WebSocket constructor must roll over
 * to the next variant immediately rather than waiting out the 5s retry timer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const LOCALHOST_URL = "ws://localhost:19876";

/** URLs whose construction should throw synchronously (simulating Firefox mixed-content block). */
let throwingUrls: Set<string>;
/** Every URL the module passed to `new WebSocket(...)`, in order. */
let constructed: string[];
/** Instances that were successfully constructed (so a test can fire their handlers). */
let instances: MockWebSocket[];

class MockWebSocket {
  static readonly OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    constructed.push(url);
    if (throwingUrls.has(url)) {
      // Mirrors Firefox: `new WebSocket("ws://127.0.0.1:…")` from https throws
      // "SecurityError: The operation is insecure." synchronously.
      throw new DOMException("The operation is insecure.", "SecurityError");
    }
    instances.push(this);
  }
  close() { this.onclose?.(); }
  send() {}
}

/** Re-import the module with fresh singleton state and the mock installed. */
async function loadModule() {
  vi.resetModules();
  (globalThis as any).WebSocket = MockWebSocket;
  return await import("../utils/linkBridge");
}

beforeEach(() => {
  throwingUrls = new Set();
  constructed = [];
  instances = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Link Bridge connection strategy", () => {
  it("tries ws://localhost first (the only loopback form Firefox allows over HTTPS)", async () => {
    throwingUrls = new Set(["ws://127.0.0.1:19876", "ws://[::1]:19876", LOCALHOST_URL]);
    const { enableLinkBridge } = await loadModule();
    enableLinkBridge(true);
    expect(constructed[0]).toBe(LOCALHOST_URL);
  });

  it("rolls over to the next variant immediately on a synchronous SecurityError", async () => {
    // All variants blocked → the module should sweep through ALL of them within
    // one tick, NOT wait 5s between each attempt.
    throwingUrls = new Set(["ws://127.0.0.1:19876", "ws://[::1]:19876", LOCALHOST_URL]);
    const { enableLinkBridge } = await loadModule();
    enableLinkBridge(true);
    // Flush the chained 0ms immediate-retry timers (well under the 5000ms backoff).
    vi.advanceTimersByTime(50);
    expect(constructed.length).toBe(3);
  });

  it("backs off (does not hammer) after a full failed sweep, then retries", async () => {
    throwingUrls = new Set(["ws://127.0.0.1:19876", "ws://[::1]:19876", LOCALHOST_URL]);
    const { enableLinkBridge } = await loadModule();
    enableLinkBridge(true);
    vi.advanceTimersByTime(50);
    expect(constructed.length).toBe(3); // one sweep, no spinning
    vi.advanceTimersByTime(5000);       // backoff elapses → second sweep
    expect(constructed.length).toBe(6);
  });

  it("connects on the first reachable URL without rotating", async () => {
    // Nothing throws → first attempt (localhost) constructs and opens.
    const { enableLinkBridge, getLinkState } = await loadModule();
    enableLinkBridge(true);
    expect(constructed).toEqual([LOCALHOST_URL]);
    expect(instances.length).toBe(1);
    instances[0].onopen?.();
    expect(getLinkState().connected).toBe(true);
  });
});
