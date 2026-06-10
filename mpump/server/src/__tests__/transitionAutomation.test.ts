/**
 * Song-transition automation tests — the 1s AudioPort heartbeat must not
 * cancel in-flight channel-bus gain ramps (transitionFade lasts ~2 bars),
 * and the breakdown transition must schedule its automation AFTER the scene
 * mixer is applied, or loadScene→setChannelVolume cancels it instantly.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Engine } from "../engine/Engine";
import type { SongScene } from "../types";

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

type Bus = { gain: { value: number; cancelScheduledValues: ReturnType<typeof vi.fn>; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> } };
type Priv = { getChannelBus(ch: number): Bus; ctx: { currentTime: number } };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("heartbeat vs scheduled ramps", () => {
  it("does not cancel a channel bus ramp that is still in flight", () => {
    const port = new AudioPort();
    const bus = (port as unknown as Priv).getChannelBus(9);
    port.transitionFade({ 9: 0.2 }, 4); // 4s fade scheduled at ctx time 0
    const cancelsAfterFade = bus.gain.cancelScheduledValues.mock.calls.length;

    vi.advanceTimersByTime(2100); // two heartbeats while the fade is in flight
    expect(bus.gain.cancelScheduledValues.mock.calls.length).toBe(cancelsAfterFade);
    port.close();
  });

  it("resumes flushing the bus timeline after the ramp window ends", () => {
    const port = new AudioPort();
    const bus = (port as unknown as Priv).getChannelBus(9);
    port.transitionFade({ 9: 0.2 }, 4);
    const cancelsAfterFade = bus.gain.cancelScheduledValues.mock.calls.length;

    (port as unknown as Priv).ctx.currentTime = 5; // past the ramp end
    vi.advanceTimersByTime(1100); // next heartbeat
    expect(bus.gain.cancelScheduledValues.mock.calls.length).toBeGreaterThan(cancelsAfterFade);
    port.close();
  });
});

describe("breakdown transition ordering", () => {
  it("applies the scene mixer before scheduling breakdown automation", () => {
    const engine = new Engine(null, { onStateChange: () => {}, onStep: () => {}, onCatalogChange: () => {} });
    const calls: string[] = [];
    const eng = engine as unknown as {
      audioPort: unknown;
      emitStateNow: () => void;
      applyTransition(type: string, scene: SongScene): void;
    };
    eng.audioPort = {
      transitionBreakdown: () => calls.push("breakdown"),
      loadScene: () => calls.push("loadScene"),
      setBpm: () => {},
      setSynthParams: () => {},
    };
    eng.emitStateNow = () => {};
    const scene: SongScene = {
      id: "sc_test", name: "t", devices: {},
      mixer: { volumes: {}, pans: {}, chEQ: {}, masterEQ: { low: 0, mid: 0, high: 0 }, drive: 0, width: 0.5, lowCut: 0, mbOn: false, mbAmount: 0.25 },
      bpm: 120,
    };
    eng.applyTransition("breakdown", scene);
    expect(calls).toEqual(["loadScene", "breakdown"]);
  });
});
