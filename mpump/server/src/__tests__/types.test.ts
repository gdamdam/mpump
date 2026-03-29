import { describe, it, expect } from "vitest";
import {
  DEFAULT_SYNTH_PARAMS,
  DEFAULT_DRUM_VOICE,
  DEFAULT_EFFECTS,
  DRUM_VOICES,
  lfoDivisionToHz,
  delayDivisionToSeconds,
  LFO_DIVISIONS,
  DELAY_DIVISIONS,
} from "../types";

describe("DEFAULT_SYNTH_PARAMS", () => {
  it("has all required fields", () => {
    expect(DEFAULT_SYNTH_PARAMS.oscType).toBe("sawtooth");
    expect(DEFAULT_SYNTH_PARAMS.filterType).toBe("lowpass");
    expect(DEFAULT_SYNTH_PARAMS.attack).toBeGreaterThan(0);
    expect(DEFAULT_SYNTH_PARAMS.decay).toBeGreaterThan(0);
    expect(DEFAULT_SYNTH_PARAMS.sustain).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SYNTH_PARAMS.sustain).toBeLessThanOrEqual(1);
    expect(DEFAULT_SYNTH_PARAMS.release).toBeGreaterThan(0);
    expect(DEFAULT_SYNTH_PARAMS.cutoff).toBeGreaterThan(0);
    expect(DEFAULT_SYNTH_PARAMS.resonance).toBeGreaterThan(0);
    expect(typeof DEFAULT_SYNTH_PARAMS.subOsc).toBe("boolean");
    expect(typeof DEFAULT_SYNTH_PARAMS.lfoOn).toBe("boolean");
    expect(typeof DEFAULT_SYNTH_PARAMS.detune).toBe("number");
  });

  it("filter type is a valid BiquadFilter type", () => {
    expect(["lowpass", "highpass", "bandpass", "notch"]).toContain(DEFAULT_SYNTH_PARAMS.filterType);
  });
});

describe("DEFAULT_DRUM_VOICE", () => {
  it("has neutral defaults", () => {
    expect(DEFAULT_DRUM_VOICE.tune).toBe(0);
    expect(DEFAULT_DRUM_VOICE.decay).toBe(1);
    expect(DEFAULT_DRUM_VOICE.level).toBe(1);
  });
});

describe("DRUM_VOICES", () => {
  it("has 9 voices with unique MIDI notes", () => {
    expect(DRUM_VOICES.length).toBe(9);
    const notes = DRUM_VOICES.map(v => v.note);
    expect(new Set(notes).size).toBe(9);
  });

  it("each voice has a name and note", () => {
    for (const v of DRUM_VOICES) {
      expect(v.name.length).toBeGreaterThan(0);
      expect(v.note).toBeGreaterThanOrEqual(36);
      expect(v.note).toBeLessThanOrEqual(127);
    }
  });
});

describe("DEFAULT_EFFECTS", () => {
  it("has 8 effects all defaulting to off", () => {
    const names = Object.keys(DEFAULT_EFFECTS);
    expect(names.length).toBe(8);
    for (const name of names) {
      expect((DEFAULT_EFFECTS as unknown as Record<string, { on: boolean }>)[name].on).toBe(false);
    }
  });

  it("delay has time, feedback, mix", () => {
    expect(DEFAULT_EFFECTS.delay.time).toBeGreaterThan(0);
    expect(DEFAULT_EFFECTS.delay.feedback).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_EFFECTS.delay.feedback).toBeLessThanOrEqual(1);
    expect(DEFAULT_EFFECTS.delay.mix).toBeGreaterThanOrEqual(0);
  });
});

describe("lfoDivisionToHz", () => {
  const bpm = 120; // beatHz = 2

  it("converts all named divisions", () => {
    expect(lfoDivisionToHz("2", bpm)).toBeCloseTo(0.25);   // 2 bars
    expect(lfoDivisionToHz("1", bpm)).toBeCloseTo(0.5);    // 1 bar
    expect(lfoDivisionToHz("1/2", bpm)).toBeCloseTo(1);
    expect(lfoDivisionToHz("1/4", bpm)).toBeCloseTo(2);
    expect(lfoDivisionToHz("1/8", bpm)).toBeCloseTo(4);
    expect(lfoDivisionToHz("1/16", bpm)).toBeCloseTo(8);
    expect(lfoDivisionToHz("1/32", bpm)).toBeCloseTo(16);
  });

  it("falls back to beatHz for unknown division", () => {
    expect(lfoDivisionToHz("unknown", bpm)).toBeCloseTo(2);
  });

  it("scales with BPM", () => {
    expect(lfoDivisionToHz("1/4", 60)).toBeCloseTo(1);
    expect(lfoDivisionToHz("1/4", 180)).toBeCloseTo(3);
  });
});

describe("delayDivisionToSeconds", () => {
  const bpm = 120; // beat = 0.5s

  it("converts all named divisions", () => {
    expect(delayDivisionToSeconds("1/2", bpm)).toBeCloseTo(1);
    expect(delayDivisionToSeconds("1/4", bpm)).toBeCloseTo(0.5);
    expect(delayDivisionToSeconds("1/8", bpm)).toBeCloseTo(0.25);
    expect(delayDivisionToSeconds("1/8d", bpm)).toBeCloseTo(0.375);
    expect(delayDivisionToSeconds("1/16", bpm)).toBeCloseTo(0.125);
    expect(delayDivisionToSeconds("1/32", bpm)).toBeCloseTo(0.0625);
  });

  it("falls back to 1/16 for unknown division", () => {
    expect(delayDivisionToSeconds("???", bpm)).toBeCloseTo(0.125);
  });
});

describe("LFO_DIVISIONS / DELAY_DIVISIONS", () => {
  it("LFO_DIVISIONS has 7 entries", () => {
    expect(LFO_DIVISIONS).toHaveLength(7);
  });

  it("DELAY_DIVISIONS has 6 entries", () => {
    expect(DELAY_DIVISIONS).toHaveLength(6);
  });
});
