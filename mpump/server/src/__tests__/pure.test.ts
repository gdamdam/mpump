/**
 * Tests for pure helper functions that don't require Web Audio API.
 * Covers scale helpers from data/keys.ts and envValueAt from AudioPort.ts.
 */
import { describe, it, expect } from "vitest";
import { nextInScale, snapToScale, SCALES, SCALE_NAMES, midiToNoteName, parseKey } from "../data/keys";
import { envValueAt } from "../engine/AudioPort";

describe("nextInScale", () => {
  it("chromatic steps by 1", () => {
    expect(nextInScale(0, 1, "chromatic")).toBe(1);
    expect(nextInScale(5, -1, "chromatic")).toBe(4);
  });

  it("major skips non-scale tones going up", () => {
    // C major: 0,2,4,5,7,9,11
    expect(nextInScale(0, 1, "major")).toBe(2); // C->D
    expect(nextInScale(2, 1, "major")).toBe(4); // D->E
    expect(nextInScale(4, 1, "major")).toBe(5); // E->F
  });

  it("major skips non-scale tones going down", () => {
    expect(nextInScale(5, -1, "major")).toBe(4); // F->E
    expect(nextInScale(4, -1, "major")).toBe(2); // E->D
  });

  it("pentatonic has 5 notes per octave", () => {
    // Pentatonic: 0,2,4,7,9
    expect(nextInScale(0, 1, "pentatonic")).toBe(2);
    expect(nextInScale(4, 1, "pentatonic")).toBe(7);
    expect(nextInScale(9, 1, "pentatonic")).toBe(12); // wraps to next octave
  });

  it("handles negative semitones", () => {
    expect(nextInScale(-1, -1, "major")).toBe(-3);
  });

  it("falls back to chromatic for unknown scale", () => {
    expect(nextInScale(5, 1, "nonexistent")).toBe(6);
  });
});

describe("snapToScale", () => {
  it("returns same value for chromatic", () => {
    expect(snapToScale(3, "chromatic")).toBe(3);
    expect(snapToScale(7, "chromatic")).toBe(7);
  });

  it("returns same value for unknown scale", () => {
    expect(snapToScale(3, "nonexistent")).toBe(3);
  });

  it("snaps to nearest major scale tone", () => {
    // C major: 0,2,4,5,7,9,11
    expect(snapToScale(1, "major")).toBe(0); // 1 → 0 (C)
    expect(snapToScale(3, "major")).toBe(2); // 3 → 2 (D), equidistant picks first found
    expect(snapToScale(6, "major")).toBe(5); // 6 → 5 (F)
    expect(snapToScale(8, "major")).toBe(7); // 8 → 7 (G)
  });

  it("handles negative semitone offsets", () => {
    // -1 mod 12 = 11, which IS in major → octaveBase + 11
    expect(snapToScale(-1, "major")).toBe(-1);
  });

  it("preserves octave for higher offsets", () => {
    // 13 mod 12 = 1, snap to 0 → octaveBase(12) + 0 = 12
    expect(snapToScale(13, "major")).toBe(12);
  });

  it("works with pentatonic", () => {
    // Pentatonic: 0,2,4,7,9
    expect(snapToScale(0, "pentatonic")).toBe(0);
    expect(snapToScale(3, "pentatonic")).toBe(2); // 3 → 2 (equidistant, first found)
    expect(snapToScale(5, "pentatonic")).toBe(4); // 5 → 4 (closer than 7)
  });
});

describe("SCALES", () => {
  it("has all expected scales", () => {
    expect(Object.keys(SCALES)).toContain("chromatic");
    expect(Object.keys(SCALES)).toContain("major");
    expect(Object.keys(SCALES)).toContain("minor");
    expect(Object.keys(SCALES)).toContain("pentatonic");
    expect(Object.keys(SCALES)).toContain("blues");
    expect(Object.keys(SCALES)).toContain("dorian");
    expect(Object.keys(SCALES)).toContain("mixolydian");
  });

  it("chromatic has 12 notes", () => {
    expect(SCALES.chromatic).toHaveLength(12);
  });

  it("major has 7 notes", () => {
    expect(SCALES.major).toHaveLength(7);
  });

  it("pentatonic has 5 notes", () => {
    expect(SCALES.pentatonic).toHaveLength(5);
  });

  it("blues has 6 notes", () => {
    expect(SCALES.blues).toHaveLength(6);
  });

  it("all scales start at 0", () => {
    for (const [name, intervals] of Object.entries(SCALES)) {
      expect(intervals[0], `${name} should start at 0`).toBe(0);
    }
  });

  it("SCALE_NAMES matches SCALES keys", () => {
    expect(SCALE_NAMES).toEqual(Object.keys(SCALES));
  });
});

describe("midiToNoteName", () => {
  it("converts middle C (MIDI 60) correctly", () => {
    expect(midiToNoteName(60)).toBe("C3");
  });

  it("converts A2 (MIDI 45)", () => {
    expect(midiToNoteName(45)).toBe("A1");
  });

  it("converts MIDI 0", () => {
    expect(midiToNoteName(0)).toBe("C-2");
  });

  it("handles sharps", () => {
    expect(midiToNoteName(61)).toBe("C#3");
    expect(midiToNoteName(66)).toBe("F#3");
  });
});

describe("parseKey", () => {
  it("parses A at default octave", () => {
    expect(parseKey("A")).toBe(45);
  });

  it("parses C at octave 2", () => {
    expect(parseKey("C", 2)).toBe(36);
  });

  it("parses sharps", () => {
    expect(parseKey("F#", 2)).toBe(42);
  });

  it("parses flats", () => {
    expect(parseKey("Bb", 2)).toBe(46);
  });

  it("handles different octaves", () => {
    expect(parseKey("C", 3)).toBe(48);
    expect(parseKey("C", 4)).toBe(60);
  });

  it("falls back to A2 for unknown key", () => {
    expect(parseKey("Z")).toBe(45);
  });

  it("handles lowercase input", () => {
    expect(parseKey("c", 2)).toBe(36);
  });

  it("clamps to valid MIDI range", () => {
    const result = parseKey("C", 0);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(127);
  });
});

describe("envValueAt", () => {
  const env = { amp: 0.2, atk: 0.1, dec: 0.2, sus: 0.6, startTime: 0 };

  it("returns 0 before start", () => {
    expect(envValueAt(env, -0.1)).toBe(0);
  });

  it("returns 0 at start", () => {
    expect(envValueAt(env, 0)).toBe(0);
  });

  it("ramps during attack", () => {
    const mid = envValueAt(env, 0.05); // halfway through attack
    expect(mid).toBeCloseTo(0.1, 2); // half of amp
  });

  it("reaches peak at end of attack", () => {
    expect(envValueAt(env, 0.1)).toBeCloseTo(0.2, 5); // full amp
  });

  it("decays after attack", () => {
    const mid = envValueAt(env, 0.2); // halfway through decay
    expect(mid).toBeCloseTo(0.2 * 0.8, 2); // between amp and amp*sus
  });

  it("reaches sustain level after attack+decay", () => {
    expect(envValueAt(env, 0.3)).toBeCloseTo(0.2 * 0.6, 5); // amp * sus
  });

  it("stays at sustain level", () => {
    expect(envValueAt(env, 1.0)).toBeCloseTo(0.2 * 0.6, 5);
    expect(envValueAt(env, 10.0)).toBeCloseTo(0.2 * 0.6, 5);
  });
});
