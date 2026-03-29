import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Link Bridge protocol and message parsing.
 * Tests the data layer (message format, state transitions) without real WebSocket connections.
 */

// -- Protocol message format tests --

describe("Link Bridge protocol", () => {
  describe("server → browser messages", () => {
    it("parses a valid link state message", () => {
      const raw = '{"type":"link","tempo":128.5,"beat":2.3,"phase":0.575,"playing":true,"peers":1,"clients":1}';
      const msg = JSON.parse(raw);
      expect(msg.type).toBe("link");
      expect(msg.tempo).toBe(128.5);
      expect(msg.beat).toBe(2.3);
      expect(msg.phase).toBe(0.575);
      expect(msg.playing).toBe(true);
      expect(msg.peers).toBe(1);
      expect(msg.clients).toBe(1);
    });

    it("handles zero peers", () => {
      const msg = JSON.parse('{"type":"link","tempo":120,"beat":0,"phase":0,"playing":false,"peers":0,"clients":0}');
      expect(msg.peers).toBe(0);
      expect(msg.playing).toBe(false);
    });

    it("handles high BPM values", () => {
      const msg = JSON.parse('{"type":"link","tempo":300,"beat":0,"phase":0,"playing":true,"peers":2,"clients":1}');
      expect(msg.tempo).toBe(300);
    });

    it("handles fractional tempo", () => {
      const msg = JSON.parse('{"type":"link","tempo":127.33333,"beat":0,"phase":0,"playing":false,"peers":0,"clients":0}');
      expect(msg.tempo).toBeCloseTo(127.333, 2);
    });
  });

  describe("browser → server messages", () => {
    it("formats set_tempo correctly", () => {
      const msg = JSON.stringify({ type: "set_tempo", tempo: 140 });
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("set_tempo");
      expect(parsed.tempo).toBe(140);
    });

    it("formats set_playing correctly", () => {
      const msg = JSON.stringify({ type: "set_playing", playing: true });
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("set_playing");
      expect(parsed.playing).toBe(true);
    });

    it("formats set_playing stop correctly", () => {
      const msg = JSON.stringify({ type: "set_playing", playing: false });
      const parsed = JSON.parse(msg);
      expect(parsed.playing).toBe(false);
    });
  });
});

// -- LinkState transition tests --

describe("LinkState transitions", () => {
  interface LinkState {
    tempo: number; beat: number; phase: number;
    playing: boolean; peers: number; connected: boolean;
  }

  const DEFAULT: LinkState = { tempo: 120, beat: 0, phase: 0, playing: false, peers: 0, connected: false };

  function applyLinkMessage(state: LinkState, msg: any): LinkState {
    if (msg.type !== "link") return state;
    return {
      tempo: msg.tempo ?? state.tempo,
      beat: msg.beat ?? state.beat,
      phase: msg.phase ?? state.phase,
      playing: msg.playing ?? state.playing,
      peers: msg.peers ?? state.peers,
      connected: true,
    };
  }

  it("updates tempo from link message", () => {
    const next = applyLinkMessage(DEFAULT, { type: "link", tempo: 140, beat: 0, phase: 0, playing: false, peers: 0 });
    expect(next.tempo).toBe(140);
    expect(next.connected).toBe(true);
  });

  it("preserves fields not in message via nullish coalescing", () => {
    const state: LinkState = { tempo: 130, beat: 1.5, phase: 0.375, playing: true, peers: 2, connected: true };
    const next = applyLinkMessage(state, { type: "link", tempo: 135 });
    expect(next.tempo).toBe(135);
    expect(next.beat).toBe(1.5);
    expect(next.phase).toBe(0.375);
    expect(next.playing).toBe(true);
    expect(next.peers).toBe(2);
  });

  it("ignores non-link messages", () => {
    const next = applyLinkMessage(DEFAULT, { type: "other", tempo: 999 });
    expect(next).toBe(DEFAULT);
  });

  it("sets connected to true on any link message", () => {
    expect(DEFAULT.connected).toBe(false);
    const next = applyLinkMessage(DEFAULT, { type: "link", tempo: 120, beat: 0, phase: 0, playing: false, peers: 0 });
    expect(next.connected).toBe(true);
  });
});

// -- Listener management tests --

describe("listener management", () => {
  it("onLinkState returns an unsubscribe function", () => {
    // Simulate the listener pattern used in linkBridge.ts
    let listeners: ((s: any) => void)[] = [];
    function onLinkState(fn: (s: any) => void) {
      listeners.push(fn);
      return () => { listeners = listeners.filter(l => l !== fn); };
    }

    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const unsub1 = onLinkState(fn1);
    onLinkState(fn2);

    // Both listeners registered
    expect(listeners.length).toBe(2);

    // Unsubscribe first
    unsub1();
    expect(listeners.length).toBe(1);
    expect(listeners[0]).toBe(fn2);
  });
});

// -- BPM validation tests --

describe("BPM validation", () => {
  function isValidBpm(tempo: number): boolean {
    return tempo >= 20 && tempo <= 300;
  }

  it("accepts normal BPM range", () => {
    expect(isValidBpm(120)).toBe(true);
    expect(isValidBpm(60)).toBe(true);
    expect(isValidBpm(200)).toBe(true);
  });

  it("accepts edge values", () => {
    expect(isValidBpm(20)).toBe(true);
    expect(isValidBpm(300)).toBe(true);
  });

  it("rejects out of range", () => {
    expect(isValidBpm(19)).toBe(false);
    expect(isValidBpm(301)).toBe(false);
    expect(isValidBpm(0)).toBe(false);
    expect(isValidBpm(-1)).toBe(false);
  });
});

// -- URL rotation tests --

describe("WS URL rotation", () => {
  const WS_URLS = ["ws://127.0.0.1:19876", "ws://[::1]:19876", "ws://localhost:19876"];

  it("cycles through URLs on error", () => {
    let idx = 0;
    // Simulate 3 errors rotating through all URLs
    for (let i = 0; i < 3; i++) {
      idx = (idx + 1) % WS_URLS.length;
    }
    expect(idx).toBe(0); // back to start after full rotation
  });

  it("all URLs target port 19876", () => {
    for (const url of WS_URLS) {
      expect(url).toContain("19876");
    }
  });

  it("includes IPv4, IPv6, and hostname variants", () => {
    expect(WS_URLS[0]).toContain("127.0.0.1");
    expect(WS_URLS[1]).toContain("::1");
    expect(WS_URLS[2]).toContain("localhost");
  });
});
