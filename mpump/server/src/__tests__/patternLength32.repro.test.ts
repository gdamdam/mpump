/**
 * Repro: selecting 32 steps live on a playing synth device should make the
 * live sequencer advance through all 32 steps (onStep fires indices >= 16),
 * not just the first 16.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Engine } from "../engine/Engine";
import type { MidiPort } from "../engine/MidiPort";

function mockPort() {
  return {
    name: "mock", id: "mock",
    noteOn: vi.fn(), noteOff: vi.fn(),
    allNotesOff: vi.fn(), programChange: vi.fn(), clock: vi.fn(),
  } as unknown as MidiPort;
}

type Priv = {
  data: unknown;
  audioPort: unknown;
  ports: Record<string, MidiPort>;
  deviceStates: Map<string, { melodicEdit: unknown; patternLength: number }>;
  sequencers: Map<string, { pattern: unknown[] }>;
  startDevice(id: string): void;
  stopDevice(id: string): void;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("32-step live toggle", () => {
  it("advances through all 32 steps after setPatternLength(32)", () => {
    const steps: number[] = [];
    const engine = new Engine(null, {
      onStateChange: () => {},
      onStep: (_id, step) => { steps.push(step); },
      onCatalogChange: () => {},
    });
    const eng = engine as unknown as Priv;
    eng.data = { catalog: { keys: ["A"] } };
    eng.audioPort = { playClick: vi.fn() };

    // Give every device an edit buffer so getState() never falls back to the
    // (mocked, incomplete) catalog during emitState.
    for (const [, dstate] of eng.deviceStates as unknown as Map<string, Record<string, unknown>>) {
      dstate.melodicEdit = Array.from({ length: 16 }, () => ({ semi: 0, vel: 1, slide: false }));
      dstate.drumEdit = Array.from({ length: 16 }, () => []);
      dstate.bassEdit = Array.from({ length: 16 }, () => null);
    }

    const id = "preview_synth";
    eng.ports[id] = mockPort();
    eng.startDevice(id);

    // simulate real elapsed time so performance.now() is large (no cooldown collision)
    vi.advanceTimersByTime(2000);

    // toggle to 32 while playing
    engine.setPatternLength(id, 32);

    // immediately after toggle
    const seqLenImmediate = eng.sequencers.get(id)?.pattern.length;
    // let any deferred restart fire, then check again
    vi.advanceTimersByTime(200);
    const seqLenAfter = eng.sequencers.get(id)?.pattern.length;

    // advance several bars worth of time and confirm steps >= 16 are visited
    steps.length = 0;
    vi.advanceTimersByTime(8000);
    const maxStep = Math.max(...steps);
    // eslint-disable-next-line no-console
    console.log("seqLenImmediate", seqLenImmediate, "seqLenAfter", seqLenAfter, "maxStep", maxStep);
    expect(seqLenImmediate).toBe(32);
    expect(maxStep).toBeGreaterThanOrEqual(16);
  });

  it("recovers to 32 steps even when toggle lands inside the restart cooldown", () => {
    const steps: number[] = [];
    const engine = new Engine(null, {
      onStateChange: () => {},
      onStep: (_id, step) => { steps.push(step); },
      onCatalogChange: () => {},
    });
    const eng = engine as unknown as Priv & { restartDevice(id: string, immediate?: boolean): void };
    eng.data = { catalog: { keys: ["A"] } };
    eng.audioPort = { playClick: vi.fn() };

    for (const [, dstate] of eng.deviceStates as unknown as Map<string, Record<string, unknown>>) {
      dstate.melodicEdit = Array.from({ length: 16 }, () => ({ semi: 0, vel: 1, slide: false }));
      dstate.drumEdit = Array.from({ length: 16 }, () => []);
      dstate.bassEdit = Array.from({ length: 16 }, () => null);
    }

    const id = "preview_synth";
    eng.ports[id] = mockPort();
    eng.startDevice(id);
    vi.advanceTimersByTime(2000);

    // Force a restart so restartTimers[id] is fresh, then toggle within 50ms.
    eng.restartDevice(id, true);
    vi.advanceTimersByTime(20); // < 50ms cooldown
    engine.setPatternLength(id, 32);

    // Immediately the deferred restart hasn't fired; let cooldown + debounce clear.
    vi.advanceTimersByTime(300);
    const seqLen = eng.sequencers.get(id)?.pattern.length;

    steps.length = 0;
    vi.advanceTimersByTime(8000);
    const maxStep = Math.max(...steps);
    // eslint-disable-next-line no-console
    console.log("cooldown seqLen", seqLen, "maxStep", maxStep);
    expect(seqLen).toBe(32);
    expect(maxStep).toBeGreaterThanOrEqual(16);
  });
});
