/**
 * Ableton Link transport + shared bar-grid tests.
 *
 * Covers the shared-behavior contract:
 *   - beat/phase projected from {tempo, beat, phase, receivedAt}
 *   - joining an already-playing session (no Play sent, next shared bar)
 *   - following remote start/stop transitions
 *   - echo-loop prevention on local Play/Stop
 *   - fractional tempo preserved; tempo change preserves phase
 *   - forward drift correction skips missed steps (no catch-up)
 *   - disconnected behavior falls back to the private t0 grid unchanged
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  projectBeat,
  projectPhase,
  nextBarTime,
  followTransportDecision,
  shouldSendPlaying,
  type LinkClock,
} from "../utils/linkBridge";
import { Engine } from "../engine/Engine";

// -- Pure clock projection ------------------------------------------------

describe("Link clock projection", () => {
  it("projects beat forward from the anchor at the session tempo", () => {
    const c: LinkClock = { tempo: 120, beat: 2, phase: 2, receivedAt: 1000 };
    // 120 BPM = 2 beats/sec. 500ms after the anchor → +1 beat.
    expect(projectBeat(c, 1500)).toBeCloseTo(3, 6);
    expect(projectBeat(c, 2000)).toBeCloseTo(4, 6);
  });

  it("wraps projected phase within the bar", () => {
    const c: LinkClock = { tempo: 120, beat: 3, phase: 3, receivedAt: 0 };
    // +1 beat crosses the bar line: phase 3 → 0.
    expect(projectPhase(c, 500, 4)).toBeCloseTo(0, 6);
    expect(projectPhase(c, 250, 4)).toBeCloseTo(3.5, 6);
  });

  it("keeps fractional tempo (no rounding in the grid math)", () => {
    const c: LinkClock = { tempo: 127.333, beat: 0, phase: 0, receivedAt: 0 };
    const msPerBeat = 60000 / 127.333;
    expect(projectBeat(c, msPerBeat)).toBeCloseTo(1, 6);
  });
});

// -- Shared bar grid ------------------------------------------------------

describe("nextBarTime (shared bar grid)", () => {
  it("returns the next shared downbeat aligned to the beat timeline", () => {
    // At beat 2.0, 120 BPM: next 4-beat boundary is beat 4 → 2 beats = 1000ms away.
    const c: LinkClock = { tempo: 120, beat: 2, phase: 2, receivedAt: 0 };
    expect(nextBarTime(c, 0, 4)).toBeCloseTo(1000, 6);
  });

  it("takes the imminent boundary without skipping a bar (stays aligned with peers)", () => {
    // Exactly on a downbeat (beat 0): launch immediately on this bar (0ms),
    // never skip a whole bar ahead — otherwise mpump lands a bar after mchord.
    const c: LinkClock = { tempo: 120, beat: 0, phase: 0, receivedAt: 0 };
    expect(nextBarTime(c, 0, 4)).toBeCloseTo(0, 6);
  });

  it("tempo change preserves phase (grid stays continuous across the anchor)", () => {
    // Two peers agree on beat 1.5 at t=1000. A tempo change re-anchors with the
    // same beat position; the next bar must remain beat 4, only its ms distance
    // rescales — no restart, no phase jump.
    const slow: LinkClock = { tempo: 120, beat: 1.5, phase: 1.5, receivedAt: 1000 };
    const fast: LinkClock = { tempo: 140, beat: 1.5, phase: 1.5, receivedAt: 1000 };
    expect(projectPhase(slow, 1000, 4)).toBeCloseTo(projectPhase(fast, 1000, 4), 6);
    // Next boundary is beat 4 in both, distance = 2.5 beats at each tempo.
    expect(nextBarTime(slow, 1000, 4)).toBeCloseTo(1000 + 2.5 * (60000 / 120), 6);
    expect(nextBarTime(fast, 1000, 4)).toBeCloseTo(1000 + 2.5 * (60000 / 140), 6);
  });

  it("forward correction: a stale anchor still yields a future boundary, never a rewind or catch-up", () => {
    // Anchor captured 10s ago; the tab woke up late. The boundary must be ahead
    // of `now` and aligned — we skip the missed bars, we do not replay them.
    const c: LinkClock = { tempo: 120, beat: 0, phase: 0, receivedAt: 0 };
    const now = 10_000; // 20 beats / 5 bars later
    const t = nextBarTime(c, now, 4);
    expect(t).toBeGreaterThanOrEqual(now);    // never in the past (== now when on a downbeat)
    const beatAtBoundary = projectBeat(c, t);
    expect(beatAtBoundary % 4).toBeCloseTo(0, 6); // still a shared downbeat
  });
});

// -- Transport follow decision -------------------------------------------

describe("followTransportDecision", () => {
  it("connect while stopped: does not start", () => {
    expect(followTransportDecision(null, false)).toBeNull();
  });
  it("connect while already playing: joins (starts)", () => {
    expect(followTransportDecision(null, true)).toBe(true);
  });
  it("remote start transition schedules exactly once", () => {
    expect(followTransportDecision(false, true)).toBe(true);
    // A repeat of the same playing state is not re-applied.
    expect(followTransportDecision(true, true)).toBeNull();
  });
  it("remote stop transition stops", () => {
    expect(followTransportDecision(true, false)).toBe(false);
  });
  it("no transition: does nothing", () => {
    expect(followTransportDecision(false, false)).toBeNull();
  });
});

// -- Local Play/Stop echo guard ------------------------------------------

describe("shouldSendPlaying (echo-loop prevention)", () => {
  it("local Play while the session already plays sends no redundant command", () => {
    expect(shouldSendPlaying(true, true)).toBe(false);
  });
  it("local Play while stopped sends once", () => {
    expect(shouldSendPlaying(false, true)).toBe(true);
    expect(shouldSendPlaying(null, true)).toBe(true);
  });
  it("local Stop while playing sends once", () => {
    expect(shouldSendPlaying(true, false)).toBe(true);
  });
});

// -- Engine bar-grid integration -----------------------------------------

describe("Engine shared bar grid", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeEngine() {
    return new Engine(null, { onStateChange: () => {}, onStep: () => {}, onCatalogChange: () => {} });
  }
  // nextBarBoundary is private; exercise it through the same cast the repo's
  // clockSync tests use for private engine state.
  const barOf = (e: Engine, steps = 16) =>
    (e as unknown as { nextBarBoundary(n: number): number }).nextBarBoundary(steps);

  it("aligns starts to the Link grid, independent of the private t0 grid", () => {
    const e = makeEngine();
    // performance.now() === 0 under fake timers, so t0 === 0.
    // Link says beat 1.0 now → next downbeat is beat 4 = 3 beats = 1500ms.
    e.setLinkClock({ tempo: 120, beat: 1, phase: 1, receivedAt: 0 });
    expect(barOf(e)).toBeCloseTo(1500, 3);
    // The private t0 grid would have returned 2000ms — proves the Link grid won.
    expect(barOf(e)).not.toBeCloseTo(2000, 3);
  });

  it("disconnected (no Link clock) falls back to the t0 grid unchanged", () => {
    const e = makeEngine();
    e.setLinkClock(null);
    // t0 === 0, 120 BPM, 16 steps → barDur 2000ms; on the boundary → skip to 2000.
    expect(barOf(e)).toBeCloseTo(2000, 3);
  });

  it("setLinkClock is a pure update — safe to call on every 20Hz tick", () => {
    const e = makeEngine();
    for (let i = 0; i < 50; i++) {
      e.setLinkClock({ tempo: 120, beat: i * 0.1, phase: (i * 0.1) % 4, receivedAt: 0 });
    }
    // No throw, no restart side-effects; the latest clock drives the grid.
    expect(barOf(e)).toBeGreaterThan(0);
  });
});
