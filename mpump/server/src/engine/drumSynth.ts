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

/** Convert semitone offset to frequency multiplier.
 *  Standard equal-temperament formula: ratio = 2^(semitones/12).
 *  +12 semitones = double frequency (one octave up). */
function tuneRatio(semi: number): number {
  return Math.pow(2, semi / 12);
}

/** Create a mono AudioBuffer of the given duration (seconds) at the context's sample rate. */
function makeBuf(ctx: AudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  return ctx.createBuffer(1, Math.ceil(sr * seconds), sr);
}

/** Apply one-pole LP filter to buffer in-place. cutoff 0=very dark, 1=bypass.
 *  Frequency mapping: cutoff 0→200Hz, 0.5→~2.4kHz, 1→22kHz (exponential). */
export function applyFilter(buf: Float32Array, cutoff: number, sampleRate: number): void {
  if (cutoff >= 1) return;
  // Exponential mapping: 200 * 110^cutoff covers ~200Hz to ~22kHz
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

/** Kick drum — tuned to TR-808 frequency profile.
 *  808 measured sweep: 200Hz→100Hz→75Hz→50Hz over ~50ms.
 *  Our sweep: 215Hz→145Hz→105Hz→61Hz→51Hz (close match).
 *  Body: sine with pitch sweep. Sub: steady 50Hz sine. Click: 5kHz burst (<0.3ms).
 *  Click uses sine burst instead of DC offset to avoid "boom...click" separation artifact. */
function synthKick(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, click: clickAmt = 0.15, sweepDepth: sd = 0.5, sweepRate: sr = 0.5 } = vp;
  const r = tuneRatio(tune);
  const len = 0.6 * decay; // longer buffer so envelope decays fully (avoids cutoff click)
  const out = makeBuf(ctx, Math.min(len, 2));
  const buf = out.getChannelData(0);
  // Tuned to 808: instantaneous freq 200→100→50 Hz
  // Base frequency: 45Hz compromise between 808 (50Hz match) and avoiding
  // double-peak artifact on high-tuned kicks (tune > 0 makes it worse)
  const baseF = 45 * r;
  const sweep = (80 + 170 * sd) * r;   // sweep depth: 80-250 Hz (peak at ~200Hz)
  const sRate = (20 + 70 * sr) / Math.max(decay, 0.5); // clamp divisor to prevent chirp at low decay
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const phase = 2 * Math.PI * (baseF * t + (sweep / sRate) * (1 - Math.exp(-t * sRate)));
    // Body: two-part envelope — fast fixed attack decay (independent of decay knob)
    // kills the second oscillation peak, then slower tail controlled by decay knob.
    // Sub oscillator provides the sustained low-end.
    const bodyAttack = Math.exp(-t * 200); // fixed fast: drops to 37% at 5ms, 5% at 15ms
    const bodyTail = Math.exp(-t * (5 / decay));
    const body = Math.sin(phase) * (bodyAttack * 0.55 + bodyTail * 0.12) * 0.95;
    const sub = Math.sin(2 * Math.PI * 50 * r * t) * Math.exp(-t * (5 / decay)) * 0.4;
    // Click: broadband burst fused with body attack. clickTune shifts pitch (-1=warm, 0=mid, +1=bright)
    const ct = vp.clickTune ?? 0;
    const clickF1 = 2000 * Math.pow(2, ct);
    const clickF2 = 5000 * Math.pow(2, ct);
    const click = (Math.sin(2 * Math.PI * clickF1 * t) + Math.sin(2 * Math.PI * clickF2 * t)) * 0.5 * Math.exp(-t * 2000) * clickAmt;
    buf[i] = body + sub + click;
  }
  return out;
}

/** Snare drum — tuned to TR-808 spectral characteristics.
 *  808 snare: noise-dominated at ~3.8kHz, body tone at 185Hz with pitch envelope.
 *  Wire resonance: 2-pole bandpass at 3800Hz simulates snare wire sizzle.
 *  Pitch envelope: body starts at ~280Hz, decays to 185Hz for "snap" attack.
 *  noiseMix: 0=pure tone, 1=pure noise (808 default ~0.55, noise-heavy). */
function synthSnare(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, noiseMix: nm = 0.55 } = vp;
  const r = tuneRatio(tune);
  const len = 0.3 * decay;
  const out = makeBuf(ctx, Math.min(len, 2));
  const buf = out.getChannelData(0);
  // noiseMix: 0 = pure tone, 1 = pure noise (808 default is noise-heavy)
  const toneLevel = 1.0 * (1 - nm);
  const noiseLevel = 1.0 * nm;
  const rand = seededRandom(38);
  // Snare wire resonance at 3.8kHz (measured on TR-808 samples).
  // Q=3 gives moderate emphasis without metallic ringing.
  // Filter coefficients use standard biquad bandpass (RBJ Audio EQ Cookbook).
  const wireFreq = 3800 * r;
  const wireQ = 3;
  const wireW0 = 2 * Math.PI * wireFreq / ctx.sampleRate;
  const wireAlpha = Math.sin(wireW0) / (2 * wireQ);
  const wireBpB0 = wireAlpha;
  const wireBpA0 = 1 + wireAlpha;
  const wireBpA1 = -2 * Math.cos(wireW0);
  const wireBpA2 = 1 - wireAlpha;
  let wireX1 = 0, wireX2 = 0, wireY1 = 0, wireY2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    // Pitch envelope: 808 body starts ~280Hz, decays to ~185Hz
    const pitchEnv = 1 + 0.5 * Math.exp(-t * 60);
    const body = Math.sin(2 * Math.PI * 185 * r * pitchEnv * t) * Math.exp(-t * (18 / decay)) * toneLevel;
    const low = Math.sin(2 * Math.PI * 110 * r * t) * Math.exp(-t * (22 / decay)) * (toneLevel * 0.2);
    const rawNoise = rand() * 2 - 1;
    // Shaped noise through bandpass at 3.8kHz
    const shaped = (wireBpB0 * rawNoise - wireBpB0 * wireX2 - wireBpA1 * wireY1 - wireBpA2 * wireY2) / wireBpA0;
    wireX2 = wireX1; wireX1 = rawNoise; wireY2 = wireY1; wireY1 = shaped;
    const noiseEnv = Math.exp(-t * (14 / decay));
    // 808 snare: noise dominates, wire resonance gives it sizzle
    const noise = (rawNoise * 0.45 + shaped * 0.55) * noiseEnv * noiseLevel;
    buf[i] = body + low + noise;
  }
  return out;
}

/** Closed hi-hat — 6 inharmonic partials centered at 808's ~7.5kHz peak.
 *  808 measured dominant frequency: 7400-7680Hz across samples.
 *  Partials are inharmonically spaced (not integer multiples) to create
 *  metallic timbre. Sharp transient burst (<1ms) adds stick attack.
 *  Levels boosted 2.5x to match 808 RMS level. */
function synthClosedHat(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, color = 0 } = vp;
  const len = 0.08 * decay;
  const out = makeBuf(ctx, Math.min(len, 1));
  const buf = out.getChannelData(0);
  // color shifts ring partials: -1 = dark (lower freqs), +1 = bright (higher freqs)
  const shift = Math.pow(2, color * 0.5); // ±half octave
  const r = tuneRatio(tune);
  // 6 inharmonic partials centered around 808's ~7.5kHz peak
  const freqs = [3500, 5200, 7500, 4100, 6300, 8800].map(f => f * shift * r);
  const amps = [0.06, 0.04, 0.08, 0.04, 0.06, 0.02]; // CH: boosted ring for presence in mix
  const rand = seededRandom(42);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const raw = rand() * 2 - 1;
    // Sharp transient burst (808 has very fast attack ~1.7ms)
    const transient = Math.exp(-t * 1000) * 0.25;
    const noise = (raw - prev) * Math.exp(-t * (50 / decay)) * 0.45;
    let ring = 0;
    for (let p = 0; p < 6; p++) {
      ring += Math.sin(2 * Math.PI * freqs[p] * t) * amps[p];
    }
    ring *= Math.exp(-t * (120 / decay)); // very fast ring decay — tight click
    buf[i] = transient * raw + noise + ring;
    prev = raw;
  }
  return out;
}

/** Open hi-hat — same partial structure as closed hat, longer decay.
 *  808 OH measured at ~7.5kHz dominant. */
function synthOpenHat(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, color = 0 } = vp;
  const len = 0.3 * decay;
  const out = makeBuf(ctx, Math.min(len, 2));
  const buf = out.getChannelData(0);
  const shift = Math.pow(2, color * 0.5);
  const r = tuneRatio(tune);
  // 6 inharmonic partials centered around 808's ~7.5kHz peak
  const freqs = [3500, 5200, 7500, 4100, 6300, 8800].map(f => f * shift * r);
  const amps = [0.10, 0.07, 0.12, 0.07, 0.09, 0.04]; // OH: boosted ring for presence in mix
  const rand = seededRandom(46);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const raw = rand() * 2 - 1;
    // Sharp transient burst
    const transient = Math.exp(-t * 600) * 0.18;
    const noise = (raw - prev) * Math.exp(-t * (6 / decay)) * 0.35;
    let ring = 0;
    for (let p = 0; p < 6; p++) {
      ring += Math.sin(2 * Math.PI * freqs[p] * t) * amps[p];
    }
    ring *= Math.exp(-t * (5 / decay)); // slow ring decay — sustained open sound
    buf[i] = transient * raw + noise + ring;
    prev = raw;
  }
  return out;
}

/** Rimshot — 808 measured at ~1600Hz early → 924Hz. Very short (16ms).
 *  Two pitched components (920 + 1600 Hz) + noise for stick attack. */
function synthRimshot(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1 } = vp;
  const r = tuneRatio(tune);
  const len = 0.04 * decay; // 808 rimshot is very short (~16ms)
  const out = makeBuf(ctx, Math.min(len, 1));
  const buf = out.getChannelData(0);
  const rand = seededRandom(37);
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    // 808 rimshot: ~1600Hz early → ~900Hz, two strong partials
    const tone1 = Math.sin(2 * Math.PI * 920 * r * t) * 0.3;
    const tone2 = Math.sin(2 * Math.PI * 1600 * r * t) * 0.2 * Math.exp(-t * (100 / decay));
    const noise = (rand() * 2 - 1) * 0.15;
    buf[i] = (tone1 + tone2 + noise) * Math.exp(-t * (80 / decay));
  }
  return out;
}

/** Crash cymbal — 909 measured at ~5.6kHz average, ~7.9kHz early.
 *  5 inharmonic partials with per-partial decay rates for shimmer. */
function synthCrash(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, color = 0 } = vp;
  const shift = Math.pow(2, color * 0.5);
  const r = tuneRatio(tune);
  const len = 1.0 * decay;
  const out = makeBuf(ctx, Math.min(len, 3));
  const buf = out.getChannelData(0);
  // Dense inharmonic partials (909 crash: ~5.6kHz average, ~7.9kHz early)
  const freqs = [3200, 5000, 6800, 8500, 11000].map(f => f * shift * r);
  const amps = [0.08, 0.10, 0.08, 0.06, 0.04];
  const rand = seededRandom(49);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const raw = rand() * 2 - 1;
    const transient = Math.exp(-t * 300) * 0.35;
    const noise = (raw - prev) * Math.exp(-t * (3 / decay)) * 0.40;
    let ring = 0;
    for (let p = 0; p < 5; p++) {
      // Each partial decays at slightly different rate for shimmer
      ring += Math.sin(2 * Math.PI * freqs[p] * t) * amps[p] * Math.exp(-t * ((3 + p) / decay));
    }
    buf[i] = transient * raw + noise + ring;
    prev = raw;
  }
  return out;
}

/** Clap — 808 measured at ~3.2kHz dominant, 10ms attack (multi-burst).
 *  4 randomized micro-bursts simulate multiple hands hitting.
 *  Bandpass at 3200Hz matches 808 clap spectral peak.
 *  Filter uses standard biquad bandpass (RBJ Audio EQ Cookbook). */
function synthClap(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1 } = vp;
  const r = tuneRatio(tune);
  const len = 0.25 * decay;
  const out = makeBuf(ctx, Math.min(len, 2));
  const buf = out.getChannelData(0);
  const rand = seededRandom(50);
  // Bandpass filter at ~3200 Hz (matched to 808 clap spectral peak)
  const bpFreq = 3200 * r;
  const bpQ = 3;
  const bpW0 = 2 * Math.PI * bpFreq / ctx.sampleRate;
  const bpAlpha = Math.sin(bpW0) / (2 * bpQ);
  const bpB0 = bpAlpha;
  const bpA0 = 1 + bpAlpha;
  const bpA1 = -2 * Math.cos(bpW0);
  const bpA2 = 1 - bpAlpha;
  let bpX1 = 0, bpX2 = 0, bpY1 = 0, bpY2 = 0;
  // 4 micro-bursts with randomized spacing (simulating multiple hands)
  const burstOffsets = [0, 0.008 + rand() * 0.004, 0.018 + rand() * 0.006, 0.03 + rand() * 0.005];
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const rawNoise = rand() * 2 - 1;
    // Sum of micro-bursts
    let bursts = 0;
    for (const offset of burstOffsets) {
      const bt = t - offset;
      if (bt >= 0) bursts += Math.exp(-bt * (35 / decay)) * 0.5;
    }
    const raw = rawNoise * bursts;
    // Bandpass filtering for resonant body
    const shaped = (bpB0 * raw - bpB0 * bpX2 - bpA1 * bpY1 - bpA2 * bpY2) / bpA0;
    bpX2 = bpX1; bpX1 = raw; bpY2 = bpY1; bpY1 = shaped;
    // Blend raw + resonant
    buf[i] = raw * 0.5 + shaped * 0.5;
  }
  return out;
}

/** Tom — pitched drum with sine sweep (200Hz base) and attack click. */
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
    const body = Math.sin(phase) * Math.exp(-t * (12 / decay)) * 0.7;
    // Sub-ms transient snap
    const click = Math.sin(2 * Math.PI * 5000 * t) * Math.exp(-t * 2500) * 0.08;
    buf[i] = body + click;
  }
  return out;
}

/** Ride cymbal — 909 measured at ~8.5kHz dominant, brighter than crash.
 *  4 bell partials centered at 8.5kHz with stick transient. */
function synthRide(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1, color = 0 } = vp;
  const shift = Math.pow(2, color * 0.5);
  const r = tuneRatio(tune);
  const len = 0.6 * decay;
  const out = makeBuf(ctx, Math.min(len, 3));
  const buf = out.getChannelData(0);
  // 909 ride: bell-like with harmonics from low-mid to high
  // Real ride has fundamental ~300-400Hz with inharmonic overtones
  const freqs = [392, 1200, 2800, 4600, 6200, 8500].map(f => f * shift * r);
  const amps = [0.04, 0.05, 0.05, 0.04, 0.03, 0.02]; // boosted bell for presence
  const rand = seededRandom(51);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const raw = rand() * 2 - 1;
    // Stick attack transient
    const stick = Math.exp(-t * 400) * 0.18;
    const noise = (raw - prev) * 0.35 * Math.exp(-t * (5 / decay));
    let ring = 0;
    for (let p = 0; p < 6; p++) {
      ring += Math.sin(2 * Math.PI * freqs[p] * t) * amps[p];
    }
    ring *= Math.exp(-t * (8 / decay)); // moderate ring — bell color without sustained tone
    buf[i] = stick * raw + noise + ring;
    prev = raw;
  }
  return out;
}

/** Cowbell — actual 808 circuit uses 545 + 815 Hz square waves.
 *  808 measured spectral peak at ~840-900Hz.
 *  Bandpass at 800Hz with Q=4 adds bell-like ring. */
function synthCowbell(ctx: AudioContext, vp: DrumVoiceParams): AudioBuffer {
  const { tune = 0, decay = 1 } = vp;
  const r = tuneRatio(tune);
  const len = 0.15 * decay;
  const out = makeBuf(ctx, Math.min(len, 1));
  const buf = out.getChannelData(0);
  // Two detuned square oscillators + bandpass resonance for metallic ring
  // 808 cowbell: two square waves at 545 + 815 Hz
  const f1 = 545 * r, f2 = 815 * r;
  // Bandpass resonance at ~800 Hz — moderate Q to avoid piercing ring
  const bpFreq = 800 * r;
  const bpQ = 4;
  const bpW0 = 2 * Math.PI * bpFreq / ctx.sampleRate;
  const bpAlpha = Math.sin(bpW0) / (2 * bpQ);
  const bpB0 = bpAlpha;
  const bpA0 = 1 + bpAlpha;
  const bpA1 = -2 * Math.cos(bpW0);
  const bpA2 = 1 - bpAlpha;
  let bpX1 = 0, bpX2 = 0, bpY1 = 0, bpY2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * (20 / decay));
    const raw = (Math.sign(Math.sin(2 * Math.PI * f1 * t)) * 0.22
               + Math.sign(Math.sin(2 * Math.PI * f2 * t)) * 0.22) * env;
    // Bandpass filter adds bell-like ring
    const shaped = (bpB0 * raw - bpB0 * bpX2 - bpA1 * bpY1 - bpA2 * bpY2) / bpA0;
    bpX2 = bpX1; bpX1 = raw; bpY2 = bpY1; bpY1 = shaped;
    buf[i] = raw * 0.6 + shaped * 0.4;
  }
  return out;
}

// ── Drum kit ─────────────────────────────────────────────────────────────

export type DrumKit = Map<number, AudioBuffer>;

/** Map MIDI note → synthesis function. */
export const DRUM_SYNTHS: [number, SynthFn][] = [
  [36, synthKick], [37, synthRimshot], [38, synthSnare],
  [42, synthClosedHat], [46, synthOpenHat], [47, synthCowbell],
  [49, synthCrash], [50, synthClap], [51, synthRide], [56, synthCowbell],
];

/** Apply a short fade-out to the end of a buffer to prevent hard cutoff clicks. */
export function applyFadeOut(data: Float32Array, sampleRate: number, fadeMs = 5): void {
  const fadeSamples = Math.round(sampleRate * fadeMs / 1000);
  const start = Math.max(0, data.length - fadeSamples);
  for (let i = start; i < data.length; i++) {
    data[i] *= (data.length - i) / fadeSamples;
  }
}

export function buildKit(ctx: AudioContext, voiceParams?: Map<number, DrumVoiceParams>): DrumKit {
  const kit: DrumKit = new Map();
  for (const [note, fn] of DRUM_SYNTHS) {
    const vp = voiceParams?.get(note) ?? DEFAULT_DRUM_VOICE;
    const buf = fn(ctx, vp);
    const data = buf.getChannelData(0);
    if (vp.filterCutoff !== undefined && vp.filterCutoff < 1) {
      applyFilter(data, vp.filterCutoff, ctx.sampleRate);
    }
    // Fade out last 5ms to prevent hard cutoff clicks on all voices
    applyFadeOut(data, ctx.sampleRate);
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
  filter: BiquadFilterNode | AudioWorkletNode | null;
  workletOscs: AudioWorkletNode[]; // worklet-based oscillators (sync/fm/wavetable)
  lfo: OscillatorNode | null;
  lfoGains: GainNode[];
  driftLFOs: OscillatorNode[]; // per-osc analog drift oscillators + PWM LFOs
  pwmExtras: AudioNode[];      // PWM delay/inverter/sum nodes
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

/** Generate a distortion curve for WaveShaperNode.
 *  Uses asymmetric soft-clipping: tanh base + subtle even harmonics for analog feel. */
export function makeDistortionCurve(drive: number): Float32Array {
  const n = 1024; // higher resolution for smoother clipping
  const curve = new Float32Array(n);
  const k = drive;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // Base: soft clip with drive
    const base = ((1 + k) * x) / (1 + k * Math.abs(x));
    // Subtle asymmetry — adds even harmonics (tube-like warmth)
    const asym = 0.05 * x * Math.exp(-x * x * 4);
    curve[i] = base + asym;
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

/** Generate a soft-clip curve, or a linear pass-through curve.
 *  Active mode uses a two-stage sigmoid: gentle knee + firm ceiling for tape-like saturation. */
export function makeSoftClipCurve(active: boolean): Float32Array {
  const n = 8192;
  const curve = new Float32Array(n);
  if (!active) {
    for (let i = 0; i < n; i++) curve[i] = (i * 2) / n - 1;
    return curve;
  }
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // Stage 1: gentle knee (like tape approaching saturation)
    const knee = x / (1 + 0.3 * Math.abs(x));
    // Stage 2: firm ceiling via tanh (prevents hard clip)
    const ceiling = Math.tanh(knee * 1.4) / Math.tanh(1.4);
    // Subtle even-harmonic asymmetry (tape bias)
    const bias = 0.02 * x * Math.exp(-x * x * 3);
    curve[i] = ceiling + bias;
  }
  return curve;
}

export type ReverbType = "room" | "hall" | "plate" | "spring";

// Per-type impulse response parameters for algorithmic reverb.
// erTimes/erGains: discrete early reflections (room geometry simulation)
// predelay: gap before diffuse tail starts (larger rooms = longer)
// tailBright: one-pole LP on tail (0=dark, 1=bright). Hall=dark, plate=bright.
// diffStages/apDelays/apGain: allpass cascade for Schroeder-style diffusion
// density: noise level scaling in the diffuse tail
const REVERB_PRESETS: Record<ReverbType, {
  erTimes: number[]; erGains: number[]; erStereo: number;
  predelay: number; tailBright: number; diffStages: number;
  apDelays: number[]; apGain: number; density: number;
}> = {
  room: {
    erTimes: [0.007, 0.013, 0.019, 0.027, 0.037, 0.048, 0.061, 0.079],
    erGains: [0.85, 0.72, 0.60, 0.50, 0.40, 0.32, 0.25, 0.18],
    erStereo: 0.002, predelay: 0.06, tailBright: 0.6,
    diffStages: 2, apDelays: [0.0037, 0.0113], apGain: 0.6, density: 2.0,
  },
  hall: {
    erTimes: [0.012, 0.024, 0.038, 0.055, 0.074, 0.096, 0.121, 0.150, 0.183, 0.220],
    erGains: [0.90, 0.78, 0.67, 0.57, 0.48, 0.40, 0.33, 0.27, 0.22, 0.17],
    erStereo: 0.004, predelay: 0.10, tailBright: 0.4,
    diffStages: 3, apDelays: [0.0047, 0.0137, 0.0211], apGain: 0.65, density: 2.5,
  },
  plate: {
    erTimes: [0.002, 0.005, 0.008, 0.012, 0.017, 0.023],
    erGains: [0.95, 0.85, 0.75, 0.65, 0.55, 0.45],
    erStereo: 0.001, predelay: 0.01, tailBright: 0.85,
    diffStages: 4, apDelays: [0.0013, 0.0037, 0.0067, 0.0097], apGain: 0.7, density: 3.0,
  },
  spring: {
    erTimes: [0.003, 0.030, 0.033, 0.060, 0.063, 0.090],
    erGains: [0.90, 0.70, 0.65, 0.50, 0.45, 0.35],
    erStereo: 0.0005, predelay: 0.03, tailBright: 0.5,
    diffStages: 2, apDelays: [0.0029, 0.0089], apGain: 0.55, density: 1.8,
  },
};

/** Generate a synthetic impulse response for reverb.
 *  Supports room, hall, plate, and spring types. */
export function generateImpulseResponse(ctx: AudioContext, decay: number, type: ReverbType = "room"): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.ceil(rate * decay);
  const buf = ctx.createBuffer(2, len, rate);
  const rand = seededRandom(7919);
  const p = REVERB_PRESETS[type];

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);

    // ── Early reflections ───────────────────────────────────────────
    for (let r = 0; r < p.erTimes.length; r++) {
      const offset = ch === 0 ? 0 : p.erStereo * (r % 3 === 0 ? 1 : -1);
      const sampleIdx = Math.round((p.erTimes[r] + offset) * rate);
      if (sampleIdx < len) {
        data[sampleIdx] += p.erGains[r] * (ch === 0 ? 1 : -1 + 2 * (r % 2));
      }
    }

    // ── Late diffuse tail ───────────────────────────────────────────
    const predelay = Math.round(p.predelay * rate);
    const decayRate = 1 / (rate * decay * 0.45);
    for (let i = predelay; i < len; i++) {
      data[i] += (rand() * 2 - 1) * p.density * Math.exp(-(i - predelay) * decayRate);
    }

    // ── Brightness filter (one-pole LP on tail) ─────────────────────
    if (p.tailBright < 1) {
      let lpPrev = 0;
      const alpha = p.tailBright;
      const startIdx = predelay;
      for (let i = startIdx; i < len; i++) {
        data[i] = lpPrev = lpPrev + alpha * (data[i] - lpPrev);
      }
    }

    // ── Allpass diffusion ───────────────────────────────────────────
    for (let stage = 0; stage < p.diffStages; stage++) {
      const apDelay = Math.round(p.apDelays[stage] * rate);
      const apBuf = new Float32Array(apDelay);
      let apIdx = 0;
      for (let i = 0; i < len; i++) {
        const delayed = apBuf[apIdx];
        const input = data[i];
        const out = -input * p.apGain + delayed;
        apBuf[apIdx] = input + delayed * p.apGain;
        data[i] = out;
        apIdx = (apIdx + 1) % apDelay;
      }
    }

    // ── DC-blocking filter ──────────────────────────────────────────
    let dcX1 = 0, dcY1 = 0;
    for (let i = 0; i < len; i++) {
      const x = data[i];
      dcY1 = x - dcX1 + 0.995 * dcY1;
      dcX1 = x;
      data[i] = dcY1;
    }
  }
  return buf;
}
