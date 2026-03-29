import { describe, it, expect } from "vitest";
import { euclidean } from "../engine/euclidean";

describe("euclidean", () => {
  it("E(0,8) = all rests", () => {
    expect(euclidean(0, 8)).toEqual([false, false, false, false, false, false, false, false]);
  });

  it("E(8,8) = all hits", () => {
    expect(euclidean(8, 8)).toEqual([true, true, true, true, true, true, true, true]);
  });

  it("E(1,4) = one hit at start", () => {
    expect(euclidean(1, 4)).toEqual([true, false, false, false]);
  });

  it("E(4,16) = four on the floor", () => {
    const p = euclidean(4, 16);
    expect(p.filter(Boolean).length).toBe(4);
    // Evenly spaced
    expect(p[0]).toBe(true);
    expect(p[4]).toBe(true);
    expect(p[8]).toBe(true);
    expect(p[12]).toBe(true);
  });

  it("E(3,8) = tresillo", () => {
    const p = euclidean(3, 8);
    expect(p.filter(Boolean).length).toBe(3);
    expect(p).toEqual([true, false, false, true, false, false, true, false]);
  });

  it("E(5,8) = cinquillo", () => {
    const p = euclidean(5, 8);
    expect(p.filter(Boolean).length).toBe(5);
  });

  it("rotation shifts the pattern", () => {
    const base = euclidean(3, 8, 0);
    const rot1 = euclidean(3, 8, 1);
    expect(rot1[0]).toBe(base[base.length - 1]);
    expect(rot1.filter(Boolean).length).toBe(3);
  });

  it("rotation wraps around", () => {
    const p = euclidean(3, 8, 8);
    expect(p).toEqual(euclidean(3, 8, 0)); // full rotation = no change
  });

  it("handles edge case: 0 steps", () => {
    expect(euclidean(3, 0)).toEqual([]);
  });

  it("hits > steps = all hits", () => {
    expect(euclidean(10, 4)).toEqual([true, true, true, true]);
  });
});
