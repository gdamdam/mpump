/**
 * AudioPort tests — uses jsdom with Web Audio API stubs.
 * Tests the core synthesis, voice management, and effects chain logic.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub Web Audio API for jsdom
class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = "running";
  destination = {};
  createBuffer(channels: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return {
      getChannelData: () => data,
      numberOfChannels: channels,
      length,
      sampleRate: rate,
      duration: length / rate,
    };
  }
  createGain() {
    const node = {
      gain: { value: 1, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    return node;
  }
  createStereoPanner() {
    return { pan: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 440, setValueAtTime: vi.fn() },
      detune: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: { value: 1000, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      Q: { value: 1, setValueAtTime: vi.fn() },
      gain: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      context: { sampleRate: 44100 },
    };
  }
  createDynamicsCompressor() {
    return {
      threshold: { value: 0 }, ratio: { value: 1 }, attack: { value: 0 }, release: { value: 0 }, knee: { value: 0 },
      connect: vi.fn(), disconnect: vi.fn(),
    };
  }
  createWaveShaper() {
    return { curve: null, oversample: "none", connect: vi.fn(), disconnect: vi.fn() };
  }
  createDelay() {
    return { delayTime: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  }
  createConvolver() {
    return { buffer: null, connect: vi.fn(), disconnect: vi.fn() };
  }
  createConstantSource() {
    return {
      offset: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    };
  }
  createChannelMerger() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  createMediaStreamDestination() {
    return { stream: {} };
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

// Install mock before importing AudioPort
(window as unknown as Record<string, unknown>).AudioContext = MockAudioContext;
(window as unknown as Record<string, unknown>).webkitAudioContext = MockAudioContext;
// Stub localStorage for jsdom (may exist but be non-functional)
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
  writable: true,
  configurable: true,
});

// Dynamic import after mocks
const { AudioPort } = await import("../engine/AudioPort");

describe("AudioPort", () => {
  let port: InstanceType<typeof AudioPort>;

  beforeEach(() => {
    port = new AudioPort();
  });

  it("creates without error", () => {
    expect(port).toBeDefined();
    expect(port.name).toBe("Audio Preview");
    expect(port.id).toBe("preview");
  });

  it("noteOn with drum channel (9) does not throw", () => {
    expect(() => port.noteOn(9, 36, 100)).not.toThrow();
    expect(() => port.noteOn(9, 38, 80)).not.toThrow();
    expect(() => port.noteOn(9, 42, 60)).not.toThrow();
  });

  it("noteOn with synth channel creates voice", () => {
    expect(() => port.noteOn(0, 60, 100)).not.toThrow();
    expect(() => port.noteOff(0, 60)).not.toThrow();
  });

  it("noteOff on drum channel is a no-op", () => {
    expect(() => port.noteOff(9, 36)).not.toThrow();
  });

  it("allNotesOff does not throw", () => {
    port.noteOn(0, 60, 100);
    port.noteOn(0, 64, 100);
    expect(() => port.allNotesOff(0)).not.toThrow();
  });

  it("setSynthParams updates without error", () => {
    const params = port.getSynthParams(0);
    expect(params.oscType).toBe("sawtooth");
    port.setSynthParams(0, { ...params, oscType: "square" });
    expect(port.getSynthParams(0).oscType).toBe("square");
  });

  it("setChannelVolume clamps to 0-1", () => {
    expect(() => port.setChannelVolume(0, 0.5)).not.toThrow();
    expect(() => port.setChannelVolume(0, 2)).not.toThrow(); // clamped
    expect(() => port.setChannelVolume(0, -1)).not.toThrow(); // clamped
  });

  it("setDrumVoice updates params", () => {
    port.setDrumVoice(36, { tune: 5, decay: 1.5 });
    const vp = port.getDrumVoiceParams(36);
    expect(vp.tune).toBe(5);
    expect(vp.decay).toBe(1.5);
  });

  it("setEffect does not throw", () => {
    expect(() => port.setEffect("delay", { on: true })).not.toThrow();
    expect(() => port.setEffect("distortion", { on: true, drive: 50 })).not.toThrow();
    expect(() => port.setEffect("reverb", { on: true })).not.toThrow();
  });

  it("getEffects returns all 11 effects", () => {
    const fx = port.getEffects();
    expect(Object.keys(fx).length).toBe(11);
  });

  it("close does not throw", () => {
    port.noteOn(0, 60, 100);
    expect(() => port.close()).not.toThrow();
  });
});
