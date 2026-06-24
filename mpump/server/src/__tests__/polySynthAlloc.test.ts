/**
 * Poly-synth worklet allocation test — process() runs ~345×/s on the audio
 * thread and must not allocate (see research-audioworklet-gc.md at repo
 * root): a GC pause on the audio thread causes dropouts.
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";

// Worklet global scope stubs (AudioWorkletGlobalScope APIs)
const g = globalThis as unknown as Record<string, unknown>;
let ProcessorClass: (new () => {
  process(inputs: unknown[], outputs: Float32Array[][], params: unknown): boolean;
  _noteOn(ch: number, note: number, vel: number, gate: number): void;
}) | null = null;
g.AudioWorkletProcessor = class { port = { onmessage: null, postMessage() {} }; };
g.registerProcessor = (_name: string, cls: typeof ProcessorClass) => { ProcessorClass = cls; };
g.sampleRate = 44100;
g.currentFrame = 0;
g.currentTime = 0;

// @ts-expect-error — plain JS worklet module without type declarations
await import("../../public/worklets/poly-synth.js");

describe("poly-synth process() allocations", () => {
  it("does not construct typed arrays per process() call", () => {
    expect(ProcessorClass).not.toBeNull();
    const proc = new ProcessorClass!();
    const outputs = [[new Float32Array(128), new Float32Array(128)]];
    proc._noteOn(0, 60, 100, 0.2); // active voice so the full path runs
    proc.process([], outputs, {}); // warm-up (lazy sample-rate init)

    const RealF64 = Float64Array;
    let allocs = 0;
    // Unqualified `Float64Array` in the module resolves through the global
    // scope at each evaluation, so this intercepts any per-block `new`.
    g.Float64Array = function (...args: unknown[]) {
      allocs++;
      return new (RealF64 as unknown as new (...a: unknown[]) => Float64Array)(...args);
    };
    try {
      for (let i = 0; i < 4; i++) proc.process([], outputs, {});
    } finally {
      g.Float64Array = RealF64;
    }
    expect(allocs).toBe(0);
  });
});
