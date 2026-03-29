/**
 * patternCodec — encodes and decodes share URL payloads. Share links carry
 * the full session state as base64-encoded JSON in the URL hash: pattern data,
 * effect settings, synth params, gesture recordings, and mute/volume state.
 *
 * Validation is strict to prevent prototype pollution and keep payloads bounded.
 * Synth params use a compact diff-against-defaults encoding with short keys
 * to minimize URL length.
 */
import type { StepData, DrumHit, EffectName, EffectParams } from "../types";

// ── Share payload validation ─────────────────────────────────────────────

const VALID_EFFECT_NAMES = new Set<string>(["compressor", "highpass", "distortion", "bitcrusher", "chorus", "phaser", "delay", "reverb"]);
const MAX_STEPS = 64;            // longest supported pattern (64 sixteenth-note steps)
const MAX_HITS_PER_STEP = 16;    // drum polyphony limit per step
const MAX_PATTERN_STRING = 4000;
const MAX_GESTURE_POINTS = 500;
const GESTURE_URL_THRESHOLD = 30; // above this, gesture is QR-only (keeps copyable URLs short)

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

export interface SharePayload {
  bpm: number;
  sw?: number;
  dk?: string;
  sp?: string;
  bp?: string;
  g: Record<string, { gi: number; pi: number; bgi?: number; bpi?: number }>;
  fx?: string;
  fp?: Record<string, Record<string, unknown>>; // full effect params
  eo?: EffectName[];
  me?: string;
  de?: string;
  be?: string;
  gs?: string; // gesture recording
  mu?: string; // mute states: 3 chars "dbs" (drums/bass/synth), 1=muted
  cv?: string; // channel volumes: "drums,bass,synth" (0-100)
  spp?: Record<string, unknown>; // synth params (preview_synth)
  bpp?: Record<string, unknown>; // bass synth params (preview_bass)
}

/** Parse and validate a share URL hash. Returns null if invalid. */
export function validateSharePayload(raw: unknown): SharePayload | null {
  if (!isPlainObject(raw)) return null;
  // Reject prototype pollution keys
  const keys = Object.keys(raw);
  if (keys.includes("__proto__") || keys.includes("constructor") || keys.includes("prototype")) return null;
  const d = raw as Record<string, unknown>;

  // BPM: required, number, 20–300
  if (!isNum(d.bpm)) return null;
  const bpm = clamp(Math.round(d.bpm as number), 20, 300);

  // Genres: required, plain object with valid indices
  if (!isPlainObject(d.g)) return null;
  const g: SharePayload["g"] = {};
  for (const [key, val] of Object.entries(d.g as Record<string, unknown>)) {
    if (typeof key !== "string" || key.length > 50) continue;
    if (!isPlainObject(val)) continue;
    const gi = isNum(val.gi) ? clamp(Math.round(val.gi as number), 0, 200) : 0;
    const pi = isNum(val.pi) ? clamp(Math.round(val.pi as number), 0, 200) : 0;
    const bgi = isNum(val.bgi) ? clamp(Math.round(val.bgi as number), 0, 200) : undefined;
    const bpi = isNum(val.bpi) ? clamp(Math.round(val.bpi as number), 0, 200) : undefined;
    g[key] = { gi, pi, bgi, bpi };
  }
  if (Object.keys(g).length === 0) return null;

  const result: SharePayload = { bpm, g };

  // Swing: optional, number, 0–1
  if (isNum(d.sw)) result.sw = clamp(d.sw as number, 0, 1);

  // Presets: optional, coerce to string, limit length
  if (d.dk != null) result.dk = String(d.dk).slice(0, 100);
  if (d.sp != null) result.sp = String(d.sp).slice(0, 100);
  if (d.bp != null) result.bp = String(d.bp).slice(0, 100);

  // Effects bitmask: optional, string of 0/1 only
  if (typeof d.fx === "string" && /^[01]{1,16}$/.test(d.fx)) {
    result.fx = d.fx;
  }

  // Effect order: optional, array of known effect names
  if (Array.isArray(d.eo)) {
    const cleaned = (d.eo as unknown[]).filter(n => typeof n === "string" && VALID_EFFECT_NAMES.has(n)) as EffectName[];
    if (cleaned.length > 0 && cleaned.length <= 16) result.eo = cleaned;
  }

  // Pattern edits: optional, strings with length limit
  if (typeof d.me === "string" && d.me.length <= MAX_PATTERN_STRING) result.me = d.me;
  if (typeof d.de === "string" && d.de.length <= MAX_PATTERN_STRING) result.de = d.de;
  if (typeof d.be === "string" && d.be.length <= MAX_PATTERN_STRING) result.be = d.be;

  // Effect params: optional, validate each effect name and numeric values
  if (isPlainObject(d.fp)) {
    const fp: Record<string, Record<string, unknown>> = {};
    for (const [name, params] of Object.entries(d.fp as Record<string, unknown>)) {
      if (!VALID_EFFECT_NAMES.has(name) || !isPlainObject(params)) continue;
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
        else if (typeof v === "boolean") clean[k] = v;
        else if (typeof v === "string" && v.length <= 20) clean[k] = v;
      }
      fp[name] = clean;
    }
    if (Object.keys(fp).length > 0) result.fp = fp;
  }

  // Synth params: optional, validate field types
  const validateSynthParams = (raw: unknown): Record<string, unknown> | null => {
    if (!isPlainObject(raw)) return null;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
      else if (typeof v === "boolean") clean[k] = v;
      else if (typeof v === "string" && v.length <= 20) clean[k] = v;
    }
    return Object.keys(clean).length > 0 ? clean : null;
  };
  if (d.spp) { const v = validateSynthParams(d.spp); if (v) result.spp = v; }
  if (d.bpp) { const v = validateSynthParams(d.bpp); if (v) result.bpp = v; }

  // Mute states: optional, 3-char string of 0/1
  if (typeof d.mu === "string" && /^[01]{3}$/.test(d.mu)) result.mu = d.mu;

  // Channel volumes: optional, "d,b,s" format (0-100)
  if (typeof d.cv === "string" && /^\d{1,3},\d{1,3},\d{1,3}$/.test(d.cv)) result.cv = d.cv;

  // Gesture: optional, compact encoded string
  if (typeof d.gs === "string" && d.gs.length <= MAX_GESTURE_POINTS * 15) result.gs = d.gs;

  return result;
}

// ── Pattern encoding/decoding ────────────────────────────────────────────

/** Encode melodic/bass steps: "semi,vel,slide|semi,vel,slide|-|..." */
export function encodeSteps(data: (StepData | null)[]): string {
  return data.map(s => s ? `${s.semi},${s.vel},${s.slide ? 1 : 0}` : "-").join("|");
}

/** Decode melodic/bass steps from compact string. */
export function decodeSteps(s: string): (StepData | null)[] {
  const parts = s.split("|");
  if (parts.length > MAX_STEPS) return [];
  return parts.map(part => {
    if (part === "-") return null;
    const [semi, vel, slide] = part.split(",");
    const semiN = Number(semi);
    const velN = Number(vel);
    if (!Number.isFinite(semiN) || !Number.isFinite(velN)) return null;
    return { semi: clamp(Math.round(semiN), -48, 48), vel: clamp(Math.round(velN), 0, 127), slide: slide === "1" };
  });
}

/** Encode drum steps: "note.vel+note.vel|note.vel|-|..." */
export function encodeDrumSteps(data: DrumHit[][]): string {
  return data.map(hits =>
    hits.length === 0 ? "-" : hits.map(h => `${h.note}.${h.vel}`).join("+")
  ).join("|");
}

/** Decode drum steps from compact string. */
export function decodeDrumSteps(s: string): DrumHit[][] {
  const parts = s.split("|");
  if (parts.length > MAX_STEPS) return [];
  return parts.map(part => {
    if (part === "-") return [];
    const hits = part.split("+").slice(0, MAX_HITS_PER_STEP).map(h => {
      const [note, vel] = h.split(".");
      const noteN = Number(note);
      const velN = Number(vel);
      if (!Number.isFinite(noteN) || !Number.isFinite(velN)) return null;
      return { note: clamp(Math.round(noteN), 0, 127), vel: clamp(Math.round(velN), 0, 127) };
    }).filter((h): h is DrumHit => h !== null);
    return hits;
  });
}

// ── Gesture encoding ─────────────────────────────────────────────────────

type GesturePoint = { t: number; x: number; y: number };

/** Encode gesture: "t,x,y|t,x,y|..." with rounded values for compactness. */
export function encodeGesture(points: GesturePoint[]): string {
  return points.map(p => `${Math.round(p.t)},${p.x.toFixed(3)},${p.y.toFixed(3)}`).join("|");
}

/** Decode gesture from compact string. */
export function decodeGesture(s: string): GesturePoint[] {
  const parts = s.split("|");
  if (parts.length > MAX_GESTURE_POINTS) return [];
  return parts.map(part => {
    const [t, x, y] = part.split(",");
    const tN = Number(t); const xN = Number(x); const yN = Number(y);
    if (!Number.isFinite(tN) || !Number.isFinite(xN) || !Number.isFinite(yN)) return null;
    return { t: Math.max(0, tN), x: clamp(xN, 0, 1), y: clamp(yN, 0, 1) };
  }).filter((p): p is GesturePoint => p !== null);
}

/** Check if gesture is short enough for URL (vs QR-only). */
export function gestureUrlFit(points: GesturePoint[]): boolean {
  return points.length <= GESTURE_URL_THRESHOLD;
}

// ── Effect params encoding ───────────────────────────────────────────────

/** Extract effect params (excluding on/off which is in fx bitmask). */
export function encodeEffectParams(fx: EffectParams): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [name, params] of Object.entries(fx)) {
    const { on: _, ...rest } = params as Record<string, unknown>;
    if (Object.keys(rest).length > 0) result[name] = rest;
  }
  return result;
}

// ── Compact synth params encoding (A+B: short keys + diff-only) ──────

// Short key mapping: full name → 1-2 char key
const SYNTH_KEY_MAP: Record<string, string> = {
  oscType: "ot", attack: "a", decay: "d", sustain: "s", release: "r",
  filterOn: "fo", filterType: "ft", cutoff: "co", resonance: "re",
  subOsc: "so", subLevel: "sl", detune: "de",
  lfoOn: "lo", lfoSync: "ls", lfoRate: "lr", lfoDivision: "ld",
  lfoDepth: "lp", lfoShape: "lh", lfoTarget: "lt",
  filterEnvDepth: "fe", unison: "un", unisonSpread: "us",
};
const SYNTH_KEY_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SYNTH_KEY_MAP).map(([k, v]) => [v, k])
);

// Default values for diff comparison
const SYNTH_DEFAULTS: Record<string, unknown> = {
  oscType: "sawtooth", attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.06,
  filterOn: true, filterType: "lowpass", cutoff: 4000, resonance: 4,
  subOsc: true, subLevel: 0.5, detune: 0,
  lfoOn: false, lfoSync: false, lfoRate: 2, lfoDivision: "1/4",
  lfoDepth: 0.5, lfoShape: "sine", lfoTarget: "cutoff",
};

/** Encode synth params as compact diff against defaults with short keys. */
export function encodeSynthParamsCompact(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(params)) {
    const shortKey = SYNTH_KEY_MAP[key];
    if (!shortKey) continue;
    // Only include if different from default
    if (SYNTH_DEFAULTS[key] !== undefined && SYNTH_DEFAULTS[key] === val) continue;
    // Round numbers to 3 decimal places to save chars
    if (typeof val === "number") result[shortKey] = Math.round(val * 1000) / 1000;
    else result[shortKey] = val;
  }
  return result;
}

/** Decode compact synth params back to full key names. */
export function decodeSynthParamsCompact(compact: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...SYNTH_DEFAULTS };
  for (const [shortKey, val] of Object.entries(compact)) {
    const fullKey = SYNTH_KEY_REVERSE[shortKey];
    if (fullKey) result[fullKey] = val;
  }
  return result;
}
