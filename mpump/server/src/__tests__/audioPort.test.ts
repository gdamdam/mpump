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

// ── FX group routing (Option 1+ per-channel exclude chains) ──────────────
// Exercises computeFxGroups / routeSourcesToGroups directly. These are private,
// but the group-partition logic is the load-bearing piece — regressions here
// silently mis-route audio (see the drum-doubling bug in v1.10.5).
describe("AudioPort FX groups", () => {
  let port: InstanceType<typeof AudioPort>;

  type Priv = {
    computeFxGroups(): { patternKey: string; sourceKeys: string[]; activeEffects: string[] }[];
    rebuildFxChain(): void;
    sourceFxTarget: Map<string, unknown>;
    mbExcludeDrums: boolean;
  };
  const priv = (p: typeof port) => p as unknown as Priv;

  beforeEach(() => {
    port = new AudioPort();
  });

  it("default state: no effects on → groups have empty activeEffects", () => {
    const groups = priv(port).computeFxGroups();
    // MB-bypassed drums by default → drums not in FX sources; synth/bass remain
    expect(groups.every(g => g.activeEffects.length === 0)).toBe(true);
    expect(groups.flatMap(g => g.sourceKeys).sort()).toEqual(["bass", "synth"]);
  });

  it("MB-bypassed drums are NOT in FX groups (prevents drum-doubling bug)", () => {
    // mbExcludeDrums defaults to true
    expect(priv(port).mbExcludeDrums).toBe(true);
    port.setEffect("reverb", { on: true });
    const groups = priv(port).computeFxGroups();
    const allSources = groups.flatMap(g => g.sourceKeys);
    expect(allSources).not.toContain("drums");
  });

  it("unbypass MB drums: drums joins FX groups", () => {
    port.setMbExclude("drums", false);
    port.setEffect("reverb", { on: true });
    const groups = priv(port).computeFxGroups();
    const allSources = groups.flatMap(g => g.sourceKeys);
    expect(allSources).toContain("drums");
  });

  it("reverb on, no excludes → single group containing all active sources", () => {
    port.setMbExclude("drums", false); // include drums in FX path
    port.setEffect("reverb", { on: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(1);
    expect(groups[0].activeEffects).toEqual(["reverb"]);
    expect(groups[0].sourceKeys.sort()).toEqual(["bass", "drums", "synth"]);
    expect(groups[0].patternKey).toBe("0");
  });

  it("reverb + excludeSynth → synth splits into its own group without reverb", () => {
    port.setMbExclude("drums", false);
    port.setEffect("reverb", { on: true, excludeSynth: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(2);

    const synthGroup = groups.find(g => g.sourceKeys.includes("synth"))!;
    const otherGroup = groups.find(g => !g.sourceKeys.includes("synth"))!;
    expect(synthGroup.activeEffects).toEqual([]); // synth bypasses reverb
    expect(otherGroup.activeEffects).toEqual(["reverb"]);
    expect(otherGroup.sourceKeys.sort()).toEqual(["bass", "drums"]);
  });

  it("multiple effects, one excludes synth → synth still gets the others", () => {
    port.setMbExclude("drums", false);
    port.setEffect("distortion", { on: true });
    port.setEffect("reverb", { on: true, excludeSynth: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(2);

    const synthGroup = groups.find(g => g.sourceKeys.includes("synth"))!;
    // synth gets distortion but not reverb
    expect(synthGroup.activeEffects).toEqual(["distortion"]);

    const otherGroup = groups.find(g => !g.sourceKeys.includes("synth"))!;
    // drums+bass get both
    expect(otherGroup.activeEffects.sort()).toEqual(["distortion", "reverb"]);
  });

  it("each source in its own group when all three have divergent patterns", () => {
    port.setMbExclude("drums", false);
    port.setEffect("reverb",    { on: true, excludeSynth: true });
    port.setEffect("delay",     { on: true, excludeBass: true });
    port.setEffect("distortion", { on: true, excludeDrums: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(3);
    // Each group has exactly one source
    for (const g of groups) expect(g.sourceKeys.length).toBe(1);
  });

  it("turning excludes off: groups re-merge", () => {
    port.setMbExclude("drums", false);
    port.setEffect("reverb", { on: true, excludeSynth: true });
    expect(priv(port).computeFxGroups().length).toBe(2);
    port.setEffect("reverb", { excludeSynth: false });
    expect(priv(port).computeFxGroups().length).toBe(1);
  });

  it("rebuildFxChain populates sourceFxTarget for every non-MB-bypassed source", () => {
    // Trigger channel creation — worklet stub isn't used in jsdom, so noteOn
    // doesn't hit the native synth path. Use setChannelEQ, which falls through
    // to getChannelBus on first call.
    port.setChannelEQ(0, 0, 0, 0);
    port.setChannelEQ(1, 0, 0, 0);
    port.setChannelEQ(9, 0, 0, 0);

    port.setMbExclude("drums", false);
    port.setEffect("reverb", { on: true });
    priv(port).rebuildFxChain();
    const targets = priv(port).sourceFxTarget;
    expect(targets.has("synth")).toBe(true);
    expect(targets.has("bass")).toBe(true);
    expect(targets.has("drums")).toBe(true);
  });

  it("rebuildFxChain does NOT route drums when MB-bypassed", () => {
    port.noteOn(0, 60, 100);
    port.noteOn(1, 60, 100);
    port.noteOn(9, 36, 100);
    // default mbExcludeDrums = true
    port.setEffect("reverb", { on: true });
    priv(port).rebuildFxChain();
    const targets = priv(port).sourceFxTarget;
    // drums is MB-bypassed — should not appear in FX target map
    expect(targets.has("drums")).toBe(false);
  });
});

// ── Worklet-active synth/bass split (Option B) ───────────────────────────
// In a real browser the poly-synth worklet is ALWAYS present (it's the only
// synth/bass path), so synth+bass share one output and can be routed apart
// only when an effect's excludeSynth differs from excludeBass. jsdom has no
// worklet, so the other describe blocks exercise the non-worklet path. Here we
// fake the worklet's presence to cover the production routing CI otherwise
// never reaches — the path where the old exclude buttons silently no-op'd.
describe("AudioPort synth/bass split (worklet active)", () => {
  let port: InstanceType<typeof AudioPort>;

  type Priv = {
    computeFxGroups(): { patternKey: string; sourceKeys: string[]; activeEffects: string[] }[];
    synthBassNeedsSplit(active: string[]): boolean;
    polySynth: unknown;
    mbExcludeDrums: boolean;
  };
  const priv = (p: typeof port) => p as unknown as Priv;

  beforeEach(() => {
    port = new AudioPort();
    // Stub worklet node: presence flips workletActive=true; the no-op port/
    // connect/disconnect keep the debounced rebuildFxChain harmless in jsdom.
    priv(port).polySynth = { port: { postMessage() {} }, connect() {}, disconnect() {} };
  });

  it("no excludes → synth and bass stay merged as a single source", () => {
    port.setEffect("reverb", { on: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(1);
    expect(groups[0].sourceKeys).toEqual(["synthBass"]);
    expect(groups[0].activeEffects).toEqual(["reverb"]);
  });

  it("excludeSynth only → splits; synth bypasses the effect, bass keeps it", () => {
    port.setEffect("reverb", { on: true, excludeSynth: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(2);
    const synth = groups.find(g => g.sourceKeys.includes("synth"))!;
    const bass = groups.find(g => g.sourceKeys.includes("bass"))!;
    expect(synth.sourceKeys).toEqual(["synth"]);
    expect(synth.activeEffects).toEqual([]);
    expect(bass.sourceKeys).toEqual(["bass"]);
    expect(bass.activeEffects).toEqual(["reverb"]);
  });

  it("excludeBass only → bass splits out, synth keeps the effect", () => {
    port.setEffect("delay", { on: true, excludeBass: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(2);
    const synth = groups.find(g => g.sourceKeys.includes("synth"))!;
    const bass = groups.find(g => g.sourceKeys.includes("bass"))!;
    expect(synth.activeEffects).toEqual(["delay"]);
    expect(bass.activeEffects).toEqual([]);
  });

  it("excludeSynth AND excludeBass → no split (both leave the effect together)", () => {
    port.setEffect("reverb", { on: true, excludeSynth: true, excludeBass: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(1);
    expect(groups[0].sourceKeys).toEqual(["synthBass"]);
    expect(groups[0].activeEffects).toEqual([]);
  });

  it("synthBassNeedsSplit only when excludeSynth differs from excludeBass", () => {
    expect(priv(port).synthBassNeedsSplit([])).toBe(false);
    port.setEffect("reverb", { on: true, excludeSynth: true });
    expect(priv(port).synthBassNeedsSplit(["reverb"])).toBe(true);
    port.setEffect("reverb", { on: true, excludeSynth: true, excludeBass: true });
    expect(priv(port).synthBassNeedsSplit(["reverb"])).toBe(false);
  });

  it("split with drums un-bypassed → drums group with the non-excluded instrument", () => {
    port.setMbExclude("drums", false);
    port.setEffect("reverb", { on: true, excludeSynth: true });
    const groups = priv(port).computeFxGroups();
    expect(groups.length).toBe(2);
    const synth = groups.find(g => g.sourceKeys.includes("synth"))!;
    expect(synth.sourceKeys).toEqual(["synth"]);
    expect(synth.activeEffects).toEqual([]);
    const other = groups.find(g => !g.sourceKeys.includes("synth"))!;
    expect(other.sourceKeys.sort()).toEqual(["bass", "drums"]);
    expect(other.activeEffects).toEqual(["reverb"]);
  });
});
