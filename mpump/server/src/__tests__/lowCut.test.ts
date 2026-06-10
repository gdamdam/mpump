/**
 * setLowCut rebuild bookkeeping test — if the anti-clip chain is rebuilt
 * while the low cut is bypassed, the filter ends up unwired; re-enabling
 * must trigger a rebuild or the filter silently has no effect.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function makeParam() {
  return { value: 1, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
}
class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = "running";
  destination = {};
  createBuffer(channels: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data, numberOfChannels: channels, length, sampleRate: rate, duration: length / rate };
  }
  createGain() { return { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn() }; }
  createStereoPanner() { return { pan: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }; }
  createOscillator() { return { type: "sine", frequency: makeParam(), detune: makeParam(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; }
  createBiquadFilter() { return { type: "lowpass", frequency: makeParam(), Q: makeParam(), gain: makeParam(), connect: vi.fn(), disconnect: vi.fn() }; }
  createBufferSource() { return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; }
  createAnalyser() { return { fftSize: 256, frequencyBinCount: 128, connect: vi.fn(), disconnect: vi.fn(), getByteFrequencyData: vi.fn(), getByteTimeDomainData: vi.fn(), context: { sampleRate: 44100 } }; }
  createDynamicsCompressor() { return { threshold: makeParam(), ratio: makeParam(), attack: makeParam(), release: makeParam(), knee: makeParam(), connect: vi.fn(), disconnect: vi.fn() }; }
  createWaveShaper() { return { curve: null, oversample: "none", connect: vi.fn(), disconnect: vi.fn() }; }
  createDelay() { return { delayTime: makeParam(), connect: vi.fn(), disconnect: vi.fn() }; }
  createConvolver() { return { buffer: null, connect: vi.fn(), disconnect: vi.fn() }; }
  createConstantSource() { return { offset: makeParam(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; }
  createChannelMerger() { return { connect: vi.fn(), disconnect: vi.fn() }; }
  createMediaStreamDestination() { return { stream: {} }; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
(window as unknown as Record<string, unknown>).AudioContext = MockAudioContext;
(window as unknown as Record<string, unknown>).webkitAudioContext = MockAudioContext;

const store: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  },
  writable: true, configurable: true,
});

const { AudioPort } = await import("../engine/AudioPort");

type Priv = {
  fxOutput: { connect: ReturnType<typeof vi.fn> };
  lowCutFilter: { type: string } | null;
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("setLowCut rebuild bookkeeping", () => {
  it("rewires the filter when re-enabled after a rebuild happened while bypassed", () => {
    const port = new AudioPort();
    const priv = port as unknown as Priv;

    port.setLowCut(100);            // enable — creates filter, schedules rebuild
    vi.advanceTimersByTime(50);     // rewire runs, filter wired
    port.setLowCut(0);              // bypass (allpass)
    port.setAntiClipMode("limiter"); // any rebuild while bypassed unwires the filter
    vi.advanceTimersByTime(50);

    priv.fxOutput.connect.mockClear();
    port.setLowCut(120);            // re-enable — must trigger a rewire
    vi.advanceTimersByTime(50);

    const wired = priv.fxOutput.connect.mock.calls.some(c => c[0] === priv.lowCutFilter);
    expect(wired).toBe(true);
    expect(port.getLowCut()).toBe(120);
    port.close();
  });
});
