/**
 * Tests for saveSession bounded growth + quota handling.
 * Regression guard for the "silent quota failure + false success" bug:
 * saveSession must cap the saved list, evict oldest entries to fit the newest
 * save under quota pressure, and report failure (null) when nothing can be written.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSavedSessions, saveSession, MAX_SAVED, type SessionData } from "../utils/session";

function makeStorage(opts: { maxBytes?: number; throwOnSet?: boolean } = {}): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new DOMException("quota", "QuotaExceededError");
      if (opts.maxBytes != null) {
        const others = Object.entries(store).reduce((n, [kk, vv]) => (kk === k ? n : n + vv.length), 0);
        if (others + v.length > opts.maxBytes) throw new DOMException("quota", "QuotaExceededError");
      }
      store[k] = v;
    },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

/** Minimal SessionData with a controllable payload size. */
function makeSession(pad = ""): SessionData {
  return { version: "test", timestamp: "t", bpm: 120, devices: {}, _pad: pad } as unknown as SessionData;
}

describe("saveSession bounded growth + quota", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
    let n = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `uuid-${n++}` });
  });

  it("caps the saved list at MAX_SAVED, keeping newest first", () => {
    for (let i = 0; i < MAX_SAVED + 5; i++) saveSession(`s${i}`, makeSession());
    const list = getSavedSessions();
    expect(list.length).toBe(MAX_SAVED);
    expect(list[0].name).toBe(`s${MAX_SAVED + 4}`); // newest at front
  });

  it("returns null when even a single entry cannot be written", () => {
    vi.stubGlobal("localStorage", makeStorage({ throwOnSet: true }));
    expect(saveSession("x", makeSession())).toBeNull();
  });

  it("evicts oldest entries to fit the newest save under quota pressure", () => {
    // Each entry ~1KB; cap the store so only a few fit.
    vi.stubGlobal("localStorage", makeStorage({ maxBytes: 4000 }));
    const pad = "x".repeat(1000);
    let last = null;
    for (let i = 0; i < 10; i++) last = saveSession(`s${i}`, makeSession(pad));
    expect(last).not.toBeNull();
    const list = getSavedSessions();
    // newest save survived...
    expect(list[0].id).toBe(last!.id);
    // ...and the list was trimmed to fit, not grown unbounded.
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThan(10);
  });
});
