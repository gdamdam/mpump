/**
 * Scheduled-dispatch tests for the poly-synth AudioWorklet (#1).
 *
 * poly-synth.js is a self-contained classic worklet (no imports), so we load
 * it under stubbed AudioWorkletGlobalScope globals and drive its REAL
 * _handleMessage / process methods directly — this exercises the actual
 * worklet code, not a mirror.
 *
 * Contract under test: a noteOn/duck message carrying an absolute audio-clock
 * `when` must fire in the render block whose time window contains `when`, NOT
 * on message receipt. Messages without `when` keep the old immediate behavior
 * (live keyboard notes, fallbacks).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll } from "vitest";

const SR = 44100;
const N = 128; // render quantum size

// AudioWorkletGlobalScope globals the worklet reads. currentTime/currentFrame
// advance per render block; we move them by hand to simulate the audio clock.
let _currentTime = 0;
let _currentFrame = 0;
Object.defineProperty(globalThis, "sampleRate", { value: SR, configurable: true, writable: true });
Object.defineProperty(globalThis, "currentTime", { get: () => _currentTime, configurable: true });
Object.defineProperty(globalThis, "currentFrame", { get: () => _currentFrame, configurable: true });

class StubProcessor {
  port: { postMessage: () => void; onmessage: null | ((e: { data: unknown }) => void) } = {
    postMessage: () => {},
    onmessage: null,
  };
}
(globalThis as Record<string, unknown>).AudioWorkletProcessor = StubProcessor;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Processor: new () => any;
(globalThis as Record<string, unknown>).registerProcessor = (_name: string, cls: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Processor = cls as new () => any;
};

beforeAll(async () => {
  // @ts-expect-error — plain JS worklet module without type declarations
  await import("../../public/worklets/poly-synth.js");
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runBlock(proc: any, timeSec: number): void {
  _currentTime = timeSec;
  _currentFrame = Math.round(timeSec * SR);
  proc.process([], [[new Float32Array(N)]], {});
}

describe("poly-synth scheduled note dispatch", () => {
  it("fires a scheduled noteOn in the block containing `when`, not on receipt", () => {
    const proc = new Processor();
    const spy = vi.spyOn(proc, "_noteOn");
    _currentTime = 0;
    _currentFrame = 0;
    proc._handleMessage({ type: "noteOn", channel: 0, note: 60, vel: 100, gate: 0.1, when: 0.5 });
    expect(spy).not.toHaveBeenCalled(); // not on receipt
    runBlock(proc, 0); // early block — note not due yet
    expect(spy).not.toHaveBeenCalled();
    runBlock(proc, 0.5); // block whose window contains when=0.5
    expect(spy).toHaveBeenCalledTimes(1);
    // gate is stored in a Float32Array (inaudible precision loss), so compare loosely
    const [ch, note, vel, gate] = spy.mock.calls[0];
    expect([ch, note, vel]).toEqual([0, 60, 100]);
    expect(gate).toBeCloseTo(0.1, 5);
  });

  it("fires a noteOn immediately when no `when` is given (live keyboard path)", () => {
    const proc = new Processor();
    const spy = vi.spyOn(proc, "_noteOn");
    proc._handleMessage({ type: "noteOn", channel: 0, note: 64, vel: 90, gate: 0 });
    expect(spy).toHaveBeenCalledTimes(1); // immediate, no process() needed
  });

  it("never drops notes when the scheduled queue overflows (immediate fallback)", () => {
    const proc = new Processor();
    const spy = vi.spyOn(proc, "_noteOn");
    _currentTime = 0;
    _currentFrame = 0;
    const COUNT = 300; // exceeds the queue capacity
    for (let i = 0; i < COUNT; i++) {
      proc._handleMessage({ type: "noteOn", channel: 0, note: 60, vel: 100, gate: 0.05, when: 1.0 });
    }
    runBlock(proc, 1.0); // drain everything still queued
    expect(spy).toHaveBeenCalledTimes(COUNT); // nothing dropped
  });
});

describe("poly-synth scheduled sidechain duck", () => {
  it("ducks a channel at the scheduled block, not on receipt", () => {
    const proc = new Processor();
    proc._handleMessage({ type: "duck_params", depth: 0.7, release: 0.06 });
    _currentTime = 0;
    _currentFrame = 0;
    proc._handleMessage({ type: "duck", channel: 1, depth: 0.7, when: 0.5 });
    expect(proc._chDuckLevel[1]).toBe(1); // not ducked on receipt
    runBlock(proc, 0); // not due yet
    expect(proc._chDuckLevel[1]).toBe(1);
    runBlock(proc, 0.5); // scheduled block — duck applies (~0.3, minus one block recovery)
    expect(proc._chDuckLevel[1]).toBeLessThan(0.4);
  });

  it("ducks immediately when no `when` is given (backward compat)", () => {
    const proc = new Processor();
    proc._handleMessage({ type: "duck_params", depth: 0.7, release: 0.06 });
    proc._handleMessage({ type: "duck", channel: 1, depth: 0.7 });
    expect(proc._chDuckLevel[1]).toBeCloseTo(0.3, 5);
  });
});
