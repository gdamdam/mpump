/**
 * Tests for the share/session schema-version seam. A version field lets future
 * clients detect format changes instead of silently misdecoding old data.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateSharePayload, SHARE_SCHEMA_VERSION } from "../utils/patternCodec";
import { exportSession, readSessionFile, SESSION_SCHEMA_VERSION } from "../utils/session";

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

describe("share payload schema version", () => {
  it("preserves an explicit version field", () => {
    const p = validateSharePayload({ bpm: 120, g: { d: { gi: 0, pi: 0 } }, v: SHARE_SCHEMA_VERSION });
    expect(p?.v).toBe(SHARE_SCHEMA_VERSION);
  });

  it("defaults legacy payloads (no v) to version 1", () => {
    const p = validateSharePayload({ bpm: 120, g: { d: { gi: 0, pi: 0 } } });
    expect(p?.v).toBe(1);
  });
});

describe("session schema version", () => {
  beforeEach(() => vi.stubGlobal("localStorage", makeStorage()));

  it("exportSession stamps the current schema version", () => {
    const s = exportSession(
      { bpm: 120, swing: 0, devices: {} },
      1, {}, { activeDrumKit: "a", activeSynth: "b", activeBass: "c" }, "off",
    );
    expect(s.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
  });

  it("readSessionFile rejects a session from a newer schema version", async () => {
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText(file: { _content: string }) {
        this.result = file._content;
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);
    const future = JSON.stringify({ version: "9.9.9", schemaVersion: SESSION_SCHEMA_VERSION + 1, devices: {} });
    await expect(readSessionFile({ _content: future } as unknown as File)).rejects.toThrow();
  });
});
