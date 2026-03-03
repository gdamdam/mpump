import type { StepData, DrumHit, EngineState, Catalog } from "../types";
import type { MidiPort } from "./MidiPort";
import { MidiClock } from "./MidiClock";
import { Sequencer } from "./Sequencer";
import { T8Sequencer } from "./T8Sequencer";
import { type DetectedPorts, type DeviceName, detectPorts } from "./MidiAccess";
import { getPattern, getDrumPattern, getBassPattern, getJ6Pattern } from "../data/patterns";
import { loadCatalog, type LoadedCatalog } from "../data/catalog";
import { DEVICES } from "../data/devices";
import { parseKey } from "../data/keys";

export interface EngineCallbacks {
  onStateChange: (state: EngineState) => void;
  onStep: (device: string, step: number) => void;
  onCatalogChange: (catalog: Catalog) => void;
}

/**
 * Orchestrator: manages device lifecycle, sequencers, clocks, state, and edits.
 * Port of WebEngine + DeviceScanner for the browser.
 */
export class Engine {
  private access: MIDIAccess;
  private cb: EngineCallbacks;
  private data!: LoadedCatalog;

  // State
  bpm = 120;

  // S-1
  s1GenreIdx = 0; s1PatternIdx = 0; s1KeyIdx = 0; s1Octave = 2;
  s1Step = -1; s1Connected = false; s1Paused = false;
  private s1Edit: (StepData | null)[] | null = null;

  // T-8
  t8DrumGenreIdx = 0; t8BassGenreIdx = 0;
  t8PatternIdx = 0; t8BassPatternIdx = 0;
  t8KeyIdx = 0; t8Octave = 2;
  t8Step = -1; t8Connected = false; t8Paused = false;
  private t8DrumEdit: DrumHit[][] | null = null;
  private t8BassEdit: (StepData | null)[] | null = null;

  // J-6
  j6GenreIdx = 0; j6PatternIdx = 0;
  j6Step = -1; j6Connected = false; j6Paused = false;
  private j6Edit: (StepData | null)[] | null = null;

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
        port.allNotesOff(0);
        port.allNotesOff(1);
        port.allNotesOff(9);
      }
    }

    if (this.visHandler) document.removeEventListener("visibilitychange", this.visHandler);
    if (this.unloadHandler) window.removeEventListener("beforeunload", this.unloadHandler);
  }

  // ── Device detection ─────────────────────────────────────────────────

  private handleDeviceChange(): void {
    const newPorts = detectPorts(this.access);
    const allDevices: DeviceName[] = ["S-1", "T-8", "J-6"];

    for (const name of allDevices) {
      const wasConnected = !!this.ports[name];
      const isConnected = !!newPorts[name];

      if (!wasConnected && isConnected && !this.stopped.has(name)) {
        // New device — start
        this.ports[name] = newPorts[name];
        this.setConnected(name, true);
        this.startDevice(name);
      } else if (wasConnected && !isConnected) {
        // Device removed — stop
        this.stopDevice(name);
        delete this.ports[name];
        this.setConnected(name, false);
      } else if (isConnected) {
        // Still connected — update port ref
        this.ports[name] = newPorts[name];
      }
    }

    this.cb.onStateChange(this.getState());
  }

  private setConnected(name: DeviceName, connected: boolean): void {
    if (name === "S-1") { this.s1Connected = connected; if (!connected) this.s1Step = -1; }
    else if (name === "T-8") { this.t8Connected = connected; if (!connected) this.t8Step = -1; }
    else if (name === "J-6") { this.j6Connected = connected; if (!connected) this.j6Step = -1; }
  }

  // ── Sequencer lifecycle ──────────────────────────────────────────────

  private nextBarBoundary(): number {
    const stepDur = 60000 / (this.bpm * 4);
    const barDur = 16 * stepDur;
    const now = performance.now();
    const elapsed = now - this.t0;
    let n = Math.ceil(elapsed / barDur);
    let tBar = this.t0 + n * barDur;
    if (tBar - now < 50) tBar += barDur;
    return tBar;
  }

  private startDevice(name: DeviceName): void {
    const port = this.ports[name];
    if (!port) return;

    const tStart = this.nextBarBoundary();

    if (name === "S-1") {
      const pattern = this.s1Edit ?? this.getS1Pattern();
      const root = this.getS1Root();
      const seq = new Sequencer({
        port, channel: DEVICES["S-1"].channel,
        pattern, rootNote: root,
        baseVelocity: DEVICES["S-1"].baseVelocity,
        gateFraction: DEVICES["S-1"].gateFraction,
        bpm: this.bpm, tStart,
      });
      seq.onStep = (step) => {
        this.s1Step = step;
        this.cb.onStep("s1", step);
      };
      seq.start();
      this.sequencers.set("S-1", seq);

      const clock = new MidiClock(port, this.bpm);
      clock.start();
      this.clocks.set("S-1", clock);

    } else if (name === "T-8") {
      const drumPattern = this.t8DrumEdit ?? this.getT8DrumPattern();
      const bassPattern = this.t8BassEdit ?? this.getT8BassPattern();
      const root = this.getT8Root();
      const seq = new T8Sequencer({
        port, drumPattern, bassPattern,
        bassRoot: root,
        baseVelocity: DEVICES["T-8"].baseVelocity,
        bpm: this.bpm, tStart,
      });
      seq.onStep = (step) => {
        this.t8Step = step;
        this.cb.onStep("t8", step);
      };
      seq.start();
      this.sequencers.set("T-8", seq);

      const clock = new MidiClock(port, this.bpm);
      clock.start();
      this.clocks.set("T-8", clock);

    } else if (name === "J-6") {
      const pattern = this.j6Edit ?? this.getJ6Pattern();
      const genre = this.data.catalog.j6.genres[this.j6GenreIdx]?.name ?? "";
      const chordSet = this.data.catalog.j6.chord_sets?.[genre] ?? null;
      const pc = chordSet !== null ? chordSet - 1 : null;
      const seq = new Sequencer({
        port, channel: DEVICES["J-6"].channel,
        pattern, rootNote: DEVICES["J-6"].rootNote,
        baseVelocity: DEVICES["J-6"].baseVelocity,
        gateFraction: DEVICES["J-6"].gateFraction,
        bpm: this.bpm, tStart,
        programChange: pc,
      });
      seq.onStep = (step) => {
        this.j6Step = step;
        this.cb.onStep("j6", step);
      };
      seq.start();
      this.sequencers.set("J-6", seq);

      const clock = new MidiClock(port, this.bpm);
      clock.start();
      this.clocks.set("J-6", clock);
    }
  }

  private stopDevice(name: DeviceName): void {
    const seq = this.sequencers.get(name);
    if (seq) { seq.stop(); this.sequencers.delete(name); }
    const clk = this.clocks.get(name);
    if (clk) { clk.stop(); this.clocks.delete(name); }
  }

  private restartDevice(name: DeviceName): void {
    this.stopDevice(name);
    if (this.ports[name] && !this.stopped.has(name)) {
      this.startDevice(name);
    }
  }

  private pauseAll(): void {
    for (const [name] of this.sequencers) {
      this.stopDevice(name as DeviceName);
    }
  }

  private resumeAll(): void {
    const allDevices: DeviceName[] = ["S-1", "T-8", "J-6"];
    for (const name of allDevices) {
      if (this.ports[name] && !this.stopped.has(name)) {
        this.startDevice(name);
      }
    }
  }

  // ── Pattern helpers ──────────────────────────────────────────────────

  private getS1Pattern(): (StepData | null)[] {
    const genre = this.data.catalog.s1.genres[this.s1GenreIdx]?.name ?? "";
    return getPattern("s1", genre, this.s1PatternIdx);
  }

  private getS1Root(): number {
    const keyName = this.data.catalog.keys[this.s1KeyIdx] ?? "A";
    return parseKey(keyName, this.s1Octave);
  }

  private getT8DrumPattern(): DrumHit[][] {
    const genre = this.data.catalog.t8.drum_genres[this.t8DrumGenreIdx]?.name ?? "";
    return getDrumPattern(genre, this.t8PatternIdx);
  }

  private getT8BassPattern(): (StepData | null)[] {
    const genre = this.data.catalog.t8.bass_genres[this.t8BassGenreIdx]?.name ?? "";
    return getBassPattern(genre, this.t8BassPatternIdx);
  }

  private getT8Root(): number {
    const keyName = this.data.catalog.keys[this.t8KeyIdx] ?? "A";
    return parseKey(keyName, this.t8Octave);
  }

  private getJ6Pattern(): (StepData | null)[] {
    const genre = this.data.catalog.j6.genres[this.j6GenreIdx]?.name ?? "";
    return getJ6Pattern(genre, this.j6PatternIdx);
  }

  // ── Commands ─────────────────────────────────────────────────────────

  setGenre(device: string, idx: number): void {
    if (device === "s1") {
      this.s1GenreIdx = idx;
      this.s1PatternIdx = 0;
      this.s1Edit = null;
      this.restartDevice("S-1");
    } else if (device === "t8") {
      this.t8DrumGenreIdx = idx;
      this.t8PatternIdx = 0;
      this.t8DrumEdit = null;
      this.restartDevice("T-8");
    } else if (device === "t8_bass") {
      this.t8BassGenreIdx = idx;
      this.t8BassPatternIdx = 0;
      this.t8BassEdit = null;
      this.restartDevice("T-8");
    } else if (device === "j6") {
      this.j6GenreIdx = idx;
      this.j6PatternIdx = 0;
      this.j6Edit = null;
      this.restartDevice("J-6");
    }
    this.cb.onStateChange(this.getState());
  }

  setPattern(device: string, idx: number): void {
    if (device === "s1") {
      this.s1PatternIdx = idx;
      this.s1Edit = null;
      this.restartDevice("S-1");
    } else if (device === "t8") {
      this.t8PatternIdx = idx;
      this.t8DrumEdit = null;
      this.restartDevice("T-8");
    } else if (device === "t8_bass") {
      this.t8BassPatternIdx = idx;
      this.t8BassEdit = null;
      this.restartDevice("T-8");
    } else if (device === "j6") {
      this.j6PatternIdx = idx;
      this.j6Edit = null;
      this.restartDevice("J-6");
    }
    this.cb.onStateChange(this.getState());
  }

  setKey(device: string, idx: number): void {
    if (device === "s1") {
      this.s1KeyIdx = idx;
      this.restartDevice("S-1");
    } else if (device === "t8") {
      this.t8KeyIdx = idx;
      this.restartDevice("T-8");
    }
    this.cb.onStateChange(this.getState());
  }

  setOctave(device: string, octave: number): void {
    if (device === "s1") {
      this.s1Octave = octave;
      this.restartDevice("S-1");
    } else if (device === "t8") {
      this.t8Octave = octave;
      this.restartDevice("T-8");
    }
    this.cb.onStateChange(this.getState());
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(20, Math.min(300, bpm));
    this.t0 = performance.now();

    // Update all clocks
    for (const [, clk] of this.clocks) clk.setBpm(this.bpm);

    // Restart all sequencers at new bar boundary
    const devices: DeviceName[] = ["S-1", "T-8", "J-6"];
    for (const name of devices) {
      if (this.sequencers.has(name)) {
        this.restartDevice(name);
      }
    }
    this.cb.onStateChange(this.getState());
  }

  togglePause(device: string): void {
    const nameMap: Record<string, DeviceName> = { s1: "S-1", t8: "T-8", j6: "J-6" };
    const name = nameMap[device];
    if (!name) return;

    if (this.stopped.has(name)) {
      this.stopped.delete(name);
      if (device === "s1") this.s1Paused = false;
      else if (device === "t8") this.t8Paused = false;
      else if (device === "j6") this.j6Paused = false;
      if (this.ports[name]) this.startDevice(name);
    } else {
      this.stopped.add(name);
      if (device === "s1") { this.s1Paused = true; this.s1Step = -1; }
      else if (device === "t8") { this.t8Paused = true; this.t8Step = -1; }
      else if (device === "j6") { this.j6Paused = true; this.j6Step = -1; }
      this.stopDevice(name);
    }
    this.cb.onStateChange(this.getState());
  }

  // ── Edit commands ────────────────────────────────────────────────────

  editStep(device: string, stepIdx: number, data: StepData | null): void {
    if (device === "s1") {
      if (!this.s1Edit) this.s1Edit = [...this.getS1Pattern()];
      this.s1Edit[stepIdx] = data;
      const seq = this.sequencers.get("S-1") as Sequencer | undefined;
      seq?.setPattern(this.s1Edit);
    } else if (device === "t8_bass") {
      if (!this.t8BassEdit) this.t8BassEdit = [...this.getT8BassPattern()];
      this.t8BassEdit[stepIdx] = data;
      const seq = this.sequencers.get("T-8") as T8Sequencer | undefined;
      if (seq) seq.setBassPattern(this.t8BassEdit);
    } else if (device === "j6") {
      if (!this.j6Edit) this.j6Edit = [...this.getJ6Pattern()];
      this.j6Edit[stepIdx] = data;
      const seq = this.sequencers.get("J-6") as Sequencer | undefined;
      seq?.setPattern(this.j6Edit);
    }
    this.cb.onStateChange(this.getState());
  }

  editDrumStep(stepIdx: number, hits: DrumHit[]): void {
    if (!this.t8DrumEdit) {
      this.t8DrumEdit = this.getT8DrumPattern().map(h => [...h]);
    }
    this.t8DrumEdit[stepIdx] = hits;
    const seq = this.sequencers.get("T-8") as T8Sequencer | undefined;
    if (seq) seq.setDrumPattern(this.t8DrumEdit);
    this.cb.onStateChange(this.getState());
  }

  discardEdit(device: string): void {
    if (device === "s1") {
      this.s1Edit = null;
      this.restartDevice("S-1");
    } else if (device === "t8") {
      this.t8DrumEdit = null;
      this.t8BassEdit = null;
      this.restartDevice("T-8");
    } else if (device === "j6") {
      this.j6Edit = null;
      this.restartDevice("J-6");
    }
    this.cb.onStateChange(this.getState());
  }

  saveToExtras(device: string, name: string, desc: string): void {
    const extras = this.loadExtras();
    let steps: unknown;
    let key: string;

    if (device === "s1") {
      key = "s1";
      steps = this.s1Edit ?? this.getS1Pattern();
      this.s1Edit = null;
    } else if (device === "t8") {
      // Save both drum and bass
      const drumKey = "t8_drums";
      const bassKey = "t8_bass";
      const drumSteps = this.t8DrumEdit ?? this.getT8DrumPattern();
      const bassSteps = this.t8BassEdit ?? this.getT8BassPattern();

      extras[drumKey] = extras[drumKey] ?? [];
      extras[drumKey].push({ name, desc, steps: drumSteps });
      extras[bassKey] = extras[bassKey] ?? [];
      extras[bassKey].push({ name, desc, steps: bassSteps });

      this.t8DrumEdit = null;
      this.t8BassEdit = null;
      this.saveExtras(extras);
      this.data = loadCatalogSync(this.data, extras);
      this.restartDevice("T-8");
      this.cb.onCatalogChange(this.getCatalog());
      this.cb.onStateChange(this.getState());
      return;
    } else if (device === "j6") {
      key = "j6";
      steps = this.j6Edit ?? this.getJ6Pattern();
      this.j6Edit = null;
    } else {
      return;
    }

    extras[key] = extras[key] ?? [];
    extras[key].push({ name, desc, steps });
    this.saveExtras(extras);
    this.data = loadCatalogSync(this.data, extras);

    const nameMap: Record<string, DeviceName> = { s1: "S-1", j6: "J-6" };
    if (nameMap[device]) this.restartDevice(nameMap[device]);

    this.cb.onCatalogChange(this.getCatalog());
    this.cb.onStateChange(this.getState());
  }

  deleteExtra(device: string, idx: number): void {
    const extras = this.loadExtras();
    const keyMap: Record<string, string> = { s1: "s1", t8: "t8_drums", t8_bass: "t8_bass", j6: "j6" };

    if (device === "t8") {
      // Delete from both drums and bass at same index
      const drumList = extras["t8_drums"] ?? [];
      const bassList = extras["t8_bass"] ?? [];
      if (idx >= 0 && idx < drumList.length) drumList.splice(idx, 1);
      if (idx >= 0 && idx < bassList.length) bassList.splice(idx, 1);
    } else {
      const key = keyMap[device];
      if (!key) return;
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
    const s1Editing = this.s1Edit !== null;
    const t8Editing = this.t8DrumEdit !== null || this.t8BassEdit !== null;
    const j6Editing = this.j6Edit !== null;

    return {
      bpm: this.bpm,
      s1: {
        genre_idx: this.s1GenreIdx,
        pattern_idx: this.s1PatternIdx,
        key_idx: this.s1KeyIdx,
        octave: this.s1Octave,
        step: this.s1Step,
        connected: this.s1Connected,
        paused: this.s1Paused,
        editing: s1Editing,
        pattern_data: this.s1Edit ?? this.getS1Pattern(),
      },
      t8: {
        drum_genre_idx: this.t8DrumGenreIdx,
        bass_genre_idx: this.t8BassGenreIdx,
        pattern_idx: this.t8PatternIdx,
        bass_pattern_idx: this.t8BassPatternIdx,
        key_idx: this.t8KeyIdx,
        octave: this.t8Octave,
        step: this.t8Step,
        connected: this.t8Connected,
        paused: this.t8Paused,
        editing: t8Editing,
        drum_data: this.t8DrumEdit ?? this.getT8DrumPattern(),
        bass_data: this.t8BassEdit ?? this.getT8BassPattern(),
      },
      j6: {
        genre_idx: this.j6GenreIdx,
        pattern_idx: this.j6PatternIdx,
        step: this.j6Step,
        connected: this.j6Connected,
        paused: this.j6Paused,
        editing: j6Editing,
        pattern_data: this.j6Edit ?? this.getJ6Pattern(),
      },
    };
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
