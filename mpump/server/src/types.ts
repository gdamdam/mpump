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

// ── Device mode ──────────────────────────────────────────────────────────

export type DeviceMode = "synth" | "drums" | "drums+bass";

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
  label: string;
  accent: string;
  hasKey: boolean;
  hasOctave: boolean;
}

export interface EngineState {
  bpm: number;
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
  j6: { genres: GenreInfo[]; chord_sets?: Record<string, number> };
  keys: string[];
  octave_min: number;
  octave_max: number;
}

// ── MIDI state ───────────────────────────────────────────────────────────

export type MidiState = "pending" | "granted" | "denied" | "unsupported";

// ── Commands (same as frontend ClientMessage) ────────────────────────────

export type ClientMessage =
  | { type: "set_genre"; device: string; idx: number }
  | { type: "set_pattern"; device: string; idx: number }
  | { type: "set_key"; device: string; idx: number }
  | { type: "set_octave"; device: string; octave: number }
  | { type: "set_bpm"; bpm: number }
  | { type: "toggle_pause"; device: string }
  | { type: "edit_step"; device: string; step: number; data: StepData | null }
  | { type: "edit_drum_step"; device: string; step: number; hits: DrumHit[] }
  | { type: "discard_edit"; device: string }
  | { type: "save_pattern"; device: string; name: string; desc: string }
  | { type: "delete_pattern"; device: string; idx: number }
  | { type: "randomize_all" }
  | { type: "randomize_device"; device: string }
  | { type: "randomize_bass"; device: string };
