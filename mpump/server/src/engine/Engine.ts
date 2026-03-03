import type { StepData, DrumHit, EngineState, Catalog, DeviceState } from "../types";
import type { MidiPort } from "./MidiPort";
import { MidiClock } from "./MidiClock";
import { Sequencer } from "./Sequencer";
import { T8Sequencer } from "./T8Sequencer";
import { type DetectedPorts, detectPorts } from "./MidiAccess";
import { getMelodicPattern, getDrumPattern, getBassPattern } from "../data/patterns";
import { loadCatalog, getDeviceGenres, getDeviceBassGenres, getExtrasKey, getBassExtrasKey, getMelodicSource, type LoadedCatalog } from "../data/catalog";
import { DEVICE_REGISTRY, findDeviceConfig, type DeviceConfig } from "../data/devices";
import { parseKey } from "../data/keys";

export interface EngineCallbacks {
  onStateChange: (state: EngineState) => void;
  onStep: (device: string, step: number) => void;
  onCatalogChange: (catalog: Catalog) => void;
}

// ── Per-device internal state (not exported to UI) ───────────────────────

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
  melodicEdit: (StepData | null)[] | null;
  drumEdit: DrumHit[][] | null;
  bassEdit: (StepData | null)[] | null;
}

/**
 * Orchestrator: manages device lifecycle, sequencers, clocks, state, and edits.
 * Data-driven — supports any device in the DEVICE_REGISTRY.
 */
export class Engine {
  private access: MIDIAccess;
  private cb: EngineCallbacks;
  private data!: LoadedCatalog;

  bpm = 120;

  // Per-device state
  private deviceStates: Map<string, InternalDeviceState> = new Map();

  // Active sequencers/clocks
  private sequencers: Map<string, Sequencer | T8Sequencer> = new Map();
  private clocks: Map<string, MidiClock> = new Map();
  private ports: DetectedPorts = {};
  private stopped: Set<string> = new Set();

  // Global step grid origin
  private t0: number = performance.now();

  // Visibility handling
  private visHandler: (() => void) | null = null;
  private unloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  constructor(access: MIDIAccess, callbacks: EngineCallbacks) {
    this.access = access;
    this.cb = callbacks;

    // Initialize state for every registered device
    for (const config of DEVICE_REGISTRY) {
      this.deviceStates.set(config.id, {
        config,
        genreIdx: 0, patternIdx: 0,
        bassGenreIdx: 0, bassPatternIdx: 0,
        keyIdx: 0, octave: 2,
        step: -1, connected: false, paused: false,
        melodicEdit: null, drumEdit: null, bassEdit: null,
      });
    }
  }

  async init(): Promise<void> {
    this.data = await loadCatalog();
    this.t0 = performance.now();

    // Hot-plug detection
    this.access.onstatechange = () => this.handleDeviceChange();

    // Initial scan
    this.handleDeviceChange();

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
    this.cb.onStateChange(this.getState());
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

    if (this.visHandler) document.removeEventListener("visibilitychange", this.visHandler);
    if (this.unloadHandler) window.removeEventListener("beforeunload", this.unloadHandler);
  }

  // ── Device detection ─────────────────────────────────────────────────

  private handleDeviceChange(): void {
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

    this.cb.onStateChange(this.getState());
  }

  // ── Sequencer lifecycle ──────────────────────────────────────────────

  private nextBarBoundary(): number {
    const stepDur = 60000 / (this.bpm * 4);
    const barDur = 16 * stepDur;
    const now = performance.now();
    const elapsed = now - this.t0;
    const n = Math.ceil(elapsed / barDur);
    let tBar = this.t0 + n * barDur;
    if (tBar - now < 50) tBar += barDur;
    return tBar;
  }

  private startDevice(id: string): void {
    const port = this.ports[id];
    const ds = this.deviceStates.get(id);
    if (!port || !ds) return;
    const config = ds.config;

    const tStart = this.nextBarBoundary();

    if (config.mode === "synth") {
      const pattern = ds.melodicEdit ?? this.getDeviceMelodicPattern(id);
      const root = this.getDeviceRoot(id);

      let pc: number | null = null;
      if (config.useProgramChange) {
        const genres = this.getDeviceGenres(id);
        const genre = genres[ds.genreIdx]?.name ?? "";
        const chordSet = this.data.catalog.j6.chord_sets?.[genre] ?? null;
        pc = chordSet !== null ? chordSet - 1 : null;
      }

      const seq = new Sequencer({
        port, channel: config.channels.main,
        pattern, rootNote: root,
        baseVelocity: config.baseVelocity,
        gateFraction: config.gateFraction,
        bpm: this.bpm, tStart,
        programChange: pc,
      });
      seq.onStep = (step) => {
        ds.step = step;
        this.cb.onStep(id, step);
      };
      seq.start();
      this.sequencers.set(id, seq);

    } else {
      // drums or drums+bass
      const drumPattern = ds.drumEdit ?? this.getDeviceDrumPattern(id);
      const bassPattern = config.mode === "drums+bass"
        ? (ds.bassEdit ?? this.getDeviceBassPattern(id))
        : Array.from({ length: 16 }, (): null => null);
      const root = config.hasKey ? this.getDeviceRoot(id) : config.rootNote;

      const seq = new T8Sequencer({
        port,
        drumChannel: config.channels.main,
        bassChannel: config.channels.bass ?? config.channels.main,
        drumPattern, bassPattern,
        bassRoot: root,
        baseVelocity: config.baseVelocity,
        drumGateFraction: config.drumGateFraction,
        bassGateFraction: config.gateFraction,
        drumMap: config.drumMap,
        bpm: this.bpm, tStart,
      });
      seq.onStep = (step) => {
        ds.step = step;
        this.cb.onStep(id, step);
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

  private stopDevice(id: string): void {
    const seq = this.sequencers.get(id);
    if (seq) { seq.stop(); this.sequencers.delete(id); }
    const clk = this.clocks.get(id);
    if (clk) { clk.stop(); this.clocks.delete(id); }
  }

  private restartDevice(id: string): void {
    this.stopDevice(id);
    const ds = this.deviceStates.get(id);
    if (ds && this.ports[id] && !this.stopped.has(id)) {
      this.startDevice(id);
    }
  }

  private pauseAll(): void {
    for (const [id] of this.sequencers) {
      this.stopDevice(id);
    }
  }

  private resumeAll(): void {
    for (const [id, ds] of this.deviceStates) {
      if (ds.connected && this.ports[id] && !this.stopped.has(id)) {
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
    const isBass = device.endsWith("_bass");
    const deviceId = isBass ? device.slice(0, -5) : device;
    const ds = this.deviceStates.get(deviceId);
    if (!ds) return;

    if (isBass) {
      ds.bassGenreIdx = idx;
      ds.bassPatternIdx = 0;
      ds.bassEdit = null;
    } else {
      ds.genreIdx = idx;
      ds.patternIdx = 0;
      if (ds.config.mode === "synth") {
        ds.melodicEdit = null;
      } else {
        ds.drumEdit = null;
      }
    }
    this.restartDevice(deviceId);
    this.cb.onStateChange(this.getState());
  }

  setPattern(device: string, idx: number): void {
    const isBass = device.endsWith("_bass");
    const deviceId = isBass ? device.slice(0, -5) : device;
    const ds = this.deviceStates.get(deviceId);
    if (!ds) return;

    if (isBass) {
      ds.bassPatternIdx = idx;
      ds.bassEdit = null;
    } else {
      ds.patternIdx = idx;
      if (ds.config.mode === "synth") {
        ds.melodicEdit = null;
      } else {
        ds.drumEdit = null;
      }
    }
    this.restartDevice(deviceId);
    this.cb.onStateChange(this.getState());
  }

  setKey(device: string, idx: number): void {
    const ds = this.deviceStates.get(device);
    if (!ds || !ds.config.hasKey) return;
    ds.keyIdx = idx;
    this.restartDevice(device);
    this.cb.onStateChange(this.getState());
  }

  setOctave(device: string, octave: number): void {
    const ds = this.deviceStates.get(device);
    if (!ds || !ds.config.hasOctave) return;
    ds.octave = octave;
    this.restartDevice(device);
    this.cb.onStateChange(this.getState());
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(20, Math.min(300, bpm));
    this.t0 = performance.now();

    // Update all clocks
    for (const [, clk] of this.clocks) clk.setBpm(this.bpm);

    // Restart all active sequencers at new bar boundary
    for (const [id] of this.sequencers) {
      this.restartDevice(id);
    }
    this.cb.onStateChange(this.getState());
  }

  private randomizeDevice(id: string): void {
    const ds = this.deviceStates.get(id);
    if (!ds || !ds.connected) return;

    const genres = this.getDeviceGenres(id);
    if (genres.length === 0) return;

    const nonExtras = genres.map((g, i) => ({ g, i })).filter(x => x.g.name !== "extras");
    if (nonExtras.length === 0) return;
    const pick = nonExtras[Math.floor(Math.random() * nonExtras.length)];
    ds.genreIdx = pick.i;
    ds.patternIdx = Math.floor(Math.random() * pick.g.patterns.length);
    ds.melodicEdit = null;
    ds.drumEdit = null;

    if (ds.config.mode === "drums+bass") {
      const bassGenres = this.getDeviceBassGenres();
      const bassNonExtras = bassGenres.map((g, i) => ({ g, i })).filter(x => x.g.name !== "extras");
      if (bassNonExtras.length > 0) {
        const bassPick = bassNonExtras[Math.floor(Math.random() * bassNonExtras.length)];
        ds.bassGenreIdx = bassPick.i;
        ds.bassPatternIdx = Math.floor(Math.random() * bassPick.g.patterns.length);
        ds.bassEdit = null;
      }
    }

    this.restartDevice(id);
  }

  randomizeAll(): void {
    for (const [id, ds] of this.deviceStates) {
      if (!ds.connected) continue;
      this.randomizeDevice(id);
    }
    this.cb.onStateChange(this.getState());
  }

  randomizeSingle(device: string): void {
    this.randomizeDevice(device);
    this.cb.onStateChange(this.getState());
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

    this.restartDevice(device);
    this.cb.onStateChange(this.getState());
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
    this.cb.onStateChange(this.getState());
  }

  // ── Edit commands ────────────────────────────────────────────────────

  editStep(device: string, stepIdx: number, data: StepData | null): void {
    const isBass = device.endsWith("_bass");
    const deviceId = isBass ? device.slice(0, -5) : device;
    const ds = this.deviceStates.get(deviceId);
    if (!ds) return;

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
    this.cb.onStateChange(this.getState());
  }

  editDrumStep(device: string, stepIdx: number, hits: DrumHit[]): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    if (!ds.drumEdit) {
      ds.drumEdit = this.getDeviceDrumPattern(device).map(h => [...h]);
    }
    ds.drumEdit[stepIdx] = hits;
    const seq = this.sequencers.get(device) as T8Sequencer | undefined;
    if (seq) seq.setDrumPattern(ds.drumEdit);
    this.cb.onStateChange(this.getState());
  }

  discardEdit(device: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    ds.melodicEdit = null;
    ds.drumEdit = null;
    ds.bassEdit = null;
    this.restartDevice(device);
    this.cb.onStateChange(this.getState());
  }

  saveToExtras(device: string, name: string, desc: string): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    const extras = this.loadExtras();
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
      if (config.mode === "synth") {
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

    this.saveExtras(extras);
    this.data = loadCatalogSync(this.data, extras);
    this.restartDevice(device);
    this.cb.onCatalogChange(this.getCatalog());
    this.cb.onStateChange(this.getState());
  }

  deleteExtra(device: string, idx: number): void {
    const ds = this.deviceStates.get(device);
    if (!ds) return;
    const extras = this.loadExtras();
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

    this.saveExtras(extras);
    this.data = loadCatalogSync(this.data, extras);
    this.cb.onCatalogChange(this.getCatalog());
    this.cb.onStateChange(this.getState());
  }

  // ── localStorage extras ──────────────────────────────────────────────

  private loadExtras(): Record<string, { name: string; desc: string; steps: unknown }[]> {
    try {
      const raw = localStorage.getItem("mpump-extras");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveExtras(extras: Record<string, unknown>): void {
    localStorage.setItem("mpump-extras", JSON.stringify(extras));
  }

  // ── State serialization ──────────────────────────────────────────────

  getState(): EngineState {
    const devices: Record<string, DeviceState> = {};

    for (const [id, ds] of this.deviceStates) {
      const config = ds.config;
      const editing = ds.melodicEdit !== null || ds.drumEdit !== null || ds.bassEdit !== null;

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
        pattern_data: config.mode === "synth"
          ? (ds.melodicEdit ?? this.getDeviceMelodicPattern(id))
          : [],
        drum_data: config.mode !== "synth"
          ? (ds.drumEdit ?? this.getDeviceDrumPattern(id))
          : [],
        bass_data: config.mode === "drums+bass"
          ? (ds.bassEdit ?? this.getDeviceBassPattern(id))
          : [],
        label: config.label,
        accent: config.accent,
        hasKey: config.hasKey,
        hasOctave: config.hasOctave,
      };
    }

    return { bpm: this.bpm, devices };
  }

  getCatalog(): Catalog {
    return this.data.catalog;
  }
}

/** Synchronous catalog rebuild after extras change. */
function loadCatalogSync(
  current: LoadedCatalog,
  extras: Record<string, { name: string; desc: string; steps: unknown }[]>,
): LoadedCatalog {
  // Rebuild catalog by injecting extras as "extras" genre
  const catalog = JSON.parse(JSON.stringify(current.catalog)) as Catalog;
  const pats = JSON.parse(JSON.stringify(current.patterns));

  // Remove existing extras genres
  for (const section of [catalog.s1.genres, ...Object.values(catalog.t8).filter(Array.isArray), catalog.j6.genres]) {
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

  // Inject J-6 extras
  const j6Extras = extras["j6"] ?? [];
  if (j6Extras.length > 0) {
    catalog.j6.genres.push({ name: "extras", patterns: j6Extras.map(e => ({ name: e.name, desc: e.desc })) });
    pats.j6["extras"] = j6Extras.map(e => e.steps);
  }

  return { catalog, patterns: pats };
}
