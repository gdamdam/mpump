/**
 * Sound quality regression tests.
 * Run: npx vitest run src/__tests__/sound-quality.test.ts
 *
 * These tests synthesize drum/synth/bass voices offline and check for:
 * - DC offset clicks (first sample > threshold)
 * - Large sample-to-sample jumps (click artifacts)
 * - NaN/Infinity values
 * - Clipping (sustained values at ±1)
 * - Silent output
 * - DC offset (average value != 0)
 * - Level matching against 808 reference RMS (drums only)
 */

import { describe, it, expect } from "vitest";

// ── Helpers ──────────────────────────────────────────────────────────────

const SR = 44100;

function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CheckResult {
  pass: boolean;
  peak: number;
  rms: number;
  issues: string[];
}

function checkBuffer(buf: Float32Array, opts?: {
  dcOnsetThreshold?: number; // max abs value at sample 0 (default 0.15)
  jumpThreshold?: number;    // max sample-to-sample jump (default 0.8)
  dcOffsetThreshold?: number; // max average DC offset (default 0.05)
  minPeak?: number;          // minimum peak (default 0.01)
  endClickThreshold?: number; // max abs value at last sample (default 0.01)
}): CheckResult {
  const dcOnsetMax = opts?.dcOnsetThreshold ?? 0.15;
  const jumpMax = opts?.jumpThreshold ?? 0.8;
  const dcOffMax = opts?.dcOffsetThreshold ?? 0.05;
  const minPeak = opts?.minPeak ?? 0.01;
  const endClickMax = opts?.endClickThreshold ?? 0.01;

  let peak = 0, rmsSum = 0, dcSum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    if (Math.abs(v) > peak) peak = Math.abs(v);
    rmsSum += v * v;
    dcSum += v;
  }
  const rms = Math.sqrt(rmsSum / buf.length);
  const dcOffset = Math.abs(dcSum / buf.length);

  const issues: string[] = [];

  // DC click at onset
  if (Math.abs(buf[0]) > dcOnsetMax) {
    issues.push(`DC-onset(${Math.abs(buf[0]).toFixed(3)})`);
  }

  // Large sample-to-sample jumps (click artifacts)
  let maxJump = 0, jumpPos = 0;
  for (let i = 1; i < buf.length; i++) {
    const j = Math.abs(buf[i] - buf[i - 1]);
    if (j > maxJump) { maxJump = j; jumpPos = i; }
  }
  if (maxJump > jumpMax) {
    issues.push(`click@${(jumpPos / SR * 1000).toFixed(0)}ms(${maxJump.toFixed(2)})`);
  }

  // NaN or Infinity
  for (let i = 0; i < buf.length; i++) {
    if (!isFinite(buf[i])) { issues.push("NaN/Inf"); break; }
  }

  // Clipping
  let clipCount = 0;
  for (let i = 0; i < buf.length; i++) {
    if (Math.abs(buf[i]) > 0.99) clipCount++;
  }
  if (clipCount > 10) issues.push(`clip(${clipCount})`);

  // DC offset
  if (dcOffset > dcOffMax) issues.push(`DC-offset(${dcOffset.toFixed(3)})`);

  // Silent
  if (peak < minPeak) issues.push("silent");

  // End-of-buffer click (buffer cuts off while signal is still audible)
  const lastSample = Math.abs(buf[buf.length - 1]);
  if (lastSample > endClickMax) issues.push(`end-click(${lastSample.toFixed(4)})`);

  return { pass: issues.length === 0, peak, rms, issues };
}

/** Apply 5ms fade-out (matches buildKit behavior) */
function applyFadeOut(buf: Float32Array): Float32Array {
  const fadeSamples = Math.round(SR * 0.005);
  const start = Math.max(0, buf.length - fadeSamples);
  for (let i = start; i < buf.length; i++) {
    buf[i] *= (buf.length - i) / fadeSamples;
  }
  return buf;
}

// ── Drum voice generators (match drumSynth.ts) ──────────────────────────

function synthKick(): Float32Array {
  const buf = new Float32Array(SR * 0.5);
  const baseF = 50, sweep = 165, sRate = 55, clickAmt = 0.08;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const phase = 2 * Math.PI * (baseF * t + (sweep / sRate) * (1 - Math.exp(-t * sRate)));
    buf[i] = Math.sin(phase) * Math.exp(-t * 6) * 0.55
      + Math.sin(2 * Math.PI * 50 * t) * Math.exp(-t * 5) * 0.25
      + Math.sin(2 * Math.PI * 5000 * t) * Math.exp(-t * 3000) * clickAmt * 0.4;
  }
  return buf;
}

function synthSnare(): Float32Array {
  const buf = new Float32Array(SR * 0.3);
  const rand = seededRandom(38);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const pe = 1 + 0.5 * Math.exp(-t * 60);
    buf[i] = Math.sin(2 * Math.PI * 185 * pe * t) * Math.exp(-t * 25) * 0.315
      + Math.sin(2 * Math.PI * 110 * t) * Math.exp(-t * 30) * 0.126
      + (rand() * 2 - 1) * Math.exp(-t * 14) * 0.385;
  }
  return buf;
}

function synthClosedHat(): Float32Array {
  const buf = new Float32Array(SR * 0.08);
  const rand = seededRandom(42);
  const freqs = [3500, 5200, 7500, 4100, 6300, 8800];
  const amps = [0.18, 0.13, 0.20, 0.10, 0.15, 0.05];
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const raw = rand() * 2 - 1;
    const transient = Math.exp(-t * 1000) * 0.25;
    const noise = (raw - prev) * Math.exp(-t * 50) * 0.5;
    let ring = 0;
    for (let p = 0; p < 6; p++) ring += Math.sin(2 * Math.PI * freqs[p] * t) * amps[p];
    ring *= Math.exp(-t * 60);
    buf[i] = transient * raw + noise + ring;
    prev = raw;
  }
  return buf;
}

function synthClap(): Float32Array {
  // Clap uses multiple noise bursts — large jumps at burst onsets are intentional
  const buf = new Float32Array(SR * 0.25);
  const rand = seededRandom(50);
  const offsets = [0, 0.01, 0.022, 0.033];
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    let bursts = 0;
    for (const o of offsets) { const bt = t - o; if (bt >= 0) bursts += Math.exp(-bt * 35) * 0.5; }
    buf[i] = (rand() * 2 - 1) * bursts * 0.5;
  }
  return buf;
}

function synthCowbell(): Float32Array {
  const buf = new Float32Array(SR * 0.15);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 20);
    buf[i] = (Math.sign(Math.sin(2 * Math.PI * 545 * t)) * 0.22
      + Math.sign(Math.sin(2 * Math.PI * 815 * t)) * 0.22) * env;
  }
  return buf;
}

function synthRimshot(): Float32Array {
  const buf = new Float32Array(SR * 0.04);
  const rand = seededRandom(37);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    buf[i] = (Math.sin(2 * Math.PI * 920 * t) * 0.45
      + Math.sin(2 * Math.PI * 1600 * t) * 0.3
      + (rand() * 2 - 1) * 0.25) * Math.exp(-t * 80);
  }
  return buf;
}

// ── Synth voice generator ───────────────────────────────────────────────

function generateVoice(oscType: string, freq: number, attack = 0.005, sustain = 0.6, release = 0.06): Float32Array {
  const noteDur = 0.2, relDur = 0.2;
  const buf = new Float32Array(Math.ceil(SR * (noteDur + relDur)));
  const atk = Math.max(0.008, attack);
  const dec = 0.15;
  const noteOffSample = Math.round(noteDur * SR);

  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const phase = (freq * t) % 1;
    let osc: number;
    switch (oscType) {
      case "sawtooth": osc = 2 * phase - 1; break;
      case "square": osc = phase < 0.5 ? 1 : -1; break;
      case "sine": osc = Math.sin(2 * Math.PI * freq * t); break;
      case "triangle": osc = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase; break;
      default: osc = 2 * phase - 1;
    }
    let env: number;
    if (t < atk) env = t / atk;
    else if (t < atk + dec) env = 1 - (1 - sustain) * ((t - atk) / dec);
    else if (i < noteOffSample) env = sustain;
    else env = sustain * Math.exp(-(t - noteOffSample / SR) / (release / 3));

    buf[i] = osc * env * 0.3;
  }
  return buf;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Drum voices — no artifacts", () => {
  const drums = [
    { name: "Kick", gen: synthKick },
    { name: "Snare", gen: synthSnare },
    { name: "Closed Hat", gen: synthClosedHat },
    { name: "Clap", gen: synthClap },
    { name: "Cowbell", gen: synthCowbell },
    { name: "Rimshot", gen: synthRimshot },
  ];

  for (const d of drums) {
    it(`${d.name}: no DC click, no NaN, not silent, no end click`, () => {
      // Percussive voices have intentionally sharp transients and noise onsets
      const isNoisy = ["Clap", "Cowbell", "Snare", "Closed Hat"].includes(d.name);
      const r = checkBuffer(applyFadeOut(d.gen()), {
        jumpThreshold: isNoisy ? 2.0 : 0.8,
        dcOnsetThreshold: isNoisy ? 0.3 : 0.15,
      });
      expect(r.issues).toEqual([]);
      expect(r.peak).toBeGreaterThan(0.1);
    });
  }
});

describe("Drum voices — level matched to 808 reference", () => {
  // 808 reference RMS values (measured from samples)
  const refs: Record<string, number> = {
    Kick: 0.2126,
    Snare: 0.1687,
    "Closed Hat": 0.2343,
    Clap: 0.1244,
    Cowbell: 0.1414,
  };

  for (const [name, refRms] of Object.entries(refs)) {
    it(`${name}: RMS within ±50% of 808 reference`, () => {
      const drums: Record<string, () => Float32Array> = {
        Kick: synthKick, Snare: synthSnare, "Closed Hat": synthClosedHat,
        Clap: synthClap, Cowbell: synthCowbell,
      };
      const r = checkBuffer(drums[name]());
      const ratio = r.rms / refRms;
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(1.5);
    });
  }
});

describe("Synth voices — all oscillator types clean", () => {
  const oscTypes = ["sawtooth", "square", "sine", "triangle"];
  const freqs = [55, 220, 440, 2000]; // bass to high

  for (const osc of oscTypes) {
    for (const freq of freqs) {
      it(`${osc} at ${freq}Hz: no artifacts`, () => {
        const r = checkBuffer(generateVoice(osc, freq));
        expect(r.issues).toEqual([]);
      });
    }
  }
});

describe("Edge cases", () => {
  it("Sub bass (30Hz sine): no artifacts", () => {
    const r = checkBuffer(generateVoice("sine", 30, 0.01, 0.8, 0.1));
    expect(r.issues).toEqual([]);
  });

  it("High frequency (8kHz saw): no artifacts", () => {
    const r = checkBuffer(generateVoice("sawtooth", 8000, 0.001, 0.3, 0.02));
    expect(r.issues).toEqual([]);
  });

  it("Zero attack square: no artifacts", () => {
    const r = checkBuffer(generateVoice("square", 440, 0.001, 0.5, 0.01));
    expect(r.issues).toEqual([]);
  });

  it("Very long release (3s): no NaN", () => {
    const r = checkBuffer(generateVoice("sine", 440, 0.005, 0.6, 3.0));
    expect(r.issues).toEqual([]);
  });
});

describe("Preset counts", () => {
  it("has ≥29 synth presets", async () => {
    const { SYNTH_PRESETS } = await import("../data/soundPresets");
    expect(SYNTH_PRESETS.length).toBeGreaterThanOrEqual(29);
  });

  it("has ≥20 bass presets", async () => {
    const { BASS_PRESETS } = await import("../data/soundPresets");
    expect(BASS_PRESETS.length).toBeGreaterThanOrEqual(20);
  });

  it("has ≥15 drum kit presets", async () => {
    const { DRUM_KIT_PRESETS } = await import("../data/soundPresets");
    expect(DRUM_KIT_PRESETS.length).toBeGreaterThanOrEqual(15);
  });
});
