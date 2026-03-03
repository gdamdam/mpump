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
  drum_data: DrumHit[][];
  bass_data: (StepData | null)[];
}

export interface J6State {
  genre_idx: number;
  pattern_idx: number;
  step: number;
  connected: boolean;
  paused: boolean;
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
  j6: { genres: GenreInfo[] };
  keys: string[];
  octave_min: number;
  octave_max: number;
}

// ── WebSocket protocol ───────────────────────────────────────────────────

export type ServerMessage =
  | { type: "state"; data: EngineState }
  | { type: "step"; device: string; step: number };

export type ClientMessage =
  | { type: "set_genre"; device: string; idx: number }
  | { type: "set_pattern"; device: string; idx: number }
  | { type: "set_key"; device: string; idx: number }
  | { type: "set_octave"; device: string; octave: number }
  | { type: "set_bpm"; bpm: number }
  | { type: "toggle_pause"; device: string };
