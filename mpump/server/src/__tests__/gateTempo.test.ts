/**
 * Trance gate tempo tests — gate LFO rate and pattern step duration are
 * derived from the BPM at creation time; setBpm must re-derive them or the
 * gate chops drift off-tempo after a tempo change.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  channelGates: Map<number, { lfo: { frequency: { value: number } } | null }>;
  polySynth: { port: { postMessage: ReturnType<typeof vi.fn> } } | null;
};

let port: InstanceType<typeof AudioPort>;
beforeEach(() => {
  port = new AudioPort();
});

describe("trance gate tempo updates", () => {
  it("re-derives Web Audio LFO gate rate on setBpm", () => {
    // No worklet in this mock — gate runs on the Web Audio node path
    port.setChannelGate(0, true, "1/8", 1, "square");
    const f120 = (port as unknown as Priv).channelGates.get(0)!.lfo!.frequency.value;
    port.setBpm(240);
    const f240 = (port as unknown as Priv).channelGates.get(0)!.lfo!.frequency.value;
    expect(f240).toBeCloseTo(f120 * 2, 5);
    port.close();
  });

  it("re-sends worklet gate LFO rate on setBpm", () => {
    const postMessage = vi.fn();
    (port as unknown as Priv).polySynth = { port: { postMessage } };
    port.setChannelGate(0, true, "1/8", 1, "square");
    const before = postMessage.mock.calls.filter(c => c[0].type === "gate_pattern");
    expect(before.length).toBe(1);
    const rate120 = before[0][0].lfoRate;

    port.setBpm(240);
    const after = postMessage.mock.calls.filter(c => c[0].type === "gate_pattern");
    expect(after.length).toBe(2);
    expect(after[1][0].lfoRate).toBeCloseTo(rate120 * 2, 5);
    port.close();
  });
});
