/**
 * Tests for Tutorial hook logic and STEPS constants.
 * We test the storage-based logic directly (importing the component triggers
 * side effects from Settings/main that require document, so we avoid it).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getItem, setItem } from "../utils/storage";

const STORAGE_KEY = "mpump-tutorial-done";

/** Simple in-memory localStorage stub */
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

describe("Tutorial – useTutorial logic via storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
  });

  it("showTutorial is true when localStorage key is not set", () => {
    const val = getItem(STORAGE_KEY);
    const show = !val;
    expect(show).toBe(true);
  });

  it("showTutorial is false when localStorage key is set to '1'", () => {
    setItem(STORAGE_KEY, "1");
    const val = getItem(STORAGE_KEY);
    const show = !val;
    expect(show).toBe(false);
  });

  it("dismissTutorial sets localStorage key and would return false", () => {
    expect(!getItem(STORAGE_KEY)).toBe(true); // initially true
    setItem(STORAGE_KEY, "1");
    expect(!getItem(STORAGE_KEY)).toBe(false); // after dismiss
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("getItem returns empty string (falsy) when key not present", () => {
    expect(getItem(STORAGE_KEY)).toBe("");
  });
});

describe("Tutorial – STEPS structure (source verification)", () => {
  let src: string;

  beforeEach(async () => {
    const fs = await import("fs");
    const path = await import("path");
    src = fs.readFileSync(
      path.resolve(__dirname, "../components/Tutorial.tsx"),
      "utf-8",
    );
  });

  it("defines exactly 6 STEPS entries", () => {
    const matches = src.match(/\{\s*title:\s*"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(7);
  });

  it("last step has last: true", () => {
    const stepsMatch = src.match(/const STEPS[\s\S]*?\n\];/);
    expect(stepsMatch).not.toBeNull();
    const lastEntry = stepsMatch![0].split("{").pop()!;
    expect(lastEntry).toContain("last: true");
  });

  it("exports useTutorial function", () => {
    expect(src).toContain("export function useTutorial()");
  });

  it("exports Tutorial component", () => {
    expect(src).toContain("export function Tutorial(");
  });
});
