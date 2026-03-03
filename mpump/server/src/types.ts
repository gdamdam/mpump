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

// ── Device state ─────────────────────────────────────────────────────────

export interface S1State {
  genre_idx: number;
  pattern_idx: number;
  key_idx: number;
  octave: number;
  step: number;
  connected: boolean;
  paused: boolean;
  editing: boolean;
  pattern_data: (StepData | null)[];
}

export interface T8State {
  drum_genre_idx: number;
  bass_genre_idx: number;
  pattern_idx: number;
  bass_pattern_idx: number;
  key_idx: number;
  octave: number;
  step: number;
  connected: boolean;
  paused: boolean;
  editing: boolean;
  drum_data: DrumHit[][];
  bass_data: (StepData | null)[];
}

export interface J6State {
  genre_idx: number;
  pattern_idx: number;
  step: number;
  connected: boolean;
  paused: boolean;
  editing: boolean;
  pattern_data: (StepData | null)[];
}

export interface EngineState {
  bpm: number;
  s1: S1State;
  t8: T8State;
  j6: J6State;
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
  | { type: "edit_drum_step"; step: number; hits: DrumHit[] }
  | { type: "discard_edit"; device: string }
  | { type: "save_pattern"; device: string; name: string; desc: string }
  | { type: "delete_pattern"; device: string; idx: number };
