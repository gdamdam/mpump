// ── Pattern data ──────────────────────────────────────────────────────────

export interface StepData {
  semi: number;
  vel: number;
  slide: boolean;
}

export interface DrumHit {
  note: number;
  vel: number;
}

// ── Synth params (audio preview only) ────────────────────────────────────

export type OscType = "sawtooth" | "square" | "sine" | "triangle" | "pwm" | "sync" | "fm" | "wavetable";
export type FilterModel = "digital" | "mog" | "303";

export type LfoShape = "sine" | "square" | "triangle" | "sawtooth";
export type LfoTarget = "cutoff" | "pitch" | "both";
export type FilterType = "lowpass" | "highpass" | "bandpass" | "notch";

export interface SynthParams {
  oscType: OscType;
  attack: number;   // seconds (0.001–2)
  decay: number;    // seconds (0.01–2)
  sustain: number;  // level   (0–1)
  release: number;  // seconds (0.01–3)
  filterOn: boolean;
  filterType: FilterType;
  cutoff: number;   // Hz      (100–8000)
  resonance: number; // Q      (0.5–20)
  subOsc: boolean;  // sub-bass oscillator (-1 octave, sine)
  subLevel: number; // sub-bass level (0–1)
  detune: number;    // cents (-50 to +50)
  lfoOn: boolean;
  lfoSync: boolean;     // true = tempo-synced, false = free Hz
  lfoRate: number;      // Hz (0.1–20, used when lfoSync=false)
  lfoDivision: string;  // "2", "1", "1/2", "1/4", "1/8", "1/16", "1/32"
  lfoDepth: number;     // 0–1
  lfoShape: LfoShape;
  lfoTarget: LfoTarget;
  filterEnvDepth?: number; // filter envelope mod depth (0-1, default 0). Sweeps cutoff from cutoff+depth down to cutoff on each note.
  filterDecay?: number;    // independent filter envelope decay time in seconds (0 = use amp decay).
  filterDrive?: number;    // pre-filter drive (0-1, default 0). Pushes signal into filter for resonance/self-oscillation.
  filterModel?: FilterModel; // filter algorithm: digital (BiquadFilter), mog (4-pole ladder), 303 (diode)
  syncRatio?: number;     // hard sync slave ratio (1-16, default 2). Only used when oscType="sync".
  fmRatio?: number;       // FM modulator ratio (0.5-16, default 2). Only used when oscType="fm".
  fmIndex?: number;       // FM modulation index (0-100, default 5). Only used when oscType="fm".
  wavetable?: string;     // wavetable name (basic/vocal/metallic/pad/organ). Only used when oscType="wavetable".
  wavetablePos?: number;  // wavetable morph position (0-1, default 0.5). Only used when oscType="wavetable".
  unison?: number;        // voice count (1-7, default 1)
  unisonSpread?: number;  // detune spread in cents (0-50, default 0)
  noteLength?: number;    // note duration in steps (1=16th, 4=quarter, 8=half). Default 1.
  gain?: number;          // preset-level gain offset (default 1.0). Boost quieter presets to match louder ones.
}

export const LFO_DIVISIONS = ["2", "1", "1/2", "1/4", "1/8", "1/16", "1/32"] as const;

/** Convert LFO division string to Hz at given BPM. */
export function lfoDivisionToHz(division: string, bpm: number): number {
  const beatHz = bpm / 60;
  switch (division) {
    case "2":    return beatHz / 8;   // 2 bars
    case "1":    return beatHz / 4;   // 1 bar
    case "1/2":  return beatHz / 2;
    case "1/4":  return beatHz;
    case "1/8":  return beatHz * 2;
    case "1/16": return beatHz * 4;
    case "1/32": return beatHz * 8;
    default:     return beatHz;
  }
}

/** Delay divisions available for tempo-synced delay. */
export const DELAY_DIVISIONS = ["1/2", "1/4", "1/8", "1/8d", "1/16", "1/32"] as const;

/** Convert delay division string to time in seconds at given BPM. */
export function delayDivisionToSeconds(division: string, bpm: number): number {
  const beat = 60 / bpm; // quarter note duration
  switch (division) {
    case "1/2":  return beat * 2;
    case "1/4":  return beat;
    case "1/8":  return beat / 2;
    case "1/8d": return beat * 0.75; // dotted eighth
    case "1/16": return beat / 4;
    case "1/32": return beat / 8;
    default:     return beat / 4;
  }
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  oscType: "sawtooth",
  attack: 0.005,
  decay: 0.15,
  sustain: 0.6,
  release: 0.06,
  filterOn: true,
  filterType: "lowpass",
  cutoff: 4000,
  resonance: 4,
  subOsc: true,
  subLevel: 0.5,
  detune: 0,
  lfoOn: false,
  lfoSync: false,
  lfoRate: 2,
  lfoDivision: "1/4",
  lfoDepth: 0.5,
  lfoShape: "sine",
  lfoTarget: "cutoff",
};

// ── Drum voice params (audio preview only) ───────────────────────────────

export interface DrumVoiceParams {
  tune: number;   // semitones (-24 to +24, default 0)
  decay: number;  // multiplier (0.2 to 3.0, default 1.0)
  level: number;  // volume (0 to 1, default 1.0)
  // Extended params (optional, defaults to classic behavior)
  click?: number;        // kick: attack click level (0-1, default 0.15)
  sweepDepth?: number;   // kick: pitch sweep amount (0-1, default 0.5)
  sweepRate?: number;    // kick: pitch sweep speed (0-1, default 0.5)
  noiseMix?: number;     // snare: noise vs tone balance (0=tone, 1=noise, default 0.55)
  color?: number;        // hats: brightness (-1=dark, 0=neutral, 1=bright, default 0)
  clickTune?: number;    // kick: click pitch (-1=warm/low, 0=mid, 1=bright/high, default 0)
  filterCutoff?: number; // per-voice LP filter (0=very dark, 1=bypass, default 1)
  pan?: number;          // stereo pan (-1=left, 0=center, 1=right)
}

export const DRUM_VOICES = [
  { note: 36, name: "BD" },
  { note: 37, name: "RS" },
  { note: 38, name: "SD" },
  { note: 42, name: "CH" },
  { note: 46, name: "OH" },
  { note: 47, name: "CB" },
  { note: 49, name: "CY" },
  { note: 50, name: "CP" },
  { note: 51, name: "RD" },
] as const;

export const DEFAULT_DRUM_VOICE: DrumVoiceParams = {
  tune: 0,
  decay: 1.0,
  level: 1.0,
};

// ── Device mode ──────────────────────────────────────────────────────────

export type DeviceMode = "synth" | "drums" | "drums+bass" | "bass";

// ── Device state (generic, replaces S1State/T8State/J6State) ─────────────

export interface DeviceState {
  id: string;
  mode: DeviceMode;
  genre_idx: number;
  pattern_idx: number;
  bass_genre_idx: number;
  bass_pattern_idx: number;
  key_idx: number;
  octave: number;
  step: number;
  connected: boolean;
  paused: boolean;
  editing: boolean;
  pattern_data: (StepData | null)[];
  drum_data: DrumHit[][];
  bass_data: (StepData | null)[];
  patternLength: 1 | 2 | 3 | 4 | 8 | 16 | 32;
  label: string;
  accent: string;
  hasKey: boolean;
  hasOctave: boolean;
  bassMuted: boolean;
  drumsMuted: boolean;
  synthParams: SynthParams | null;
  bassSynthParams: SynthParams | null;
  deviceVolume: number; // 0–1
  chainEnabled: boolean;
  chainPatternIdx: number;
  chainCycle: number;
}

export type XYTarget = "cutoff" | "resonance" | "distortion" | "highpass" | "delay" | "reverb" | "bpm" | "swing" | "volume";

export interface EngineSettings {
  swing: number; // 0.5 (straight) to 0.75 (heavy shuffle)
}

export interface EngineState {
  bpm: number;
  swing: number;
  devices: Record<string, DeviceState>;
}

// ── Catalog ──────────────────────────────────────────────────────────────

export interface PatternInfo {
  name: string;
  desc: string;
}

export interface GenreInfo {
  name: string;
  patterns: PatternInfo[];
}

export interface Catalog {
  s1: { genres: GenreInfo[] };
  t8: { drum_genres: GenreInfo[]; bass_genres: GenreInfo[] };
  keys: string[];
  octave_min: number;
  octave_max: number;
}

// ── MIDI state ───────────────────────────────────────────────────────────

export type MidiState = "idle" | "pending" | "granted" | "denied" | "unsupported" | "preview";

export type PreviewMode = "kaos" | "synth" | "ease" | "mixer";

// ── Effects (audio preview only) ─────────────────────────────────────────

export interface EffectParams {
  delay: { on: boolean; time: number; feedback: number; mix: number; sync: boolean; division: string; excludeDrums?: boolean; excludeBass?: boolean; excludeSynth?: boolean };
  distortion: { on: boolean; drive: number };
  reverb: { on: boolean; decay: number; mix: number; type: string; excludeDrums?: boolean; excludeBass?: boolean; excludeSynth?: boolean };
  compressor: { on: boolean; threshold: number; ratio: number };
  highpass: { on: boolean; cutoff: number; q: number };
  chorus: { on: boolean; rate: number; depth: number; mix: number };
  phaser: { on: boolean; rate: number; depth: number };
  bitcrusher: { on: boolean; bits: number; crushRate?: number };
  duck: { on: boolean; depth: number; release: number; excludeBass?: boolean; excludeSynth?: boolean };
  flanger: { on: boolean; rate: number; depth: number; feedback: number; mix: number };
  tremolo: { on: boolean; rate: number; depth: number; shape: string };
}

export type EffectName = keyof EffectParams;

export const DEFAULT_EFFECTS: EffectParams = {
  delay: { on: false, time: 0.3, feedback: 0.4, mix: 0.3, sync: true, division: "1/16" },
  distortion: { on: false, drive: 20 },
  reverb: { on: false, decay: 1, mix: 0.45, type: "room" },
  compressor: { on: false, threshold: -24, ratio: 4 },
  highpass: { on: false, cutoff: 200, q: 1 },
  chorus: { on: false, rate: 1.5, depth: 0.003, mix: 0.3 },
  phaser: { on: false, rate: 0.5, depth: 1000 },
  bitcrusher: { on: false, bits: 8 },
  duck: { on: false, depth: 0.85, release: 0.04 },
  flanger: { on: false, rate: 0.5, depth: 0.7, feedback: 0.7, mix: 0.5 },
  tremolo: { on: false, rate: 4, depth: 0.5, shape: "sine" },
};

// ── Commands (same as frontend ClientMessage) ────────────────────────────

export type ClientMessage =
  | { type: "set_genre"; device: string; idx: number }
  | { type: "set_pattern"; device: string; idx: number }
  | { type: "set_key"; device: string; idx: number }
  | { type: "set_octave"; device: string; octave: number }
  | { type: "set_bpm"; bpm: number }
  | { type: "toggle_pause"; device: string }
  | { type: "edit_step"; device: string; step: number; data: StepData | null }
  | { type: "bulk_set_pattern"; device: string; pattern_data?: (StepData | null)[]; drum_data?: DrumHit[][]; bass_data?: (StepData | null)[] }
  | { type: "clear_pattern"; device: string }
  | { type: "edit_drum_step"; device: string; step: number; hits: DrumHit[] }
  | { type: "discard_edit"; device: string }
  | { type: "save_pattern"; device: string; name: string; desc: string }
  | { type: "delete_pattern"; device: string; idx: number }
  | { type: "randomize_all" }
  | { type: "randomize_device"; device: string }
  | { type: "randomize_bass"; device: string }
  | { type: "set_pattern_length"; device: string; length: 1 | 2 | 3 | 4 | 8 | 16 | 32 }
  | { type: "toggle_bass_mute"; device: string }
  | { type: "toggle_drums_mute"; device: string }
  | { type: "set_bass_mute"; device: string; muted: boolean }
  | { type: "set_drums_mute"; device: string; muted: boolean }
  | { type: "set_synth_params"; device: string; params: Partial<SynthParams> }
  | { type: "set_bass_synth_params"; device: string; params: Partial<SynthParams> }
  | { type: "set_effect"; name: EffectName; params: Record<string, unknown> }
  | { type: "set_volume"; volume: number }
  | { type: "set_drum_voice"; note: number; params: Partial<DrumVoiceParams> }
  | { type: "set_swing"; swing: number }
  | { type: "set_device_volume"; device: string; volume: number }
  | { type: "undo_edit"; device: string }
  | { type: "load_preset"; bpm: number; genres: Record<string, { gi: number; pi: number; bgi: number; bpi: number }> }
  | { type: "toggle_chain"; device: string; chainIdx: number }
  | { type: "set_cv_enabled"; on: boolean }
  | { type: "toggle_drum_voice_mute"; note: number }
  | { type: "cv_test_note" }
  | { type: "cv_test_octave" }
  | { type: "set_midi_clock_sync"; on: boolean }
  | { type: "set_channel_volume"; channel: number; volume: number }
  | { type: "set_anti_clip"; mode: "off" | "limiter" | "hybrid" }
  | { type: "set_metronome"; on: boolean }
  | { type: "set_humanize"; on: boolean }
  | { type: "copy_pattern"; device: string }
  | { type: "paste_pattern"; device: string }
  | { type: "set_sidechain_duck"; on: boolean }
  | { type: "set_mono"; on: boolean }
  | { type: "set_drive"; db: number }
  | { type: "set_channel_pan"; channel: number; pan: number }
  | { type: "set_channel_mono"; channel: number; on: boolean }
  | { type: "set_arp"; enabled: boolean; mode: ArpMode; rate: ArpRate; device?: string }
  | { type: "set_effect_order"; order: EffectName[] }
  | { type: "set_duck_params"; depth: number; release: number; excludeBass?: boolean; excludeSynth?: boolean }
  | { type: "set_eq"; low: number; mid: number; high: number }
  | { type: "set_master_boost"; gain: number }
  | { type: "set_channel_eq"; channel: number; low: number; mid: number; high: number }
  | { type: "set_channel_hpf"; channel: number; freq: number }
  | { type: "set_channel_gate"; channel: number; on: boolean; rate: string; depth: number; shape: string; mode?: string; pattern?: number[] }
  | { type: "set_multiband"; on: boolean }
  | { type: "set_multiband_amount"; amount: number }
  | { type: "set_width"; width: number }
  | { type: "set_low_cut"; freq: number }
  | { type: "load_scene"; volumes: Record<number, number>; pans: Record<number, number>; chEQ: Record<number, { low: number; mid: number; high: number }>; masterEQ: { low: number; mid: number; high: number }; drive: number; width: number; lowCut: number; mbOn: boolean; mbAmount: number };

export type ArpMode = "up" | "down" | "up-down" | "random";
export type ArpRate = "1/4" | "1/8" | "1/16";

export interface SoundLock {
  drums: boolean;
  synth: boolean;
  bass: boolean;
}

export interface PatternLock {
  drums: boolean;
  synth: boolean;
  bass: boolean;
}

export interface PresetState {
  activeDrumKit: string;
  activeSynth: string;
  activeBass: string;
  onDrumKitChange: (val: string) => void;
  onSynthChange: (val: string) => void;
  onBassChange: (val: string) => void;
  soundLock: SoundLock;
  setSoundLock: React.Dispatch<React.SetStateAction<SoundLock>>;
  patternLock: PatternLock;
  setPatternLock: React.Dispatch<React.SetStateAction<PatternLock>>;
  stepPatternLock: PatternLock;
  setStepPatternLock: React.Dispatch<React.SetStateAction<PatternLock>>;
}
