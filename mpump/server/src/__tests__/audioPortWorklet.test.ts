/**
 * Poly-synth worklet loading tests — the poly-synth worklet is the only
 * synth/bass playback path (playSynth has no standard-node fallback), so it
 * must load in eco mode too, notes scheduled before the async load resolves
 * must not be dropped, and addModule failure must be handled gracefully.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Web Audio stubs (minimal subset used by AudioPort) ────────────────────
function makeParam() {
  return { value: 1, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
}

let addModuleImpl: () => Promise<void> = () => Promise.resolve();

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = "running";
  destination = {};
  audioWorklet = { addModule: vi.fn(() => addModuleImpl()) };
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

class MockAudioWorkletNode {
  port = { postMessage: vi.fn(), onmessage: null };
  parameters = { get: () => ({ value: 0 }) };
  connect = vi.fn();
  disconnect = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_ctx: unknown, _name: string, _opts?: unknown) {}
}

(window as unknown as Record<string, unknown>).AudioContext = MockAudioContext;
(window as unknown as Record<string, unknown>).webkitAudioContext = MockAudioContext;
(window as unknown as Record<string, unknown>).AudioWorkletNode = MockAudioWorkletNode;
(globalThis as unknown as Record<string, unknown>).AudioWorkletNode = MockAudioWorkletNode;

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

const { AudioPort } = await import("../engine/AudioPort");

type Priv = { polySynth: { port: { postMessage: ReturnType<typeof vi.fn> } } | null };
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  localStorage.clear();
  addModuleImpl = () => Promise.resolve();
});

describe("AudioPort poly-synth worklet loading", () => {
  it("loads the poly-synth worklet in eco mode (synth/bass have no other path)", async () => {
    localStorage.setItem("mpump-perf-mode", "eco");
    const port = new AudioPort();
    await flush();
    expect((port as unknown as Priv).polySynth).not.toBeNull();
    port.close();
  });

  it("queues notes that arrive before the worklet is ready and flushes them", async () => {
    // Defer only the first addModule call (poly-synth loads first); the
    // optional modules that follow resolve immediately.
    let resolveLoad!: () => void;
    let first = true;
    addModuleImpl = () => {
      if (first) { first = false; return new Promise<void>(r => { resolveLoad = r; }); }
      return Promise.resolve();
    };
    const port = new AudioPort();
    port.noteOn(0, 60, 100); // worklet not ready yet — must not be dropped
    expect((port as unknown as Priv).polySynth).toBeNull();

    resolveLoad();
    await flush();
    const node = (port as unknown as Priv).polySynth;
    expect(node).not.toBeNull();
    const noteOns = node!.port.postMessage.mock.calls.filter(c => c[0].type === "noteOn");
    expect(noteOns.length).toBe(1);
    expect(noteOns[0][0].note).toBe(60);
    port.close();
  });

  it("handles addModule failure gracefully (no throw, no unbounded queue)", async () => {
    addModuleImpl = () => Promise.reject(new Error("load failed"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const port = new AudioPort();
    await flush();
    expect((port as unknown as Priv).polySynth).toBeNull();
    expect(() => port.noteOn(0, 60, 100)).not.toThrow();
    expect((port as unknown as { pendingSynthNotes: unknown[] }).pendingSynthNotes.length).toBe(0);
    errSpy.mockRestore();
    port.close();
  });
});
