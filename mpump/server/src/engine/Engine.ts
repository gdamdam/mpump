/**
 * Engine.ts — Browser sequencer orchestrator.
 *
 * Manages the full lifecycle of USB MIDI devices detected via the Web MIDI API:
 *   1. Hot-plug detection: listens for statechange events on MIDIAccess
 *   2. Sequencer management: creates/destroys Sequencer or T8Sequencer per device
 *   3. State management: tracks genre/pattern/key/octave/edit state per device
 *   4. Sync: all sequencers start at the next bar boundary from a shared t0
 *   5. Persistence: user-edited patterns are saved/loaded from localStorage
 *
 * Data-driven — any device in DEVICE_REGISTRY is automatically supported.
 * The UI communicates via EngineCallbacks (onStateChange, onStep, onCatalogChange).
 */

import type { StepData, DrumHit, EngineState, Catalog, DeviceState, SynthParams, EffectName, EffectParams, DrumVoiceParams, SongScene, SongArrangementEntry, SongPlaybackState, SongState, TransitionType } from "../types";
import { DEFAULT_SYNTH_PARAMS } from "../types";
import type { MidiPort } from "./MidiPort";
import { AudioPort } from "./AudioPort";
import { SYNTH_PRESETS, BASS_PRESETS, DRUM_KIT_PRESETS } from "../data/soundPresets";
import { SAMPLE_PACKS } from "../data/samplePacks";
import { MidiClock } from "./MidiClock";
import { Sequencer } from "./Sequencer";
import { T8Sequencer } from "./T8Sequencer";
import { type DetectedPorts, detectPorts } from "./MidiAccess";
import { getMelodicPattern, getDrumPattern, getBassPattern } from "../data/patterns";
import { loadCatalog, getDeviceGenres, getDeviceBassGenres, getExtrasKey, getBassExtrasKey, getMelodicSource, type LoadedCatalog } from "../data/catalog";
import { DEVICE_REGISTRY, findDeviceConfig, type DeviceConfig } from "../data/devices";
import { parseKey } from "../data/keys";
import { loadExtras, saveExtras } from "./ExtrasStore";
import { MidiClockReceiver } from "./MidiClockReceiver";

/** Callbacks the Engine uses to notify the React UI of changes. */
export interface EngineCallbacks {
  onStateChange: (state: EngineState) => void;
  onStep: (device: string, step: number) => void;
  onCatalogChange: (catalog: Catalog) => void;
  onSongStateChange?: (state: SongState) => void;
}

// ── Per-device internal state (not exported to UI) ───────────────────────

/** Tracks all mutable state for a single device (genre, pattern, edits, etc.) */
interface InternalDeviceState {
  config: DeviceConfig;
  genreIdx: number;
  patternIdx: number;
  bassGenreIdx: number;
  bassPatternIdx: number;
  keyIdx: number;
  octave: number;
  step: number;
  connected: boolean;
  paused: boolean;
  patternLength: 1 | 2 | 3 | 4 | 8 | 16 | 32;
  melodicEdit: (StepData | null)[] | null;
  drumEdit: DrumHit[][] | null;
  bassEdit: (StepData | null)[] | null;
  bassMuted: boolean;
  drumsMuted: boolean;
  deviceVolume: number;
  synthParams: SynthParams;
  bassSynthParams: SynthParams;
  undoStack: { melodic: (StepData | null)[] | null; drum: DrumHit[][] | null; bass: (StepData | null)[] | null }[];
  chainEnabled: boolean;
  chainPatternIdx: number;
  chainCycle: number; // 0 = pattern A, 1 = pattern B
}

/**
 * Orchestrator: manages device lifecycle, sequencers, clocks, state, and edits.
 * Data-driven — supports any device in the DEVICE_REGISTRY.
 */
export class Engine {
  private access: MIDIAccess | null;
  private cb: EngineCallbacks;
  private data!: LoadedCatalog;

  bpm = 120;
  swing = 0.5;

  // Per-device state
  private deviceStates: Map<string, InternalDeviceState> = new Map();

  // Active sequencers/clocks
  private sequencers: Map<string, Sequencer | T8Sequencer> = new Map();
  private clocks: Map<string, MidiClock> = new Map();
  private ports: DetectedPorts = {};
  private stopped: Set<string> = new Set();

  // Audio preview
  private audioPort: AudioPort | null = null;

  // MIDI clock sync
  private midiClockReceiver: MidiClockReceiver;

  // Global step grid origin
  private t0: number = performance.now();

  // Throttled state emission — collapses rapid parameter changes into one React update
  private stateTimer = 0;
  private stateScheduled = false;
  private readonly _ric = typeof requestIdleCallback === "function";
  private emitState(): void {
    this.markDirty();
    if (this.stateScheduled) return;
    this.stateScheduled = true;
    // Defer to idle callback when available — avoids competing with audio scheduler
    this.stateTimer = window.setTimeout(() => {
      this.stateScheduled = false;
      if (this._ric) {
        requestIdleCallback(() => this.cb.onStateChange(this.getState()), { timeout: 200 });
      } else {
        this.cb.onStateChange(this.getState());
      }
    }, 100); // 100ms debounce — imperceptible, reduces GC pressure
  }
  /** Emit state immediately (for actions that need instant UI feedback). */
  private emitStateNow(): void {
    this.markDirty();
    if (this.stateScheduled) {
      clearTimeout(this.stateTimer);
      this.stateScheduled = false;
    }
    this.cb.onStateChange(this.getState());
  }

  // ── Song mode state ──────────────────────────────────────────────────
  private songScenes: SongScene[] = [];
  private songArrangement: SongArrangementEntry[] = [];
  private songPlaying = false;
  private songLoop = true;
  private songCurrentIdx = 0;
  private songBarCounter = 0;
  /** Device ID that drives the song bar counter (first device at step 0). */
  private songDriverDevice = "preview_drums";

  // Visibility handling
  private visHandler: (() => void) | null = null;
  private unloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  constructor(access: MIDIAccess | null, callbacks: EngineCallbacks) {
    this.access = access;
    this.cb = callbacks;

    this.midiClockReceiver = new MidiClockReceiver({
      onStep: () => this.advanceAllSequencers(),
      onBpmDetected: (bpm) => {
        this.bpm = bpm;
        for (const [, seq] of this.sequencers) seq.setBpm(bpm);
        for (const [, clk] of this.clocks) clk.setBpm(bpm);
        if (this.audioPort) this.audioPort.setBpm(bpm);
        this.emitState();
      },
      onStart: () => {
        for (const [, seq] of this.sequencers) { seq.stop(); seq.start(); }
      },
      onContinue: () => {
        for (const [, seq] of this.sequencers) {
          if (!(seq as any).running) seq.start();
        }
      },
      onStop: () => {
        for (const [, seq] of this.sequencers) seq.stop();
        this.emitState();
      },
    });

    // Initialize state for every registered device
    for (const config of DEVICE_REGISTRY) {
      this.deviceStates.set(config.id, {
        config,
        genreIdx: 0, patternIdx: 0,
        bassGenreIdx: 0, bassPatternIdx: 0,
        keyIdx: 0, octave: 2,
        step: -1, connected: false, paused: false,
        patternLength: 16,
        melodicEdit: null, drumEdit: null, bassEdit: null,
        bassMuted: false,
        drumsMuted: false,
        deviceVolume: 1,
        synthParams: { ...DEFAULT_SYNTH_PARAMS },
        bassSynthParams: { ...DEFAULT_SYNTH_PARAMS },
        undoStack: [],
        chainEnabled: false, chainPatternIdx: 0, chainCycle: 0,
      });
    }
  }

  async init(): Promise<void> {
    this.data = await loadCatalog();
    this.t0 = performance.now();

    // Hot-plug detection (only when we have real MIDI access)
    if (this.access) {
      this.access.onstatechange = () => this.handleDeviceChange();
      this.handleDeviceChange();
    }

    // Visibility change: pause when hidden, resume when visible
    this.visHandler = () => {
      if (document.hidden) {
        this.pauseAll();
      } else {
        this.resumeAll();
      }
    };
    document.addEventListener("visibilitychange", this.visHandler);

    // Before unload: all notes off
    this.unloadHandler = () => this.shutdown();
    window.addEventListener("beforeunload", this.unloadHandler);

    // Broadcast initial state + catalog
    this.cb.onCatalogChange(this.getCatalog());
    this.emitStateNow();
  }

  shutdown(): void {
    for (const [, seq] of this.sequencers) seq.stop();
    for (const [, clk] of this.clocks) clk.stop();
    this.sequencers.clear();
    this.clocks.clear();

    // Send allNotesOff on all known ports
    for (const port of Object.values(this.ports)) {
      if (port) {
        for (let ch = 0; ch < 16; ch++) port.allNotesOff(ch);
      }
    }

    if (this.audioPort) {
      this.audioPort.close();
      this.audioPort = null;
    }

    if (this.visHandler) document.removeEventListener("visibilitychange", this.visHandler);
    if (this.unloadHandler) window.removeEventListener("beforeunload", this.unloadHandler);
  }

  // ── Device detection ─────────────────────────────────────────────────

  private handleDeviceChange(): void {
    if (!this.access) return;
    const newPorts = detectPorts(this.access);

    for (const [id, ds] of this.deviceStates) {
      const wasConnected = ds.connected;
      const isConnected = id in newPorts;

      if (!wasConnected && isConnected && !this.stopped.has(id)) {
        // New device — start
        this.ports[id] = newPorts[id];
        ds.connected = true;
        this.startDevice(id);
      } else if (wasConnected && !isConnected) {
        // Device removed — stop
        this.stopDevice(id);
        delete this.ports[id];
        ds.connected = false;
        ds.step = -1;
      } else if (isConnected) {
        // Still connected — update port ref
        this.ports[id] = newPorts[id];
      }
    }

    this.emitStateNow();
  }

  // ── Audio preview ───────────────────────────────────────────────────

  private static PREVIEW_IDS = ["preview_drums", "preview_bass", "preview_synth"];

  /** Curated genre combos for preview start (same genre across all devices). */
  // Curated first-load combos: genre + BPM + preset names that sound good together.
  // "weight" controls how likely this combo is picked (higher = more likely).
  // High-weight combos are crowd-pleasers for first impressions.
  private static CURATED_STARTS: { genre: string; bpm: number; synth?: string; bass?: string; kit?: string; weight: number }[] = [
    // High weight — these sound great on first listen
    { genre: "techno", bpm: 130, synth: "Classic Saw", bass: "Acid Bass", kit: "Techno", weight: 3 },
    { genre: "techno", bpm: 132, synth: "Classic Saw", bass: "Acid Bass", kit: "pack:909", weight: 2 },
    { genre: "house", bpm: 124, synth: "House Stab", bass: "Pluck Bass", kit: "House", weight: 3 },
    { genre: "house", bpm: 122, synth: "House Stab", bass: "Pluck Bass", kit: "pack:909", weight: 1 },
    { genre: "trance", bpm: 140, synth: "Supersaw", bass: "Deep Sub", kit: "Trance", weight: 3 },
    { genre: "trance", bpm: 138, synth: "Supersaw", bass: "Deep Sub", kit: "pack:909", weight: 1 },
    { genre: "acid-techno", bpm: 138, synth: "Acid Squelch", bass: "303 Acid", kit: "Default", weight: 2 },
    { genre: "acid-techno", bpm: 136, synth: "Acid Squelch", bass: "303 Acid", kit: "pack:606", weight: 1 },
    { genre: "electro", bpm: 128, synth: "Square Lead", bass: "Square Bass", kit: "Electro", weight: 2 },
    { genre: "electro", bpm: 125, synth: "Square Lead", bass: "Square Bass", kit: "pack:drumulator", weight: 2 },
    { genre: "electro", bpm: 126, synth: "Square Lead", bass: "Square Bass", kit: "pack:dmx", weight: 1 },
    { genre: "deep-house", bpm: 122, synth: "Warm Pad", bass: "Warm Bass", kit: "House", weight: 2 },
    { genre: "synthwave", bpm: 118, synth: "Supersaw", bass: "Arp Bass", kit: "Default", weight: 2 },
    { genre: "synthwave", bpm: 116, synth: "Supersaw", bass: "Arp Bass", kit: "pack:linn", weight: 1 },
    { genre: "synthwave", bpm: 120, synth: "Supersaw", bass: "Arp Bass", kit: "pack:drumulator", weight: 1 },
    // Normal weight — solid but more niche
    { genre: "dub-techno", bpm: 118, synth: "Dark Drone", bass: "Deep Sub", kit: "Dub", weight: 1 },
    { genre: "breakbeat", bpm: 140, synth: "Classic Saw", bass: "Pluck Bass", kit: "DnB", weight: 1 },
    { genre: "breakbeat", bpm: 138, synth: "Classic Saw", bass: "Pluck Bass", kit: "pack:dmx", weight: 1 },
    { genre: "garage", bpm: 132, synth: "House Stab", bass: "Garage Bass", kit: "Garage", weight: 1 },
    { genre: "garage", bpm: 130, synth: "House Stab", bass: "Garage Bass", kit: "pack:707", weight: 1 },
    { genre: "dubstep", bpm: 140, synth: "Neuro", bass: "Wobble", kit: "Heavy", weight: 1 },
    { genre: "psytrance", bpm: 145, synth: "Supersaw", bass: "Psy Bass", kit: "Trance", weight: 1 },
    { genre: "downtempo", bpm: 95, synth: "Warm Pad", bass: "Warm Bass", kit: "Lo-Fi", weight: 1 },
    { genre: "downtempo", bpm: 90, synth: "Warm Pad", bass: "Warm Bass", kit: "pack:cr78", weight: 1 },
    { genre: "lo-fi", bpm: 80, synth: "Rhodes Keys", bass: "Deep Sub", kit: "Lo-Fi", weight: 1 },
    { genre: "lo-fi", bpm: 78, synth: "Rhodes Keys", bass: "Deep Sub", kit: "pack:cr78", weight: 1 },
    { genre: "idm", bpm: 135, synth: "FM Bell", bass: "Zapper", kit: "Glitch", weight: 1 },
    { genre: "ambient", bpm: 90, synth: "String Pad", bass: "Foghorn", kit: "Dub", weight: 1 },
    { genre: "glitch", bpm: 130, synth: "FM Bell", bass: "Distorted", kit: "Glitch", weight: 1 },
    { genre: "jungle", bpm: 170, synth: "Classic Saw", bass: "Reese", kit: "DnB", weight: 1 },
    { genre: "drum-and-bass", bpm: 174, synth: "Neuro", bass: "Reese", kit: "DnB", weight: 1 },
    { genre: "edm", bpm: 128, synth: "EDM Pluck", bass: "Pluck Bass", kit: "Default", weight: 1 },
    { genre: "edm", bpm: 126, synth: "EDM Pluck", bass: "Pluck Bass", kit: "pack:808", weight: 1 },
  ];

  /** Create AudioPort early (must be called synchronously during user gesture for Safari). */
  createAudioPort(): void {
    if (!this.audioPort) {
      try {
        this.audioPort = new AudioPort();
      } catch (e) {
        console.error("Failed to create AudioPort:", e);
      }
    }
  }

  /** Start both preview devices using synthesized audio (no MIDI needed). */
  async startPreview(skipRandomize = false): Promise<void> {
    if (!this.audioPort) {
      this.audioPort = new AudioPort();
    }
    await this.audioPort.resume();
    // Firefox may need a second resume after a short delay
    if ((this.audioPort as any).ctx?.state !== "running") {
      await new Promise(r => setTimeout(r, 100));
      await this.audioPort.resume();
    }
    const port = this.audioPort as unknown as MidiPort;

    for (const id of Engine.PREVIEW_IDS) {
      const ds = this.deviceStates.get(id);
      if (!ds) continue;
      ds.connected = true;
      this.ports[id] = port;
      // Apply synth params to AudioPort channels
      const cfg = ds.config;
      this.audioPort!.setSynthParams(cfg.channels.main, ds.synthParams);
      this.audioPort!.setPolySynthGate(cfg.channels.main, cfg.gateFraction);
      if (cfg.channels.bass !== undefined) {
        this.audioPort!.setSynthParams(cfg.channels.bass, ds.bassSynthParams);
        this.audioPort!.setPolySynthGate(cfg.channels.bass, cfg.gateFraction);
      }
    }

    if (!skipRandomize) {
      // Curated selection fades over sessions (by unique days), with a 40% floor:
      // day 1=100%, 2=80%, 3=60%, 4=50%, 5+=40% (always some chance of a good combo)
      const today = new Date().toISOString().slice(0, 10);
      const lastDay = localStorage.getItem("mpump-load-day") ?? "";
      let loadCount = parseInt(localStorage.getItem("mpump-load-count") ?? "0");
      if (today !== lastDay) { loadCount++; localStorage.setItem("mpump-load-count", String(loadCount)); localStorage.setItem("mpump-load-day", today); }
      const curateChance = Math.max(0.4, 1 - (loadCount - 1) * 0.2); // 1.0→0.8→0.6→0.5→0.4 floor
      const useCurated = Math.random() < curateChance;

      // Pick genre combo — weighted if curated, uniform if not
      let curated: typeof Engine.CURATED_STARTS[0];
      if (useCurated) {
        const totalWeight = Engine.CURATED_STARTS.reduce((s, c) => s + c.weight, 0);
        let roll = Math.random() * totalWeight;
        curated = Engine.CURATED_STARTS[0];
        for (const c of Engine.CURATED_STARTS) {
          roll -= c.weight;
          if (roll <= 0) { curated = c; break; }
        }
      } else {
        curated = Engine.CURATED_STARTS[Math.floor(Math.random() * Engine.CURATED_STARTS.length)];
      }
      this.bpm = curated.bpm;
      // Set state for all devices first, then stagger restarts to avoid concurrent teardown
      for (const id of Engine.PREVIEW_IDS) {
        const ds = this.deviceStates.get(id);
        if (!ds) continue;
        const genres = this.getDeviceGenres(id);
        const gi = genres.findIndex(g => g.name === curated.genre);
        if (gi >= 0) {
          ds.genreIdx = gi;
          ds.patternIdx = Math.floor(Math.random() * genres[gi].patterns.length);
        }
      }
      Engine.PREVIEW_IDS.forEach((id, i) => {
        if (i === 0) this.restartDevice(id);
        else setTimeout(() => this.restartDevice(id), i * 80);
      });

      // Use curated presets if in curated mode, otherwise fully random
      const findPreset = <T extends { name: string }>(list: T[], name?: string): T =>
        (useCurated && name && list.find(p => p.name === name)) || list[Math.floor(Math.random() * list.length)];
      const synthPreset = findPreset(SYNTH_PRESETS, curated.synth);
      const bassPreset = findPreset(BASS_PRESETS, curated.bass);
      const drumPreset = curated.kit?.startsWith("pack:")
        ? SAMPLE_PACKS.find(p => p.id === curated.kit!.slice(5)) ?? findPreset(DRUM_KIT_PRESETS, undefined)
        : findPreset(DRUM_KIT_PRESETS, curated.kit);

      const synthDs = this.deviceStates.get("preview_synth");
      if (synthDs) {
        synthDs.synthParams = { ...synthPreset.params };
        if (this.audioPort) this.audioPort.setSynthParams(synthDs.config.channels.main, synthDs.synthParams);
      }

      const bassDs = this.deviceStates.get("preview_bass");
      if (bassDs) {
        bassDs.synthParams = { ...bassPreset.params };
        if (this.audioPort) this.audioPort.setSynthParams(bassDs.config.channels.main, bassDs.synthParams);
      }

      const drumsDs = this.deviceStates.get("preview_drums");
      if (drumsDs) {
        for (const [note, params] of Object.entries(drumPreset.voices)) {
          this.audioPort?.setDrumVoice(Number(note), params);
        }
      }
    } else {
      // No randomization — just start devices with defaults
      for (const id of Engine.PREVIEW_IDS) {
        this.startDevice(id);
      }
    }

    this.emitStateNow();
    this.cb.onCatalogChange(this.getCatalog());
  }

  /** Stop all preview devices. */
  stopPreview(): void {
    for (const id of Engine.PREVIEW_IDS) {
      this.stopDevice(id);
      const ds = this.deviceStates.get(id);
      if (ds) {
        ds.connected = false;
        ds.step = -1;
      }
      delete this.ports[id];
    }
    if (this.audioPort) {
      this.audioPort.close();
      this.audioPort = null;
    }
    this.emitStateNow();
  }

  // ── Sequencer lifecycle ──────────────────────────────────────────────

  /**
   * Calculate the next bar boundary for phase-locked sequencer starts.
   * Returns a timestamp (ms) aligned to the global t0 grid.
   * If the boundary is less than 50ms away, skip to the next one.
   */
  private nextBarBoundary(numSteps = 16): number {
    const stepDur = 60000 / (this.bpm * 4);  // duration of one 16th note in ms
    const barDur = numSteps * stepDur;
    const now = performance.now();
    const elapsed = now - this.t0;
    const n = Math.ceil(elapsed / barDur);
    let tBar = this.t0 + n * barDur;
    if (tBar - now < 50) tBar += barDur;     // too close — skip to next bar
    return tBar;
  }

  /** Start a sequencer (+ optional MIDI clock) for a newly connected device. */
  private startDevice(id: string): void {
    const port = this.ports[id];
    const ds = this.deviceStates.get(id);
    if (!port || !ds) return;
    const config = ds.config;

    const tStart = this.nextBarBoundary(ds.patternLength);

    if (config.mode === "synth" || config.mode === "bass") {
      let pattern = ds.drumsMuted
        ? Array.from({ length: ds.patternLength }, (): null => null)
        : (ds.melodicEdit ?? this.getDeviceMelodicPattern(id));
      if (ds.patternLength === 32 && pattern.length === 16) {
        pattern = [...pattern, ...pattern];
      } else if (ds.patternLength < 16 && pattern.length > ds.patternLength) {
        pattern = pattern.slice(0, ds.patternLength);
      }
      const root = this.getDeviceRoot(id);

      const seq = new Sequencer({
        port, channel: config.channels.main,
        pattern, rootNote: root,
        baseVelocity: config.baseVelocity,
        gateFraction: config.gateFraction,
        bpm: this.bpm, swing: this.swing, tStart,
        programChange: null,
      });
      seq.setHumanize(this.humanize);
      seq.setArp(this.arpSettings.enabled, this.arpSettings.mode, this.arpSettings.rate);
      seq.onStep = (step) => {
        ds.step = step;
        this.cb.onStep(id, step);
        if (step === 0 && ds.chainEnabled) this.chainSwap(id);
        if (step === 0 && this.restartAtLoop.has(id)) this.restartDevice(id, true);
        if (step === 0 && this.songPlaying && id === this.songDriverDevice) this.songBarTick();
        // Metronome click on quarter notes (every 4th step)
        if (step % 4 === 0 && this.audioPort) this.audioPort.playClick();
      };
      seq.start();
      this.sequencers.set(id, seq);

    } else {
      // drums or drums+bass
      let drumPattern = ds.drumsMuted
        ? Array.from({ length: ds.patternLength }, (): DrumHit[] => [])
        : (ds.drumEdit ?? this.getDeviceDrumPattern(id));
      if (ds.patternLength === 32 && drumPattern.length === 16) {
        drumPattern = [...drumPattern, ...drumPattern];
      } else if (ds.patternLength < 16 && drumPattern.length > ds.patternLength) {
        drumPattern = drumPattern.slice(0, ds.patternLength);
      }

      // Drums-only sequencer (bass is now a separate device)
      const emptyBass = Array.from({ length: ds.patternLength }, (): null => null);
      const seq = new T8Sequencer({
        port,
        drumChannel: config.channels.main,
        bassChannel: config.channels.main,
        drumPattern, bassPattern: emptyBass,
        bassRoot: config.rootNote,
        baseVelocity: config.baseVelocity,
        drumGateFraction: config.drumGateFraction,
        bassGateFraction: config.gateFraction,
        drumMap: config.drumMap,
        bpm: this.bpm, swing: this.swing, tStart,
      });
      seq.setHumanize(this.humanize);
      seq.onStep = (step) => {
        ds.step = step;
        this.cb.onStep(id, step);
        if (step === 0 && ds.chainEnabled) this.chainSwap(id);
        if (step === 0 && this.restartAtLoop.has(id)) this.restartDevice(id, true);
        if (step === 0 && this.songPlaying && id === this.songDriverDevice) this.songBarTick();
      };
      seq.start();
      this.sequencers.set(id, seq);
    }

    if (config.sendClock) {
      const clock = new MidiClock(port, this.bpm);
      clock.start();
      this.clocks.set(id, clock);
    }
  }

  /** Stop and clean up the sequencer + clock for a device. */
  private stopDevice(id: string): void {
    const seq = this.sequencers.get(id);
    if (seq) { seq.stop(); this.sequencers.delete(id); }
    const clk = this.clocks.get(id);
    if (clk) { clk.stop(); this.clocks.delete(id); }
  }

  /** Stop then re-start a device (used after pattern/key/BPM changes).
   *  If a sequencer is running, defers the restart to step 0 (loop boundary)
   *  so scheduled notes complete naturally — avoids mid-loop clicks/cracks.
   *  Throttled: collapses calls within 50ms per-device. */
  private restartTimers: Map<string, number> = new Map();
  private restartPending: Map<string, ReturnType<typeof setTimeout>> = new Map();
  /** Devices waiting for loop-boundary restart (step 0). */
  private restartAtLoop: Set<string> = new Set();
  private restartDevice(id: string, immediate = false): void {
    const now = performance.now();
    const last = this.restartTimers.get(id) ?? 0;
    if (now - last < 50) {
      // Queue-last: replace any pending restart, fire after cooldown
      const existing = this.restartPending.get(id);
      if (existing) clearTimeout(existing);
      this.restartPending.set(id, setTimeout(() => {
        this.restartPending.delete(id);
        this.restartDevice(id, immediate);
      }, 50 - (now - last)));
      return;
    }
    this.restartTimers.set(id, now);
    const pending = this.restartPending.get(id);
    if (pending) { clearTimeout(pending); this.restartPending.delete(id); }

    // If a sequencer is running, defer to loop boundary (step 0) to avoid
    // mid-loop teardown that causes clicks. Immediate mode skips this
    // (used for initial start, BPM changes, and staggered preview starts).
    const seq = this.sequencers.get(id);
    if (!immediate && seq) {
      this.restartAtLoop.add(id);
      return;
    }

    this.restartAtLoop.delete(id);
    this.stopDevice(id);
    const ds = this.deviceStates.get(id);
    if (ds && this.ports[id] && !this.stopped.has(id)) {
      this.startDevice(id);
    }
  }

  /** Hot-swap patterns on a running sequencer without restart. Falls back to restart if no sequencer. */
  private hotSwapPatterns(id: string): void {
    const ds = this.deviceStates.get(id);
    const seq = this.sequencers.get(id);
    const port = this.ports[id];
    if (!ds || !seq || !port) {
      this.restartDevice(id);
      return;
    }
    // Kill ringing notes — only on this device's channels
    port.allNotesOff(ds.config.channels.main);
    if (ds.config.channels.bass !== undefined) port.allNotesOff(ds.config.channels.bass);

    if (ds.config.mode === "synth" || ds.config.mode === "bass") {
      let pattern = ds.drumsMuted
        ? Array.from({ length: ds.patternLength }, (): null => null)
        : (ds.melodicEdit ?? this.getDeviceMelodicPattern(id));
      if (ds.patternLength === 32 && pattern.length === 16) pattern = [...pattern, ...pattern];
      else if (ds.patternLength < 16 && pattern.length > ds.patternLength) pattern = pattern.slice(0, ds.patternLength);
      (seq as Sequencer).setPattern(pattern);
    } else {
      let drumPattern = ds.drumsMuted
        ? Array.from({ length: ds.patternLength }, (): DrumHit[] => [])
        : (ds.drumEdit ?? this.getDeviceDrumPattern(id));
      if (ds.patternLength === 32 && drumPattern.length === 16) drumPattern = [...drumPattern, ...drumPattern];
      else if (ds.patternLength < 16 && drumPattern.length > ds.patternLength) drumPattern = drumPattern.slice(0, ds.patternLength);
      (seq as T8Sequencer).setDrumPattern(drumPattern);

      if (ds.config.mode === "drums+bass") {
        let bassPattern = ds.bassMuted
          ? Array.from({ length: ds.patternLength }, (): null => null)
          : (ds.bassEdit ?? this.getDeviceBassPattern(id));
        if (ds.patternLength === 32 && bassPattern.length === 16) bassPattern = [...bassPattern, ...bassPattern];
        else if (ds.patternLength < 16 && bassPattern.length > ds.patternLength) bassPattern = bassPattern.slice(0, ds.patternLength);
        (seq as T8Sequencer).setBassPattern(bassPattern);
      }
    }
  }

  private pauseAll(): void {
    for (const [id] of this.sequencers) {
      const ds = this.deviceStates.get(id);
      if (ds) ds.paused = true;
      this.stopDevice(id);
    }
  }

  private resumeAll(): void {
    this.t0 = performance.now(); // re-sync grid origin after suspend
    for (const [id, ds] of this.deviceStates) {
      if (ds.connected && this.ports[id] && !this.stopped.has(id)) {
        ds.paused = false;
        this.startDevice(id);
      }
    }
  }

  // ── Pattern helpers ──────────────────────────────────────────────────

  private getDeviceGenres(id: string): import("../types").GenreInfo[] {
    const ds = this.deviceStates.get(id);
    if (!ds) return [];
    return getDeviceGenres(this.data.catalog, id, ds.config.mode);
  }

  private getDeviceBassGenres(): import("../types").GenreInfo[] {
    return getDeviceBassGenres(this.data.catalog);
  }

  private getDeviceMelodicPattern(id: string): (StepData | null)[] {
    const ds = this.deviceStates.get(id)!;
    const genres = this.getDeviceGenres(id);
    const genre = genres[ds.genreIdx]?.name ?? "";
    return getMelodicPattern(getMelodicSource(id), genre, ds.patternIdx);
  }

  private getDeviceDrumPattern(id: string): DrumHit[][] {
    const ds = this.deviceStates.get(id)!;
    const genres = this.getDeviceGenres(id);
    const genre = genres[ds.genreIdx]?.name ?? "";
    return getDrumPattern(genre, ds.patternIdx);
  }

  private getDeviceBassPattern(id: string): (StepData | null)[] {
    const ds = this.deviceStates.get(id)!;
    const bassGenres = this.getDeviceBassGenres();
    const genre = bassGenres[ds.bassGenreIdx]?.name ?? "";
    return getBassPattern(genre, ds.bassPatternIdx);
  }

  private getDeviceRoot(id: string): number {
    const ds = this.deviceStates.get(id)!;
    const config = ds.config;
    if (!config.hasKey) return config.rootNote;
    const keyName = this.data.catalog.keys[ds.keyIdx] ?? "A";
    return parseKey(keyName, ds.octave);
  }

  // ── Commands ─────────────────────────────────────────────────────────

  setGenre(device: string, idx: number): void {
    // Try direct device first (handles preview_bass and all standalone devices)
    let ds = this.deviceStates.get(device);
    let deviceId = device;
    let isBass = false;

    if (!ds && device.endsWith("_bass")) {
      // Legacy: "preview_drums_bass" → strip suffix for drums+bass hardware
      deviceId = device.slice(0, -5);
      ds = this.deviceStates.get(deviceId);
      isBass = true;
    }
    if (!ds) return;

    if (isBass) {
      const bassGenres = this.getDeviceBassGenres();
      ds.bassGenreIdx = Math.max(0, Math.min(idx, bassGenres.length - 1));
      const bassPatCount = bassGenres[ds.bassGenreIdx]?.patterns?.length || 1;
      ds.bassPatternIdx = Math.floor(Math.random() * bassPatCount);
      ds.bassEdit = null;
    } else {
      const genres = this.getDeviceGenres(deviceId);
      ds.genreIdx = Math.max(0, Math.min(idx, genres.length - 1));
      const patCount = genres[ds.genreIdx]?.patterns?.length || 1;
      ds.patternIdx = Math.floor(Math.random() * patCount);
      ds.patternLength = 16;
      if (ds.config.mode === "synth" || ds.config.mode === "bass") {
        ds.melodicEdit = null;
      } else {
        ds.drumEdit = null;
      }
    }
    this.hotSwapPatterns(deviceId);
    this.emitStateNow();
  }

  setPattern(device: string, idx: number): void {
    let ds = this.deviceStates.get(device);
    let deviceId = device;
    let isBass = false;

    if (!ds && device.endsWith("_bass")) {
      deviceId = device.slice(0, -5);
      ds = this.deviceStates.get(deviceId);
      isBass = true;
    }
    if (!ds) return;

    if (isBass) {
      const bassGenres = this.getDeviceBassGenres();
      const bpats = bassGenres[ds.bassGenreIdx]?.patterns ?? [];
      ds.bassPatternIdx = Math.max(0, Math.min(idx, bpats.length - 1));
      ds.bassEdit = null;
    } else {
      const genres = this.getDeviceGenres(deviceId);
      const pats = genres[ds.genreIdx]?.patterns ?? [];
      ds.patternIdx = Math.max(0, Math.min(idx, pats.length - 1));
      ds.patternLength = 16;
      if (ds.config.mode === "synth" || ds.config.mode === "bass") {
        ds.melodicEdit = null;
      } else {
        ds.drumEdit = null;
      }
    }
    this.hotSwapPatterns(deviceId);
    this.emitStateNow();
  }

  private static KEY_OCTAVE_SYNC = new Map([
    ["preview_synth", "preview_bass"],
    ["preview_bass", "preview_synth"],
  ]);

  private isKeyLocked(): boolean {
    const v = localStorage.getItem("mpump-key-lock");
    return v === null || v === "true";
  }

  setKey(device: string, idx: number): void {
    const ds = this.deviceStates.get(device);
    if (!ds || !ds.config.hasKey) return;
    ds.keyIdx = idx;
    const toRestart = [device];
    if (this.isKeyLocked()) {
      const peer = Engine.KEY_OCTAVE_SYNC.get(device);
      const ps = peer && this.deviceStates.get(peer);
      if (ps && ps.config.hasKey) { ps.keyIdx = idx; toRestart.push(peer); }
    }
    // Stop all first, then start all — prevents overlapping sequencers
    for (const id of toRestart) this.stopDevice(id);
    for (const id of toRestart) { const s = this.deviceStates.get(id); if (s && this.ports[id] && !this.stopped.has(id)) this.startDevice(id); }
    this.emitState();
  }

  setOctave(device: string, octave: number): void {
    const ds = this.deviceStates.get(device);
    if (!ds || !ds.config.hasOctave) return;
    ds.octave = octave;
    const toRestart = [device];
    if (this.isKeyLocked()) {
      const peer = Engine.KEY_OCTAVE_SYNC.get(device);
      const ps = peer && this.deviceStates.get(peer);
      if (ps && ps.config.hasOctave) { ps.octave = octave; toRestart.push(peer); }
    }
    for (const id of toRestart) this.stopDevice(id);
    for (const id of toRestart) { const s = this.deviceStates.get(id); if (s && this.ports[id] && !this.stopped.has(id)) this.startDevice(id); }
    this.emitState();
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(20, Math.min(300, bpm));

    // Update running sequencers, clocks, and AudioPort in-place (no restart)
    for (const [, seq] of this.sequencers) seq.setBpm(this.bpm);
    for (const [, clk] of this.clocks) clk.setBpm(this.bpm);
    if (this.audioPort) this.audioPort.setBpm(this.bpm);

    this.emitState();
  }

  private randomizeDevice(id: string, forceGenreIdx?: number, skipRestart = false): void {
    const ds = this.deviceStates.get(id);
    if (!ds || !ds.connected) return;

    const genres = this.getDeviceGenres(id);
    if (genres.length === 0) return;

    const nonExtras = genres.map((g, i) => ({ g, i })).filter(x => x.g.name !== "extras");
    if (nonExtras.length === 0) return;
    const pick = forceGenreIdx != null && genres[forceGenreIdx]
      ? { g: genres[forceGenreIdx], i: forceGenreIdx }
      : nonExtras[Math.floor(Math.random() * nonExtras.length)];
    ds.genreIdx = pick.i;
    ds.patternIdx = Math.floor(Math.random() * pick.g.patterns.length);
    ds.patternLength = 16;
    ds.melodicEdit = null;
    ds.drumEdit = null;

    if (ds.config.mode === "drums+bass") {
      const bassGenres = this.getDeviceBassGenres();
      const bassNonExtras = bassGenres.map((g, i) => ({ g, i })).filter(x => x.g.name !== "extras");
      if (bassNonExtras.length > 0) {
        const bassPick = forceGenreIdx != null && bassGenres[forceGenreIdx]
          ? { g: bassGenres[forceGenreIdx], i: forceGenreIdx }
          : bassNonExtras[Math.floor(Math.random() * bassNonExtras.length)];
        ds.bassGenreIdx = bassPick.i;
        ds.bassPatternIdx = Math.floor(Math.random() * bassPick.g.patterns.length);
        ds.bassEdit = null;
      }
    }

    // Full restart to ensure clean state (hot-swap left scheduled notes in the look-ahead buffer)
    // Randomize is user-initiated — use immediate restart, don't defer to loop boundary
    if (!skipRestart) this.restartDevice(id, true);
    /* ---- hot-swap removed: caused overlapping patterns due to look-ahead ----
    const seq = this.sequencers.get(id);
    const port = this.ports[id];
    if (seq && port) {
      for (let ch = 0; ch < 16; ch++) port.allNotesOff(ch);

      if (ds.config.mode === "synth" || ds.config.mode === "bass") {
        const pattern = this.getDeviceMelodicPattern(id);
        (seq as Sequencer).setPattern(pattern);
      } else {
        const drumPattern = this.getDeviceDrumPattern(id);
        (seq as T8Sequencer).setDrumPattern(drumPattern);
        if (ds.config.mode === "drums+bass") {
          const bassPattern = ds.bassMuted
            ? Array.from({ length: 16 }, (): null => null)
            : this.getDeviceBassPattern(id);
          (seq as T8Sequencer).setBassPattern(bassPattern);
        }
      }
    } else {
      this.startDevice(id);
    }
    ---- */
  }

  randomizeAll(linkGenre = false): void {
    // If genre-link is on, pick one shared genre index for all devices
    let sharedGenreIdx: number | undefined;
    if (linkGenre) {
      const firstId = [...this.deviceStates.keys()][0];
      if (firstId) {
        const genres = this.getDeviceGenres(firstId);
        const nonExtras = genres.map((g, i) => ({ g, i })).filter(x => x.g.name !== "extras");
        if (nonExtras.length > 0) {
          sharedGenreIdx = nonExtras[Math.floor(Math.random() * nonExtras.length)].i;
        }
      }
    }
    // Set state for all devices, then stagger restarts to avoid concurrent teardown
    const toRestart: string[] = [];
    for (const [id, ds] of this.deviceStates) {
      if (!ds.connected) continue;
      this.randomizeDevice(id, sharedGenreIdx, true);
      toRestart.push(id);
    }
    // Restart all devices immediately — user expects instant switch on MIX
    for (const id of toRestart) this.restartDevice(id, true);
    this.emitStateNow();
  }

  randomizeSingle(device: string): void {
    this.randomizeDevice(device, undefined, false);
    this.emitState();
  }

  randomizeBass(device: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds || !ds.connected || ds.config.mode !== "drums+bass") return;

    const bassGenres = this.getDeviceBassGenres();
    const nonExtras = bassGenres.map((g, i) => ({ g, i })).filter(x => x.g.name !== "extras");
    if (nonExtras.length === 0) return;
    const pick = nonExtras[Math.floor(Math.random() * nonExtras.length)];
    ds.bassGenreIdx = pick.i;
    ds.bassPatternIdx = Math.floor(Math.random() * pick.g.patterns.length);
    ds.bassEdit = null;

    this.restartDevice(device, true);
    this.emitState();
  }

  setPatternLength(device: string, length: 1 | 2 | 3 | 4 | 8 | 16 | 32): void {
    const ds = this.deviceStates.get(device);
    if (!ds || ds.patternLength === length) return;

    if (length === 32) {
      // →32: create edit buffers if needed, then double them
      if (ds.config.mode === "synth" || ds.config.mode === "bass") {
        if (!ds.melodicEdit) ds.melodicEdit = [...this.getDeviceMelodicPattern(device)];
        if (ds.melodicEdit.length === 16) ds.melodicEdit = [...ds.melodicEdit, ...ds.melodicEdit];
      } else {
        if (!ds.drumEdit) ds.drumEdit = this.getDeviceDrumPattern(device).map(h => [...h]);
        if (ds.drumEdit.length === 16) ds.drumEdit = [...ds.drumEdit, ...ds.drumEdit];
        if (ds.config.mode === "drums+bass") {
          if (!ds.bassEdit) ds.bassEdit = [...this.getDeviceBassPattern(device)];
          if (ds.bassEdit.length === 16) ds.bassEdit = [...ds.bassEdit, ...ds.bassEdit];
        }
      }
    } else if (ds.patternLength === 32) {
      // 32→shorter: truncate edit buffers to first 16
      if (ds.melodicEdit && ds.melodicEdit.length > 16) ds.melodicEdit = ds.melodicEdit.slice(0, 16);
      if (ds.drumEdit && ds.drumEdit.length > 16) ds.drumEdit = ds.drumEdit.slice(0, 16);
      if (ds.bassEdit && ds.bassEdit.length > 16) ds.bassEdit = ds.bassEdit.slice(0, 16);
    }
    // For lengths ≤ 16 (1,2,3,4,8,16), the sequencer uses stepIndex % patternLength

    ds.patternLength = length;
    this.restartDevice(device, true);
    this.emitState();
  }

  loadPreset(bpm: number, genres: Record<string, { gi: number; pi: number; bgi: number; bpi: number }>): void {
    this.bpm = Math.max(20, Math.min(300, bpm));
    this.t0 = performance.now();
    for (const [, clk] of this.clocks) clk.setBpm(this.bpm);

    for (const [id, sel] of Object.entries(genres)) {
      const ds = this.deviceStates.get(id);
      if (!ds) continue;

      // Stop first
      this.stopDevice(id);

      // Set genre/pattern with bounds checking
      const mainGenres = this.getDeviceGenres(id);
      ds.genreIdx = Math.max(0, Math.min(sel.gi, mainGenres.length - 1));
      const pats = mainGenres[ds.genreIdx]?.patterns ?? [];
      ds.patternIdx = Math.max(0, Math.min(sel.pi, pats.length - 1));
      ds.patternLength = 16;
      ds.melodicEdit = null;
      ds.drumEdit = null;

      if (ds.config.mode === "drums+bass") {
        const bassGenres = this.getDeviceBassGenres();
        ds.bassGenreIdx = Math.max(0, Math.min(sel.bgi, bassGenres.length - 1));
        const bpats = bassGenres[ds.bassGenreIdx]?.patterns ?? [];
        ds.bassPatternIdx = Math.max(0, Math.min(sel.bpi, bpats.length - 1));
        ds.bassEdit = null;
      }

      // Restart with new settings
      if (ds.connected && this.ports[id] && !this.stopped.has(id)) {
        this.startDevice(id);
      }
    }

    this.emitState();
  }

  setSwing(swing: number): void {
    this.swing = Math.max(0.5, Math.min(0.80, swing));
    for (const [, seq] of this.sequencers) {
      seq.setSwing(this.swing);
    }
    this.emitState();
  }

  setDeviceVolume(device: string, volume: number): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    ds.deviceVolume = Math.max(0, Math.min(1, volume));
    if (this.audioPort) {
      const cfg = ds.config;
      this.audioPort.setChannelVolume(cfg.channels.main, ds.deviceVolume);
      if (cfg.channels.bass !== undefined) {
        this.audioPort.setChannelVolume(cfg.channels.bass, ds.deviceVolume);
      }
    }
    this.emitState();
  }

  undoEdit(device: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds || ds.undoStack.length === 0) return;
    const prev = ds.undoStack.pop()!;
    ds.melodicEdit = prev.melodic;
    ds.drumEdit = prev.drum;
    ds.bassEdit = prev.bass;
    this.hotSwapPatterns(device);
    this.emitState();
  }

  /** Swap between pattern A and B on bar boundary. */
  private chainSwap(id: string): void {
    const ds = this.deviceStates.get(id);
    if (!ds || !ds.chainEnabled) return;
    ds.chainCycle = ds.chainCycle === 0 ? 1 : 0;
    const targetIdx = ds.chainCycle === 0 ? ds.patternIdx : ds.chainPatternIdx;

    // Hot-swap pattern data without restarting sequencer
    const seq = this.sequencers.get(id);
    if (!seq) return;

    if (ds.config.mode === "synth" || ds.config.mode === "bass") {
      const pattern = ds.drumsMuted
        ? Array.from({ length: ds.patternLength }, (): null => null)
        : getMelodicPattern(getMelodicSource(id), (this.getDeviceGenres(id)[ds.genreIdx]?.name ?? ""), targetIdx);
      (seq as Sequencer).setPattern(pattern);
    } else {
      const genre = this.getDeviceGenres(id)[ds.genreIdx]?.name ?? "";
      const drumPattern = ds.drumsMuted
        ? Array.from({ length: ds.patternLength }, (): DrumHit[] => [])
        : getDrumPattern(genre, targetIdx);
      (seq as T8Sequencer).setDrumPattern(drumPattern);

      if (ds.config.mode === "drums+bass") {
        const bassGenre = this.getDeviceBassGenres()[ds.bassGenreIdx]?.name ?? "";
        const bassPattern = ds.bassMuted
          ? Array.from({ length: ds.patternLength }, (): null => null)
          : getBassPattern(bassGenre, targetIdx);
        (seq as T8Sequencer).setBassPattern(bassPattern);
      }
    }
    // Notify UI so grid shows the active pattern — must be immediate
    this.emitStateNow();
  }

  toggleChain(device: string, chainIdx: number): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    if (ds.chainEnabled && ds.chainPatternIdx === chainIdx) {
      // Toggle off
      ds.chainEnabled = false;
    } else {
      ds.chainEnabled = true;
      ds.chainPatternIdx = chainIdx;
      ds.chainCycle = 0;
    }
    this.emitState();
  }

  toggleDrumsMute(device: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    ds.drumsMuted = !ds.drumsMuted;
    this.hotSwapPatterns(device);
    this.emitState();
  }

  setDrumsMute(device: string, muted: boolean): void {
    const ds = this.deviceStates.get(device);
    if (!ds || ds.drumsMuted === muted) return;
    ds.drumsMuted = muted;
    this.hotSwapPatterns(device);
    this.emitState();
  }

  setBassMute(device: string, muted: boolean): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    if (ds.config.mode === "bass") {
      if (ds.drumsMuted === muted) return;
      ds.drumsMuted = muted;
    } else if (ds.config.mode === "drums+bass") {
      if (ds.bassMuted === muted) return;
      ds.bassMuted = muted;
    } else return;
    this.hotSwapPatterns(device);
    this.emitState();
  }

  toggleBassMute(device: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    // For standalone bass device, use drumsMuted (same as toggleDrumsMute)
    if (ds.config.mode === "bass") {
      ds.drumsMuted = !ds.drumsMuted;
      this.hotSwapPatterns(device);
      this.emitState();
      return;
    }
    // Legacy: drums+bass hardware devices
    if (ds.config.mode !== "drums+bass") return;
    ds.bassMuted = !ds.bassMuted;
    this.hotSwapPatterns(device);
    this.emitState();
  }

  setSynthParams(device: string, params: Partial<SynthParams>): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    ds.synthParams = { ...ds.synthParams, ...params };
    // Apply to AudioPort if in preview mode
    if (this.audioPort) {
      const ch = ds.config.channels.main;
      this.audioPort.setSynthParams(ch, ds.synthParams);
    }
    this.emitState();
  }

  setBassSynthParams(device: string, params: Partial<SynthParams>): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    if (ds.config.mode === "bass") {
      // Standalone bass device — synth params are the main params
      ds.synthParams = { ...ds.synthParams, ...params };
      if (this.audioPort) this.audioPort.setSynthParams(ds.config.channels.main, ds.synthParams);
    } else if (ds.config.mode === "drums+bass") {
      // Legacy drums+bass hardware
      ds.bassSynthParams = { ...ds.bassSynthParams, ...params };
      if (this.audioPort) {
        const ch = ds.config.channels.bass ?? ds.config.channels.main;
        this.audioPort.setSynthParams(ch, ds.bassSynthParams);
      }
    }
    this.emitState();
  }

  togglePause(device: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;

    if (this.stopped.has(device)) {
      this.stopped.delete(device);
      ds.paused = false;
      if (this.ports[device]) this.startDevice(device);
    } else {
      this.stopped.add(device);
      ds.paused = true;
      ds.step = -1;
      this.stopDevice(device);
    }
    this.emitStateNow();
  }

  // ── Edit commands ────────────────────────────────────────────────────

  private pushUndo(ds: InternalDeviceState): void {
    ds.undoStack.push({
      melodic: ds.melodicEdit ? [...ds.melodicEdit] : null,
      drum: ds.drumEdit ? ds.drumEdit.map(h => [...h]) : null,
      bass: ds.bassEdit ? [...ds.bassEdit] : null,
    });
    if (ds.undoStack.length > 20) ds.undoStack.shift();
  }

  editStep(device: string, stepIdx: number, data: StepData | null): void {
    // "_bass" suffix means bass-layer edit on a drums+bass device (e.g. "preview_drums_bass")
    // But "preview_bass" is a standalone bass device — don't strip its name
    const isBass = device.endsWith("_bass") && !this.deviceStates.has(device);
    const deviceId = isBass ? device.slice(0, -5) : device;
    const ds = this.deviceStates.get(deviceId);
    if (!ds) return;
    this.pushUndo(ds);

    if (isBass) {
      if (!ds.bassEdit) ds.bassEdit = [...this.getDeviceBassPattern(deviceId)];
      ds.bassEdit[stepIdx] = data;
      const seq = this.sequencers.get(deviceId) as T8Sequencer | undefined;
      if (seq) seq.setBassPattern(ds.bassEdit);
    } else {
      if (!ds.melodicEdit) ds.melodicEdit = [...this.getDeviceMelodicPattern(deviceId)];
      ds.melodicEdit[stepIdx] = data;
      const seq = this.sequencers.get(deviceId) as Sequencer | undefined;
      seq?.setPattern(ds.melodicEdit);
    }
    this.emitState();
  }

  bulkSetPattern(device: string, patternData?: (StepData | null)[], drumData?: DrumHit[][], bassData?: (StepData | null)[]): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    const seq = this.sequencers.get(device);
    if (patternData && seq && "setPattern" in seq) {
      ds.melodicEdit = [...patternData];
      (seq as Sequencer).setPattern(ds.melodicEdit);
    }
    if (drumData && seq && "setDrumPattern" in seq) {
      ds.drumEdit = drumData.map(hits => [...hits]);
      (seq as T8Sequencer).setDrumPattern(ds.drumEdit);
    }
    if (bassData && seq && "setBassPattern" in seq) {
      ds.bassEdit = [...bassData];
      (seq as T8Sequencer).setBassPattern(ds.bassEdit);
    }
    this.emitState();
  }

  clearPattern(device: string): void {
    const isBass = device.endsWith("_bass") && !this.deviceStates.has(device);
    const deviceId = isBass ? device.slice(0, -5) : device;
    const ds = this.deviceStates.get(deviceId);
    if (!ds) return;
    this.pushUndo(ds);
    const len = ds.patternLength || 16;
    const empty = Array.from({ length: len }, () => null);
    if (isBass) {
      ds.bassEdit = empty as (StepData | null)[];
      const seq = this.sequencers.get(deviceId) as T8Sequencer | undefined;
      if (seq) seq.setBassPattern(ds.bassEdit);
    } else {
      ds.melodicEdit = empty as (StepData | null)[];
      const seq = this.sequencers.get(deviceId) as Sequencer | undefined;
      seq?.setPattern(ds.melodicEdit);
    }
    this.emitState();
  }

  editDrumStep(device: string, stepIdx: number, hits: DrumHit[]): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    this.pushUndo(ds);
    if (!ds.drumEdit) {
      ds.drumEdit = this.getDeviceDrumPattern(device).map(h => [...h]);
    }
    ds.drumEdit[stepIdx] = hits;
    const seq = this.sequencers.get(device) as T8Sequencer | undefined;
    if (seq) seq.setDrumPattern(ds.drumEdit);
    this.emitState();
  }

  discardEdit(device: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    ds.melodicEdit = null;
    ds.drumEdit = null;
    ds.bassEdit = null;
    this.hotSwapPatterns(device);
    this.emitState();
  }

  saveToExtras(device: string, name: string, desc: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    const extras = loadExtras();
    const config = ds.config;

    if (config.mode === "drums+bass") {
      // Save both drum and bass
      const drumKey = getExtrasKey(device, config.mode);
      const bassKey = getBassExtrasKey(config.mode)!;
      const drumSteps = ds.drumEdit ?? this.getDeviceDrumPattern(device);
      const bassSteps = ds.bassEdit ?? this.getDeviceBassPattern(device);

      extras[drumKey] = extras[drumKey] ?? [];
      extras[drumKey].push({ name, desc, steps: drumSteps });
      extras[bassKey] = extras[bassKey] ?? [];
      extras[bassKey].push({ name, desc, steps: bassSteps });

      ds.drumEdit = null;
      ds.bassEdit = null;
    } else {
      const key = getExtrasKey(device, config.mode);
      let steps: unknown;
      if (config.mode === "synth" || config.mode === "bass") {
        steps = ds.melodicEdit ?? this.getDeviceMelodicPattern(device);
        ds.melodicEdit = null;
      } else {
        // drums only
        steps = ds.drumEdit ?? this.getDeviceDrumPattern(device);
        ds.drumEdit = null;
      }
      extras[key] = extras[key] ?? [];
      extras[key].push({ name, desc, steps });
    }

    saveExtras(extras);
    this.data = loadCatalogSync(this.data, extras);
    this.hotSwapPatterns(device);
    this.cb.onCatalogChange(this.getCatalog());
    this.emitState();
  }

  deleteExtra(device: string, idx: number): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    const extras = loadExtras();
    const config = ds.config;

    if (config.mode === "drums+bass") {
      // Delete from both drums and bass at same index
      const drumKey = getExtrasKey(device, config.mode);
      const bassKey = getBassExtrasKey(config.mode)!;
      const drumList = extras[drumKey] ?? [];
      const bassList = extras[bassKey] ?? [];
      if (idx >= 0 && idx < drumList.length) drumList.splice(idx, 1);
      if (idx >= 0 && idx < bassList.length) bassList.splice(idx, 1);
    } else {
      const key = getExtrasKey(device, config.mode);
      const list = extras[key] ?? [];
      if (idx >= 0 && idx < list.length) list.splice(idx, 1);
    }

    saveExtras(extras);
    this.data = loadCatalogSync(this.data, extras);
    this.cb.onCatalogChange(this.getCatalog());
    this.emitState();
  }


  // ── State serialization ──────────────────────────────────────────────

  private _cachedState: EngineState | null = null;
  private _stateDirty = true;
  /** Mark state as dirty — next getState() will rebuild. Called by emitState/emitStateNow. */
  private markDirty(): void { this._stateDirty = true; }

  getState(): EngineState {
    if (this._cachedState && !this._stateDirty) return this._cachedState;
    const devices: Record<string, DeviceState> = {};

    for (const [id, ds] of this.deviceStates) {
      const config = ds.config;
      const editing = ds.melodicEdit !== null || ds.drumEdit !== null || ds.bassEdit !== null;

      // Build pattern data, doubling source if 32-step and not editing
      let patternData: (StepData | null)[] = [];
      let drumData: DrumHit[][] = [];
      let bassData: (StepData | null)[] = [];

      // When chain is playing B, show the B pattern (unless user is editing)
      const showingChainB = ds.chainEnabled && ds.chainCycle === 1 && !editing;

      if (config.mode === "synth" || config.mode === "bass") {
        patternData = ds.melodicEdit
          ?? (showingChainB
            ? getMelodicPattern(getMelodicSource(id), (this.getDeviceGenres(id)[ds.genreIdx]?.name ?? ""), ds.chainPatternIdx)
            : this.getDeviceMelodicPattern(id));
        if (ds.patternLength === 32 && patternData.length === 16) {
          patternData = [...patternData, ...patternData];
        }
      } else {
        drumData = ds.drumEdit
          ?? (showingChainB
            ? getDrumPattern((this.getDeviceGenres(id)[ds.genreIdx]?.name ?? ""), ds.chainPatternIdx)
            : this.getDeviceDrumPattern(id));
        if (ds.patternLength === 32 && drumData.length === 16) {
          drumData = [...drumData, ...drumData];
        }
        if (config.mode === "drums+bass") {
          bassData = ds.bassEdit
            ?? (showingChainB
              ? getBassPattern((this.getDeviceBassGenres()[ds.bassGenreIdx]?.name ?? ""), ds.chainPatternIdx)
              : this.getDeviceBassPattern(id));
          if (ds.patternLength === 32 && bassData.length === 16) {
            bassData = [...bassData, ...bassData];
          }
        }
      }

      devices[id] = {
        id,
        mode: config.mode,
        genre_idx: ds.genreIdx,
        pattern_idx: ds.patternIdx,
        bass_genre_idx: ds.bassGenreIdx,
        bass_pattern_idx: ds.bassPatternIdx,
        key_idx: ds.keyIdx,
        octave: ds.octave,
        step: ds.step,
        connected: ds.connected,
        paused: ds.paused,
        editing,
        pattern_data: patternData,
        drum_data: drumData,
        bass_data: bassData,
        patternLength: ds.patternLength,
        label: config.label,
        accent: config.accent,
        hasKey: config.hasKey,
        hasOctave: config.hasOctave,
        bassMuted: ds.bassMuted,
        drumsMuted: ds.drumsMuted,
        deviceVolume: ds.deviceVolume,
        chainEnabled: ds.chainEnabled,
        chainPatternIdx: ds.chainPatternIdx,
        chainCycle: ds.chainCycle,
        synthParams: id.startsWith("preview_") ? ds.synthParams : null,
        bassSynthParams: id.startsWith("preview_") ? ds.bassSynthParams : null,
      };
    }

    this._cachedState = { bpm: this.bpm, swing: this.swing, devices };
    this._stateDirty = false;
    return this._cachedState;
  }

  /** Update a drum voice's tune/decay/level (preview mode only). */
  setDrumVoice(note: number, params: Partial<DrumVoiceParams>): void {
    if (this.audioPort) this.audioPort.setDrumVoice(note, params);
  }

  /** Toggle mute for a drum voice (preview mode only). */
  toggleDrumVoiceMute(note: number): void {
    if (this.audioPort) this.audioPort.toggleDrumMute(note);
  }

  /** Get muted drum notes (preview mode only). */
  getMutedDrumNotes(): Set<number> {
    return this.audioPort?.getMutedDrumNotes() ?? new Set();
  }

  /** Enable/disable CV output (preview mode only). */
  setCVEnabled(on: boolean): void {
    if (this.audioPort) this.audioPort.setCVEnabled(on);
  }

  /** Play a note on a given channel (for keyboard input — sustains until stopNote). */
  playNote(ch: number, note: number, vel = 100): void {
    if (!this.audioPort) return;
    this.audioPort.liveNoteOn(ch, note, vel);
  }

  /** Stop a note on a given channel. */
  stopNote(ch: number, note: number): void {
    if (!this.audioPort) return;
    this.audioPort.liveNoteOff(ch, note);
  }

  cvTestNote(): void {
    if (!this.audioPort) return;
    const port = this.audioPort as unknown as MidiPort;
    port.noteOn(0, 60, 100);
    setTimeout(() => (this.audioPort as unknown as MidiPort)?.noteOff(0, 60), 1000);
  }

  /** Advance all running sequencers by one step (used in external clock mode). */
  private advanceAllSequencers(): void {
    const now = performance.now();
    for (const [, seq] of this.sequencers) {
      seq.advanceStep(now);
    }
    if (this.audioPort) {
      (this.audioPort as any).advanceStep?.(now);
    }
  }

  /**
   * Enable/disable MIDI clock sync input.
   * Delegates to MidiClockReceiver for tick counting, BPM derivation, and transport.
   */
  setMidiClockSync(on: boolean): void {
    if (!this.access) return;
    if (on) {
      this.midiClockReceiver.enable(this.access);
    } else {
      this.midiClockReceiver.disable(this.access);
    }
  }

  /** Sweep C3→C4→C5 with 1 second each (CV calibration). */
  cvTestOctave(): void {
    if (!this.audioPort) return;
    [48, 60, 72].forEach((note, i) => {
      setTimeout(() => {
        const port = this.audioPort as unknown as MidiPort | null;
        if (!port) return;
        port.noteOn(0, note, 100);
        setTimeout(() => (this.audioPort as unknown as MidiPort | null)?.noteOff(0, note), 900);
      }, i * 1000);
    });
  }

  /** Load custom drum samples (preview mode only). */
  loadCustomSamples(samples: Map<number, AudioBuffer>): void {
    if (this.audioPort) this.audioPort.loadCustomSamples(samples);
  }

  /** Set master volume (preview mode only). */
  setVolume(v: number): void {
    if (this.audioPort) this.audioPort.setVolume(v);
  }

  /** Update an audio effect (preview mode only). */
  setEffect<K extends EffectName>(name: K, params: Partial<EffectParams[K]>): void {
    if (this.audioPort) {
      this.audioPort.setEffect(name, params);
    }
  }

  /** Get the AnalyserNode for VU metering (preview mode only). */
  getAnalyser(): AnalyserNode | null {
    return this.audioPort?.getAnalyser() ?? null;
  }

  /** Get the AnalyserNode for a specific channel (preview mode only). */
  getChannelAnalyser(ch: number): AnalyserNode | null {
    return this.audioPort?.getChannelAnalyser(ch) ?? null;
  }

  /** Set per-channel volume (preview mode only). */
  setChannelVolume(ch: number, v: number): void {
    if (this.audioPort) this.audioPort.setChannelVolume(ch, v);
  }

  /** Set anti-clip mode (preview mode only). */
  setAntiClipMode(mode: "off" | "limiter" | "hybrid"): void {
    if (this.audioPort) this.audioPort.setAntiClipMode(mode);
  }

  getAntiClipMode(): "off" | "limiter" | "hybrid" {
    return this.audioPort?.getAntiClipMode() ?? "limiter";
  }

  // ── Effect chain order ──────────────────────────────────────────────

  setEffectOrder(order: import("../types").EffectName[]): void {
    if (this.audioPort) this.audioPort.setEffectOrder(order);
  }

  getEffectOrder(): import("../types").EffectName[] {
    return this.audioPort?.getEffectOrder() ?? ["compressor", "highpass", "distortion", "bitcrusher", "chorus", "phaser", "delay", "reverb"];
  }

  // ── Metronome ───────────────────────────────────────────────────────

  setMetronome(on: boolean): void {
    if (this.audioPort) this.audioPort.setMetronome(on);
  }

  // ── Velocity humanize ───────────────────────────────────────────────

  private humanize = true;

  setHumanize(on: boolean): void {
    this.humanize = on;
    for (const [, seq] of this.sequencers) {
      seq.setHumanize(on);
    }
  }

  // ── Pattern copy/paste ──────────────────────────────────────────────

  private clipboard: { mode: string; melodic?: (StepData | null)[]; drum?: DrumHit[][]; bass?: (StepData | null)[] } | null = null;

  copyPattern(device: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    const melodic = ds.melodicEdit ?? this.getDeviceMelodicPattern(device);
    const drum = ds.drumEdit ?? this.getDeviceDrumPattern(device);
    const bass = ds.bassEdit ?? this.getDeviceBassPattern(device);
    this.clipboard = {
      mode: ds.config.mode,
      melodic: melodic.map(s => s ? { ...s } : null),
      drum: drum.map(hits => hits.map(h => ({ ...h }))),
      bass: bass.map(s => s ? { ...s } : null),
    };
  }

  pastePattern(device: string): void {
    if (!this.clipboard) return;
    const ds = this.deviceStates.get(device);
    if (!ds) return;

    if ((ds.config.mode === "synth" || ds.config.mode === "bass") && this.clipboard.melodic) {
      ds.melodicEdit = this.clipboard.melodic as typeof ds.melodicEdit;
    } else if (ds.config.mode !== "synth") {
      if (this.clipboard.drum) ds.drumEdit = this.clipboard.drum as typeof ds.drumEdit;
      if (this.clipboard.bass) ds.bassEdit = this.clipboard.bass as typeof ds.bassEdit;
    }

    this.hotSwapPatterns(device);
    this.emitState();
  }

  // ── Sidechain duck ─────────────────────────────────────────────────

  setSidechainDuck(on: boolean): void {
    if (this.audioPort) this.audioPort.setSidechainDuck(on);
  }

  setDuckParams(depth: number, release: number, excludeBass?: boolean, excludeSynth?: boolean): void {
    if (this.audioPort) this.audioPort.setDuckParams(depth, release, excludeBass, excludeSynth);
  }

  setEQ(low: number, mid: number, high: number): void {
    if (this.audioPort) this.audioPort.setEQ(low, mid, high);
  }

  setMasterBoost(gain: number): void {
    if (this.audioPort) this.audioPort.setMasterBoost(gain);
  }

  setDrive(db: number): void {
    if (this.audioPort) this.audioPort.setDrive(db);
  }

  getMixerState() {
    return {
      drive: this.audioPort?.getDrive() ?? 0,
      eq: this.audioPort?.getEQ() ?? { low: 1, mid: 0, high: 0 },
      width: this.audioPort?.getWidth() ?? 0.5,
      lowCut: this.audioPort?.getLowCut() ?? 0,
      mbOn: this.audioPort?.isMultibandEnabled() ?? true,
      mbExcludeDrums: this.audioPort?.getMbExclude().drums ?? false,
    };
  }

  getDrive(): number {
    return this.audioPort?.getDrive() ?? 0;
  }

  setMono(on: boolean): void {
    if (this.audioPort) this.audioPort.setMono(on);
  }

  getMono(): boolean {
    return this.audioPort?.getMono() ?? false;
  }

  setMultibandEnabled(on: boolean): void {
    if (this.audioPort) this.audioPort.setMultibandEnabled(on);
  }

  setMultibandAmount(amount: number): void {
    if (this.audioPort) this.audioPort.setMultibandAmount(amount);
  }

  setMbExclude(channel: "drums", exclude: boolean): void {
    if (this.audioPort) this.audioPort.setMbExclude(channel, exclude);
  }

  getMbExclude(): { drums: boolean } {
    return this.audioPort?.getMbExclude() ?? { drums: false };
  }

  setWidth(width: number): void {
    if (this.audioPort) this.audioPort.setWidth(width);
  }

  setLowCut(freq: number): void {
    if (this.audioPort) this.audioPort.setLowCut(freq);
  }

  setChannelEQ(ch: number, low: number, mid: number, high: number): void {
    if (this.audioPort) this.audioPort.setChannelEQ(ch, low, mid, high);
  }

  setChannelHPF(ch: number, freq: number): void {
    if (this.audioPort) this.audioPort.setChannelHPF(ch, freq);
  }

  getChannelHPF(ch: number): number {
    return this.audioPort?.getChannelHPF(ch) ?? 0;
  }

  getCpuLoad(): number {
    return this.audioPort?.getCpuLoad() ?? 0;
  }


  loadScene(scene: Parameters<AudioPort["loadScene"]>[0]): void {
    if (this.audioPort) this.audioPort.loadScene(scene);
  }

  setChannelGate(ch: number, on: boolean, rate: string, depth: number, shape: string, mode = "lfo", pattern?: number[]): void {
    if (this.audioPort) this.audioPort.setChannelGate(ch, on, rate, depth, shape, mode, pattern);
  }

  setChannelPan(ch: number, pan: number): void {
    if (this.audioPort) this.audioPort.setChannelPan(ch, pan);
  }

  setChannelMono(ch: number, on: boolean): void {
    if (this.audioPort) this.audioPort.setChannelMono(ch, on);
  }

  getChannelMono(ch: number): boolean {
    return this.audioPort?.getChannelMono(ch) ?? false;
  }

  // ── Arpeggiator ────────────────────────────────────────────────────

  private arpSettings = { enabled: false, mode: "up" as import("../types").ArpMode, rate: "1/8" as import("../types").ArpRate };

  setArp(enabled: boolean, mode: import("../types").ArpMode, rate: import("../types").ArpRate, device?: string): void {
    if (device) {
      // Per-device arp
      const seq = this.sequencers.get(device);
      if (seq && "setArp" in seq) {
        (seq as import("./Sequencer").Sequencer).setArp(enabled, mode, rate);
      }
    } else {
      // Global arp (legacy)
      this.arpSettings = { enabled, mode, rate };
      for (const [id, seq] of this.sequencers) {
        const ds = this.deviceStates.get(id);
        if ((ds?.config.mode === "synth" || ds?.config.mode === "bass") && "setArp" in seq) {
          (seq as import("./Sequencer").Sequencer).setArp(enabled, mode, rate);
        }
      }
    }
  }

  getCatalog(): Catalog {
    return this.data.catalog;
  }

  // ── Song mode ───────────────────────────────────────────────────────────

  /** Capture current live state as a named scene. */
  captureScene(name: string): SongScene {
    const devices: SongScene["devices"] = {};
    for (const [id, ds] of this.deviceStates) {
      devices[id] = {
        genreIdx: ds.genreIdx,
        patternIdx: ds.patternIdx,
        bassGenreIdx: ds.bassGenreIdx,
        bassPatternIdx: ds.bassPatternIdx,
        drumsMuted: ds.drumsMuted,
        bassMuted: ds.bassMuted,
      };
    }

    const mixer: SongScene["mixer"] = this.audioPort ? {
      volumes: this.audioPort.getChannelVolumes(),
      pans: this.audioPort.getChannelPans(),
      chEQ: this.audioPort.getChannelEQs(),
      masterEQ: this.audioPort.getEQ(),
      drive: this.audioPort.getDrive(),
      width: this.audioPort.getWidth(),
      lowCut: this.audioPort.getLowCut(),
      mbOn: this.audioPort.isMultibandEnabled(),
      mbAmount: this.audioPort.getMultibandAmount(),
    } : {
      volumes: {}, pans: {}, chEQ: {},
      masterEQ: { low: 0, mid: 0, high: 0 },
      drive: 0, width: 0.5, lowCut: 0, mbOn: false, mbAmount: 0.25,
    };

    const scene: SongScene = {
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      devices,
      mixer,
      bpm: this.bpm,
    };
    this.songScenes.push(scene);
    this.emitSongState();
    return scene;
  }

  /** Delete a scene by ID. Also removes from arrangement. */
  deleteScene(sceneId: string): void {
    this.songScenes = this.songScenes.filter(s => s.id !== sceneId);
    this.songArrangement = this.songArrangement.filter(e => e.sceneId !== sceneId);
    this.emitSongState();
  }

  /** Set the full arrangement. */
  setSongArrangement(arrangement: SongArrangementEntry[]): void {
    this.songArrangement = arrangement;
    this.emitSongState();
  }

  /** Apply a scene: switch genres/patterns on all devices + load mixer state. */
  private applySongScene(scene: SongScene): void {
    // Apply per-device state
    for (const [id, snap] of Object.entries(scene.devices)) {
      const ds = this.deviceStates.get(id);
      if (!ds) continue;
      if (ds.genreIdx !== snap.genreIdx) this.setGenre(id, snap.genreIdx);
      if (ds.patternIdx !== snap.patternIdx) this.setPattern(id, snap.patternIdx);
      if (ds.bassGenreIdx !== snap.bassGenreIdx) {
        ds.bassGenreIdx = snap.bassGenreIdx;
      }
      if (ds.bassPatternIdx !== snap.bassPatternIdx) {
        ds.bassPatternIdx = snap.bassPatternIdx;
      }
      if (ds.drumsMuted !== snap.drumsMuted) {
        ds.drumsMuted = snap.drumsMuted;
      }
      if (ds.bassMuted !== snap.bassMuted) {
        ds.bassMuted = snap.bassMuted;
      }
    }

    // Apply BPM
    if (this.bpm !== scene.bpm) this.setBpm(scene.bpm);

    // Apply mixer
    if (this.audioPort) this.audioPort.loadScene(scene.mixer);

    this.emitStateNow();
  }

  /** Called at step 0 of the driver device — counts bars and advances scenes. */
  private songBarTick(): void {
    if (!this.songPlaying || this.songArrangement.length === 0) return;

    this.songBarCounter++;
    console.log("[song] bar tick:", this.songBarCounter, "/", this.songArrangement[this.songCurrentIdx]?.bars, "scene:", this.songCurrentIdx);
    const entry = this.songArrangement[this.songCurrentIdx];
    if (!entry) return;

    if (this.songBarCounter >= entry.bars) {
      // Advance to next scene
      this.songBarCounter = 0;
      const nextIdx = this.songCurrentIdx + 1;

      if (nextIdx >= this.songArrangement.length) {
        if (this.songLoop) {
          this.songCurrentIdx = 0;
        } else {
          this.songPlaying = false;
          this.emitSongState();
          return;
        }
      } else {
        this.songCurrentIdx = nextIdx;
      }

      const nextEntry = this.songArrangement[this.songCurrentIdx];
      const nextScene = this.songScenes.find(s => s.id === nextEntry.sceneId);
      if (nextScene) {
        this.applyTransition(nextEntry.transition, nextScene);
      }
    }

    this.emitSongState();
  }

  /** Apply a transition then load the target scene. */
  private applyTransition(type: TransitionType, scene: SongScene): void {
    const barDuration = (16 * 60) / (this.bpm * 4); // seconds per bar (16 steps)

    switch (type) {
      case "instant":
        this.applySongScene(scene);
        break;
      case "fade":
        if (this.audioPort) this.audioPort.transitionFade(scene.mixer.volumes, barDuration);
        // Apply patterns immediately, fade handles volume
        this.applySongScenePatterns(scene);
        break;
      case "filter":
        if (this.audioPort) this.audioPort.transitionFilter(barDuration);
        // Apply scene at midpoint of filter sweep
        setTimeout(() => this.applySongScene(scene), (barDuration * 500));
        break;
      case "breakdown":
        if (this.audioPort) this.audioPort.transitionBreakdown(barDuration, 9);
        this.applySongScene(scene);
        break;
    }
  }

  /** Apply only pattern/genre changes (not mixer) — used by fade transition. */
  private applySongScenePatterns(scene: SongScene): void {
    for (const [id, snap] of Object.entries(scene.devices)) {
      const ds = this.deviceStates.get(id);
      if (!ds) continue;
      if (ds.genreIdx !== snap.genreIdx) this.setGenre(id, snap.genreIdx);
      if (ds.patternIdx !== snap.patternIdx) this.setPattern(id, snap.patternIdx);
      ds.drumsMuted = snap.drumsMuted;
      ds.bassMuted = snap.bassMuted;
    }
    if (this.bpm !== scene.bpm) this.setBpm(scene.bpm);
    this.emitStateNow();
  }

  /** Start song playback from the beginning or current position. */
  songPlay(): void {
    if (this.songArrangement.length === 0) {
      console.warn("[song] no arrangement entries, can't play");
      return;
    }
    this.songPlaying = true;
    this.songCurrentIdx = 0;
    this.songBarCounter = 0;

    // Apply the first scene immediately
    const first = this.songArrangement[0];
    const scene = this.songScenes.find(s => s.id === first.sceneId);
    console.log("[song] play — scenes:", this.songScenes.length, "arrangement:", this.songArrangement.length, "first scene:", scene?.name);
    if (scene) this.applySongScene(scene);

    this.emitSongState();
  }

  /** Stop song playback. */
  songStop(): void {
    this.songPlaying = false;
    this.emitSongState();
  }

  /** Toggle loop mode. */
  songToggleLoop(): void {
    this.songLoop = !this.songLoop;
    this.emitSongState();
  }

  /** Jump to a specific arrangement index. */
  songJump(index: number): void {
    if (index < 0 || index >= this.songArrangement.length) return;
    this.songCurrentIdx = index;
    this.songBarCounter = 0;
    const entry = this.songArrangement[index];
    const scene = this.songScenes.find(s => s.id === entry.sceneId);
    if (scene) this.applySongScene(scene);
    this.emitSongState();
  }

  /** Get current song state for UI. */
  getSongState(): SongState {
    return {
      scenes: this.songScenes,
      arrangement: this.songArrangement,
      loop: this.songLoop,
      playback: {
        playing: this.songPlaying,
        currentIndex: this.songCurrentIdx,
        barInScene: this.songBarCounter,
        totalBars: this.songArrangement.reduce((a, e) => a + e.bars, 0),
      },
    };
  }

  /** Notify UI of song state changes. */
  private emitSongState(): void {
    this.cb.onSongStateChange?.(this.getSongState());
  }
}

/**
 * Synchronous catalog rebuild after extras change.
 * Deep-clones the current catalog, strips old extras genres,
 * then re-injects the updated extras from localStorage.
 */
function loadCatalogSync(
  current: LoadedCatalog,
  extras: Record<string, { name: string; desc: string; steps: unknown }[]>,
): LoadedCatalog {
  // Rebuild catalog by injecting extras as "extras" genre
  const catalog = JSON.parse(JSON.stringify(current.catalog)) as Catalog;
  const pats = JSON.parse(JSON.stringify(current.patterns));

  // Remove existing extras genres
  for (const section of [catalog.s1.genres, ...Object.values(catalog.t8).filter(Array.isArray)]) {
    if (Array.isArray(section)) {
      const extIdx = (section as { name: string }[]).findIndex(g => g.name === "extras");
      if (extIdx >= 0) section.splice(extIdx, 1);
    }
  }

  // Inject S-1 extras
  const s1Extras = extras["s1"] ?? [];
  if (s1Extras.length > 0) {
    catalog.s1.genres.push({ name: "extras", patterns: s1Extras.map(e => ({ name: e.name, desc: e.desc })) });
    pats.s1["extras"] = s1Extras.map(e => e.steps);
  }

  // Inject T-8 drum extras
  const t8DrumExtras = extras["t8_drums"] ?? [];
  if (t8DrumExtras.length > 0) {
    catalog.t8.drum_genres.push({ name: "extras", patterns: t8DrumExtras.map(e => ({ name: e.name, desc: e.desc })) });
    pats.t8Drums["extras"] = t8DrumExtras.map(e => e.steps);
  }

  // Inject T-8 bass extras
  const t8BassExtras = extras["t8_bass"] ?? [];
  if (t8BassExtras.length > 0) {
    catalog.t8.bass_genres.push({ name: "extras", patterns: t8BassExtras.map(e => ({ name: e.name, desc: e.desc })) });
    pats.t8Bass["extras"] = t8BassExtras.map(e => e.steps);
  }

  return { catalog, patterns: pats };
}
