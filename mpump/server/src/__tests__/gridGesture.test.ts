/**
 * Pure grid-gesture logic (#3). The shared useGridPointer hook builds on these:
 * - classifyGesture: from a pointer delta, decide tap (below threshold),
 *   paint (horizontal-dominant drag → toggle cells), or adjust (vertical-dominant
 *   drag → pitch on melodic grids / velocity on drums).
 * - dyToSteps: quantize a vertical drag (px, up = negative) into integer steps,
 *   up = positive.
 */
import { describe, it, expect } from "vitest";
import { classifyGesture, dyToSteps } from "../utils/gridGesture";

describe("classifyGesture", () => {
  it("is pending while movement is below threshold", () => {
    expect(classifyGesture(0, 0)).toBe("pending");
    expect(classifyGesture(3, 3)).toBe("pending");
    expect(classifyGesture(5, -5)).toBe("pending"); // default threshold 6
  });

  it("is paint when horizontal movement dominates", () => {
    expect(classifyGesture(10, 2)).toBe("paint");
    expect(classifyGesture(-20, 5)).toBe("paint");
  });

  it("is adjust when vertical movement dominates (ties go to adjust)", () => {
    expect(classifyGesture(2, 10)).toBe("adjust");
    expect(classifyGesture(0, -15)).toBe("adjust");
    expect(classifyGesture(8, 8)).toBe("adjust"); // equal → adjust
  });

  it("respects a custom threshold", () => {
    expect(classifyGesture(8, 0, 12)).toBe("pending");
    expect(classifyGesture(15, 0, 12)).toBe("paint");
  });
});

describe("dyToSteps", () => {
  it("maps upward drag (negative dy) to positive steps", () => {
    expect(dyToSteps(-24, 12)).toBe(2);
    expect(dyToSteps(-6, 12)).toBe(1); // rounds 0.5 up
  });

  it("maps downward drag (positive dy) to negative steps", () => {
    expect(dyToSteps(24, 12)).toBe(-2);
  });

  it("rounds small drags to zero and guards bad step size", () => {
    expect(dyToSteps(5, 12)).toBe(0);
    expect(dyToSteps(0, 12)).toBe(0);
    expect(dyToSteps(-50, 0)).toBe(0);
  });
});
