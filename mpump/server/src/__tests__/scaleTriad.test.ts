/**
 * scaleTriad (#4) — derive an arpeggiator chord (root, 3rd, 5th, octave) from the
 * active scale instead of a hardcoded major triad. Diatonic scales use stacked
 * thirds (scale degrees 1/3/5); chromatic and unknown scales fall back to the
 * major triad [0,4,7,12] so existing patterns/links arp exactly as before.
 */
import { describe, it, expect } from "vitest";
import { scaleTriad } from "../data/keys";

describe("scaleTriad", () => {
  it("falls back to a major triad for chromatic (backward-compatible default)", () => {
    expect(scaleTriad("chromatic")).toEqual([0, 4, 7, 12]);
  });

  it("falls back to a major triad for unknown scales", () => {
    expect(scaleTriad("not-a-scale")).toEqual([0, 4, 7, 12]);
  });

  it("returns a major triad for major and mixolydian", () => {
    expect(scaleTriad("major")).toEqual([0, 4, 7, 12]);
    expect(scaleTriad("mixolydian")).toEqual([0, 4, 7, 12]);
  });

  it("returns a minor triad for minor and dorian", () => {
    expect(scaleTriad("minor")).toEqual([0, 3, 7, 12]);
    expect(scaleTriad("dorian")).toEqual([0, 3, 7, 12]);
  });

  it("stacks thirds within pentatonic and blues", () => {
    expect(scaleTriad("pentatonic")).toEqual([0, 4, 9, 12]); // [0,2,4,7,9] degrees 1/3/5
    expect(scaleTriad("blues")).toEqual([0, 5, 7, 12]); // [0,3,5,6,7,10] degrees 1/3/5
  });
});
