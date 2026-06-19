/**
 * Tests for the safe localStorage wrapper — focuses on quota/availability
 * failure surfacing (setJSON/setItem must report success, never throw).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getItem, setItem, getJSON, setJSON } from "../utils/storage";

function makeStorage(opts: { throwOnSet?: boolean } = {}): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new DOMException("quota", "QuotaExceededError");
      store[k] = v;
    },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

describe("storage write-result reporting", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
  });

  it("setJSON returns true on success and persists the value", () => {
    expect(setJSON("k", { a: 1 })).toBe(true);
    expect(getJSON("k", null)).toEqual({ a: 1 });
  });

  it("setItem returns true on success", () => {
    expect(setItem("k", "v")).toBe(true);
    expect(getItem("k")).toBe("v");
  });

  it("setJSON returns false when the quota is exceeded (no throw)", () => {
    vi.stubGlobal("localStorage", makeStorage({ throwOnSet: true }));
    expect(setJSON("k", { a: 1 })).toBe(false);
  });

  it("setItem returns false when the quota is exceeded (no throw)", () => {
    vi.stubGlobal("localStorage", makeStorage({ throwOnSet: true }));
    expect(setItem("k", "v")).toBe(false);
  });

  it("getItem/getJSON never throw when localStorage access itself throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    });
    expect(getItem("k", "fallback")).toBe("fallback");
    expect(getJSON("k", 42)).toBe(42);
  });
});
