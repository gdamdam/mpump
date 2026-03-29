import type { DrumVoiceParams } from "../types";
import { DEFAULT_DRUM_VOICE } from "../types";

// ── MIDI helpers ─────────────────────────────────────────────────────────

/** Convert MIDI note number to frequency (A4 = 440 Hz). */
export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Convert performance.now() timestamp to AudioContext time offset.
 *  Guarantees at least 5ms in the future to prevent collapsed automation. */
export function perfToCtx(ctx: AudioContext, time?: number): number {
  if (time === undefined) return ctx.currentTime + 0.005;
  const delay = (time - performance.now()) / 1000;
  return ctx.currentTime + Math.max(0.005, delay);
}

// ── Buffer synthesis helpers ─────────────────────────────────────────────
// All helpers take DrumVoiceParams. Extended params are optional.

export type SynthFn = (ctx: AudioContext, vp: DrumVoiceParams) => AudioBuffer;

/** Seeded PRNG (mulberry32) for reproducible drum noise. */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pitch ratio from semitones. */
function tuneRatio(semi: number): number {
  return Math.pow(2, semi / 12);
}

function makeBuf(ctx: AudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  return ctx.createBuffer(1, Math.ceil(sr * seconds), sr);
}

/** Apply one-pole LP filter to buffer in-place. cutoff 0=very dark, 1=bypass. */
export function applyFilter(buf: Float32Array, cutoff: number, sampleRate: number): void {
  if (cutoff >= 1) return;
  const freq = 200 * Math.pow(110, cutoff);
  const rc = 1 / (2 * Math.PI * freq);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    prev += alpha * (buf[i] - prev);
    buf[i] = prev;
  }
}

function synthKick(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, click: clickAmt = 0.15, sweepDepth: sd = 0.5, sweepRate: sr = 0.5 } = vp;
  const r = tuneRatio(tune);
  const len = 0.5 * decay;
  const out = makeBuf(ctx, Math.min(len, 2));
  const buf = out.getChannelData(0);
  // Map 0-1 params to useful ranges
  const sweep = (40 + 180 * sd) * r;   // sweep depth: 40-220 Hz
  const sRate = (10 + 50 * sr) / decay; // sweep rate: 10-60
  const baseF = 40 * r;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const phase = 2 * Math.PI * (baseF * t + (sweep / sRate) * (1 - Math.exp(-t * sRate)));
    const body = Math.sin(phase) * Math.exp(-t * (7 / decay)) * 0.5;
    const sub = Math.sin(2 * Math.PI * 50 * r * t) * Math.exp(-t * (5 / decay)) * 0.3;
    const click = Math.exp(-t * 200) * clickAmt;
    buf[i] = body + sub + click;
  }
  return out;
}

function synthSnare(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, noiseMix: nm = 0.55 } = vp;
  const r = tuneRatio(tune);
  const len = 0.3 * decay;
  const out = makeBuf(ctx, Math.min(len, 2));
  const buf = out.getChannelData(0);
  // noiseMix: 0 = pure tone (body 0.55, noise 0), 1 = pure noise (body 0, noise 0.55)
  const toneLevel = 0.55 * (1 - nm);
  const noiseLevel = 0.55 * nm;
  const rand = seededRandom(38);
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const body = Math.sin(2 * Math.PI * 185 * r * t) * Math.exp(-t * (20 / decay)) * toneLevel;
    const low = Math.sin(2 * Math.PI * 100 * r * t) * Math.exp(-t * (25 / decay)) * (toneLevel * 0.57);
    const noise = (rand() * 2 - 1) * Math.exp(-t * (12 / decay)) * noiseLevel;
    buf[i] = body + low + noise;
  }
  return out;
}

function synthClosedHat(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, color = 0 } = vp;
  const len = 0.08 * decay;
  const out = makeBuf(ctx, Math.min(len, 1));
  const buf = out.getChannelData(0);
  // color shifts ring partials: -1 = dark (lower freqs), +1 = bright (higher freqs)
  const shift = Math.pow(2, color * 0.5); // ±half octave
  const r = tuneRatio(tune);
  const f1 = 3500 * shift * r, f2 = 5200 * shift * r, f3 = 7800 * shift * r;
  const rand = seededRandom(42);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const raw = rand() * 2 - 1;
    const noise = (raw - prev) * Math.exp(-t * (50 / decay)) * 0.3;
    const ring = (Math.sin(2 * Math.PI * f1 * t) * 0.12
                + Math.sin(2 * Math.PI * f2 * t) * 0.08
                + Math.sin(2 * Math.PI * f3 * t) * 0.05) * Math.exp(-t * (60 / decay));
    buf[i] = noise + ring;
    prev = raw;
  }
  return out;
}

function synthOpenHat(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, color = 0 } = vp;
  const len = 0.3 * decay;
  const out = makeBuf(ctx, Math.min(len, 2));
  const buf = out.getChannelData(0);
  const shift = Math.pow(2, color * 0.5);
  const r = tuneRatio(tune);
  const f1 = 3500 * shift * r, f2 = 5200 * shift * r, f3 = 7800 * shift * r;
  const rand = seededRandom(46);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const raw = rand() * 2 - 1;
    const noise = (raw - prev) * Math.exp(-t * (8 / decay)) * 0.25;
    const ring = (Math.sin(2 * Math.PI * f1 * t) * 0.1
                + Math.sin(2 * Math.PI * f2 * t) * 0.08
                + Math.sin(2 * Math.PI * f3 * t) * 0.06) * Math.exp(-t * (6 / decay));
    buf[i] = noise + ring;
    prev = raw;
  }
  return out;
}

function synthRimshot(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1 } = vp;
  const r = tuneRatio(tune);
  const len = 0.06 * decay;
  const out = makeBuf(ctx, Math.min(len, 1));
  const buf = out.getChannelData(0);
  const rand = seededRandom(37);
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    buf[i] = (Math.sin(2 * Math.PI * 800 * r * t) * 0.5 + (rand() * 2 - 1) * 0.4) * Math.exp(-t * (60 / decay));
  }
  return out;
}

function synthCrash(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, color = 0 } = vp;
  const shift = Math.pow(2, color * 0.5);
  const r = tuneRatio(tune);
  const len = 1.0 * decay;
  const out = makeBuf(ctx, Math.min(len, 3));
  const buf = out.getChannelData(0);
  const f1 = 3500 * shift * r;
  const rand = seededRandom(49);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const raw = rand() * 2 - 1;
    const noise = (raw - prev) * Math.exp(-t * (3 / decay)) * 0.35;
    const ring = Math.sin(2 * Math.PI * f1 * t) * 0.08 * Math.exp(-t * (4 / decay));
    buf[i] = noise + ring;
    prev = raw;
  }
  return out;
}

function synthTom(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1 } = vp;
  const r = tuneRatio(tune);
  const len = 0.25 * decay;
  const out = makeBuf(ctx, Math.min(len, 2));
  const buf = out.getChannelData(0);
  const baseF = 200 * r, sweep = 80 * r, sweepRate = 25 / decay;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const phase = 2 * Math.PI * (baseF * t + (sweep / sweepRate) * (1 - Math.exp(-t * sweepRate)));
    buf[i] = Math.sin(phase) * Math.exp(-t * (12 / decay)) * 0.7;
  }
  return out;
}

function synthRide(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, color = 0 } = vp;
  const shift = Math.pow(2, color * 0.5);
  const r = tuneRatio(tune);
  const len = 0.6 * decay;
  const out = makeBuf(ctx, Math.min(len, 3));
  const buf = out.getChannelData(0);
  const f1 = 3500 * shift * r;
  const rand = seededRandom(51);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const raw = rand() * 2 - 1;
    buf[i] = ((raw - prev) * 0.3 + Math.sin(2 * Math.PI * f1 * t) * 0.2) * Math.exp(-t * (4 / decay));
    prev = raw;
  }
  return out;
}

function synthCowbell(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1 } = vp;
  const r = tuneRatio(tune);
  const len = 0.15 * decay;
  const out = makeBuf(ctx, Math.min(len, 1));
  const buf = out.getChannelData(0);
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    buf[i] = (Math.sign(Math.sin(2 * Math.PI * 545 * r * t)) * 0.12
            + Math.sign(Math.sin(2 * Math.PI * 815 * r * t)) * 0.12) * Math.exp(-t * (20 / decay));
  }
  return out;
}

// ── Drum kit ─────────────────────────────────────────────────────────────

export type DrumKit = Map<number, AudioBuffer>;

/** Map MIDI note → synthesis function. */
export const DRUM_SYNTHS: [number, SynthFn][] = [
  [36, synthKick], [37, synthRimshot], [38, synthSnare],
  [42, synthClosedHat], [46, synthOpenHat], [47, synthCowbell],
  [49, synthCrash], [50, synthTom], [51, synthRide], [56, synthCowbell],
];

export function buildKit(ctx: AudioContext, voiceParams?: Map<number, DrumVoiceParams>): DrumKit {
  const kit: DrumKit = new Map();
  for (const [note, fn] of DRUM_SYNTHS) {
    const vp = voiceParams?.get(note) ?? DEFAULT_DRUM_VOICE;
    const buf = fn(ctx, vp);
    if (vp.filterCutoff !== undefined && vp.filterCutoff < 1) {
      applyFilter(buf.getChannelData(0), vp.filterCutoff, ctx.sampleRate);
    }
    kit.set(note, buf);
  }
  return kit;
}

// ── Synth voice ──────────────────────────────────────────────────────────

/** Active synth voice that can be released on noteOff. */
export interface SynthVoice {
  oscs: OscillatorNode[];   // main osc(s) — 1 for mono, 2 for stereo detune, N for unison
  panNodes: StereoPannerNode[]; // per-osc panning for stereo spread
  subOsc: OscillatorNode | null;
  subGain: GainNode | null;
  gain: GainNode;
  filter: BiquadFilterNode | null;
  lfo: OscillatorNode | null;
  lfoGains: GainNode[];
  // Envelope tracking for click-free release at any point
  env: { amp: number; atk: number; dec: number; sus: number; startTime: number };
}

/** Stereo pan positions for drum voices. */
export const DRUM_PAN: Record<number, number> = {
  36: 0, 37: 0.2, 38: 0, 42: 0.3, 46: -0.3, 47: 0.25, 49: 0.2, 50: -0.15, 51: 0.35, 56: -0.25,
};

/** Compute the ADSR envelope value at a given time. */
export function envValueAt(env: SynthVoice["env"], time: number): number {
  const elapsed = time - env.startTime;
  if (elapsed < 0) return 0;
  if (elapsed < env.atk) {
    // Attack phase: linear ramp 0 → amp
    return env.amp * (elapsed / env.atk);
  }
  if (elapsed < env.atk + env.dec) {
    // Decay phase: linear ramp amp → amp*sus
    const decElapsed = elapsed - env.atk;
    return env.amp - (env.amp - env.amp * env.sus) * (decElapsed / env.dec);
  }
  // Sustain phase
  return env.amp * env.sus;
}

// ── Effects helpers ──────────────────────────────────────────────────────

/** Generate a distortion curve for WaveShaperNode. */
export function makeDistortionCurve(drive: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  const k = drive;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/** Generate a staircase curve for bit-depth reduction. */
export function makeBitcrushCurve(bits: number): Float32Array {
  const n = 65536;
  const curve = new Float32Array(n);
  const steps = Math.pow(2, bits);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

/** Generate a soft-clip (tanh) curve, or a linear pass-through curve. */
export function makeSoftClipCurve(active: boolean): Float32Array {
  const n = 8192;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = active ? Math.tanh(x * 1.5) / Math.tanh(1.5) : x;
  }
  return curve;
}

/** Generate a synthetic impulse response for reverb. */
export function generateImpulseResponse(ctx: AudioContext, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.ceil(rate * decay);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (rate * decay * 0.3));
    }
  }
  return buf;
}
