/**
 * Tests for session utility functions.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  exportSession,
  readSessionFile,
  saveLastSession,
  getLastSession,
  getRecentSessions,
  getSavedSessions,
  saveSession,
  renameSavedSession,
  deleteSavedSession,
  type SessionData,
} from "../utils/session";

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

/** Minimal device state for exportSession */
function makeDeviceState() {
  return {
    genre_idx: 0,
    pattern_idx: 1,
    bass_genre_idx: 2,
    bass_pattern_idx: 3,
    key_idx: 0,
    octave: 3,
    patternLength: 16,
    drumsMuted: false,
    bassMuted: false,
    pattern_data: [null, [1, 0.8, false]],
    drum_data: [[1, 100]],
    bass_data: [null],
    synthParams: null,
    bassSynthParams: null,
  };
}

function makeSession(): SessionData {
  return exportSession(
    { bpm: 130, swing: 0.1, devices: { dev1: makeDeviceState() } },
    0.8,
    { 0: 1, 1: 0.7 },
    { activeDrumKit: "808", activeSynth: "saw", activeBass: "sub" },
    "soft",
  );
}

describe("exportSession", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
  });

  it("returns an object with all required SessionData fields", () => {
    const s = makeSession();
    expect(s.version).toBeDefined();
    expect(s.timestamp).toBeDefined();
    expect(s.bpm).toBe(130);
    expect(s.swing).toBe(0.1);
    expect(s.masterVolume).toBe(0.8);
    expect(s.channelVolumes).toEqual({ 0: 1, 1: 0.7 });
    expect(s.devices).toHaveProperty("dev1");
    expect(s.activeDrumKit).toBe("808");
    expect(s.activeSynth).toBe("saw");
    expect(s.activeBass).toBe("sub");
    expect(s.antiClipMode).toBe("soft");
  });

  it("includes settings with correct defaults", () => {
    const s = makeSession();
    expect(s.scaleLock).toBe("chromatic");
    expect(s.arpMode).toBe("off");
    expect(s.arpRate).toBe("1/8");
    expect(s.humanize).toBe(false);
    expect(s.sidechainDuck).toBe(false);
    expect(s.metronome).toBe(false);
    expect(s.palette).toBe("forest");
  });

  it("timestamp is a valid ISO string", () => {
    const s = makeSession();
    expect(() => new Date(s.timestamp)).not.toThrow();
    expect(new Date(s.timestamp).toISOString()).toBe(s.timestamp);
  });

  it("device data is properly mapped", () => {
    const s = makeSession();
    const dev = s.devices.dev1;
    expect(dev.genre_idx).toBe(0);
    expect(dev.pattern_idx).toBe(1);
    expect(dev.octave).toBe(3);
    expect(dev.patternLength).toBe(16);
    expect(dev.drumsMuted).toBe(false);
    expect(dev.synthParams).toBeNull();
  });
});

describe("readSessionFile", () => {
  // FileReader is not available in Node/vitest without jsdom.
  // We mock it to test the parsing logic.
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());

    // Minimal FileReader mock
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText(file: File) {
        // Use the Blob.text() API which is available in Node 18+
        file.text().then((text) => {
          this.result = text;
          this.onload?.();
        }).catch(() => {
          this.onerror?.();
        });
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);
  });

  it("rejects invalid JSON", async () => {
    const file = new File(["not json{{{"], "bad.json", { type: "application/json" });
    await expect(readSessionFile(file)).rejects.toThrow();
  });

  it("rejects JSON missing version field", async () => {
    const data = JSON.stringify({ devices: {} });
    const file = new File([data], "no-version.json", { type: "application/json" });
    await expect(readSessionFile(file)).rejects.toThrow("Invalid session file");
  });

  it("rejects JSON missing devices field", async () => {
    const data = JSON.stringify({ version: "1.0.0" });
    const file = new File([data], "no-devices.json", { type: "application/json" });
    await expect(readSessionFile(file)).rejects.toThrow("Invalid session file");
  });

  it("accepts valid session JSON", async () => {
    const session = makeSession();
    const data = JSON.stringify(session);
    const file = new File([data], "good.json", { type: "application/json" });
    const result = await readSessionFile(file);
    expect(result.version).toBe(session.version);
    expect(result.bpm).toBe(130);
    expect(result.devices).toHaveProperty("dev1");
  });
});

describe("saveLastSession / getLastSession", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
  });

  it("getLastSession returns null when nothing saved", () => {
    expect(getLastSession()).toBeNull();
  });

  it("round-trip: save then retrieve matches", () => {
    const session = makeSession();
    saveLastSession(session, "acid-techno");
    const result = getLastSession();
    expect(result).not.toBeNull();
    expect(result!.label).toBe("acid-techno");
    expect(result!.data.bpm).toBe(130);
    expect(result!.data.activeDrumKit).toBe("808");
    expect(typeof result!.timestamp).toBe("number");
  });

  it("overwriting replaces previous session", () => {
    const s1 = makeSession();
    saveLastSession(s1, "techno");
    const s2 = exportSession(
      { bpm: 140, swing: 0, devices: {} },
      1, {}, { activeDrumKit: "909", activeSynth: "fm", activeBass: "acid" }, "hard",
    );
    saveLastSession(s2, "trance");
    const result = getLastSession();
    expect(result!.label).toBe("trance");
    expect(result!.data.bpm).toBe(140);
  });
});

describe("RecentSession shape", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
  });

  it("has correct fields (label, timestamp, data)", () => {
    const session = makeSession();
    saveLastSession(session, "house");
    const recent = getLastSession()!;
    expect(recent).toHaveProperty("label");
    expect(recent).toHaveProperty("timestamp");
    expect(recent).toHaveProperty("data");
    expect(typeof recent.label).toBe("string");
    expect(typeof recent.timestamp).toBe("number");
    expect(typeof recent.data).toBe("object");
  });
});

describe("getRecentSessions", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
  });

  it("returns empty array when nothing saved", () => {
    expect(getRecentSessions()).toEqual([]);
  });

  it("accumulates multiple saves with different genres", () => {
    const s = makeSession();
    saveLastSession(s, "techno");
    saveLastSession(s, "house");
    saveLastSession(s, "ambient");
    const list = getRecentSessions();
    expect(list).toHaveLength(3);
    expect(list[0].label).toBe("ambient"); // newest first
  });

  it("deduplicates by genre label", () => {
    const s = makeSession();
    saveLastSession(s, "techno");
    saveLastSession(s, "house");
    saveLastSession(s, "techno"); // duplicate
    const list = getRecentSessions();
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe("techno");
  });

  it("caps at 5 entries", () => {
    const s = makeSession();
    for (let i = 0; i < 8; i++) saveLastSession(s, `genre-${i}`);
    expect(getRecentSessions()).toHaveLength(5);
  });
});

describe("saved sessions (persistent)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("crypto", { randomUUID: () => `uuid-${Math.random()}` });
  });

  it("getSavedSessions returns empty array initially", () => {
    expect(getSavedSessions()).toEqual([]);
  });

  it("saveSession adds a session and returns it", () => {
    const s = makeSession();
    const saved = saveSession("My Mix", s);
    expect(saved.name).toBe("My Mix");
    expect(saved.id).toBeDefined();
    expect(saved.data.bpm).toBe(130);
    expect(getSavedSessions()).toHaveLength(1);
  });

  it("newest saved session is first", () => {
    const s = makeSession();
    saveSession("First", s);
    saveSession("Second", s);
    const list = getSavedSessions();
    expect(list[0].name).toBe("Second");
  });

  it("renameSavedSession updates the name", () => {
    const s = makeSession();
    const saved = saveSession("Old Name", s);
    renameSavedSession(saved.id, "New Name");
    expect(getSavedSessions()[0].name).toBe("New Name");
  });

  it("renameSavedSession is a no-op for unknown id", () => {
    const s = makeSession();
    saveSession("Test", s);
    renameSavedSession("nonexistent", "Nope");
    expect(getSavedSessions()[0].name).toBe("Test");
  });

  it("deleteSavedSession removes by id", () => {
    const s = makeSession();
    const saved = saveSession("Delete Me", s);
    saveSession("Keep Me", s);
    deleteSavedSession(saved.id);
    const list = getSavedSessions();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Keep Me");
  });
});
