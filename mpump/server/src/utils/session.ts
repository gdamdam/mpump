/**
 * Full session export/import — saves everything needed to restore a complete mpump session.
 */
import { trackEvent } from "./metrics";
import { getItem, getBool, getJSON, setJSON } from "./storage";

export interface SessionData {
  version: string;
  timestamp: string;
  bpm: number;
  swing: number;
  masterVolume: number;
  channelVolumes: Record<number, number>;
  devices: Record<string, {
    genre_idx: number;
    pattern_idx: number;
    bass_genre_idx: number;
    bass_pattern_idx: number;
    key_idx: number;
    octave: number;
    patternLength: number;
    drumsMuted: boolean;
    bassMuted: boolean;
    pattern_data: unknown[];
    drum_data: unknown[][];
    bass_data: unknown[];
    synthParams: unknown | null;
    bassSynthParams: unknown | null;
  }>;
  // Sound presets
  activeDrumKit: string;
  activeSynth: string;
  activeBass: string;
  // Effects
  effects: Record<string, unknown> | null;
  // Settings
  antiClipMode: string;
  scaleLock: string;
  arpMode: string;
  arpRate: string;
  humanize: boolean;
  sidechainDuck: boolean;
  metronome: boolean;
  // Effect chain order
  effectOrder?: string[];
  // Gesture recording
  gesture?: { t: number; x: number; y: number }[];
  // Theme
  palette: string;
}

/** Collect all session state into a serializable object. */
export function exportSession(
  state: { bpm: number; swing: number; devices: Record<string, unknown> },
  masterVolume: number,
  channelVolumes: Record<number, number>,
  presets: { activeDrumKit: string; activeSynth: string; activeBass: string },
  antiClipMode: string,
): SessionData {
  const devices: SessionData["devices"] = {};
  for (const [id, d] of Object.entries(state.devices)) {
    const dev = d as Record<string, unknown>;
    devices[id] = {
      genre_idx: dev.genre_idx as number,
      pattern_idx: dev.pattern_idx as number,
      bass_genre_idx: dev.bass_genre_idx as number,
      bass_pattern_idx: dev.bass_pattern_idx as number,
      key_idx: dev.key_idx as number,
      octave: dev.octave as number,
      patternLength: dev.patternLength as number,
      drumsMuted: dev.drumsMuted as boolean,
      bassMuted: dev.bassMuted as boolean,
      pattern_data: dev.pattern_data as unknown[],
      drum_data: dev.drum_data as unknown[][],
      bass_data: dev.bass_data as unknown[],
      synthParams: dev.synthParams ?? null,
      bassSynthParams: dev.bassSynthParams ?? null,
    };
  }

  const effects = getJSON<Record<string, unknown> | null>("mpump-effects", null);

  return {
    version: __APP_VERSION__,
    timestamp: new Date().toISOString(),
    bpm: state.bpm,
    swing: state.swing,
    masterVolume,
    channelVolumes,
    devices,
    activeDrumKit: presets.activeDrumKit,
    activeSynth: presets.activeSynth,
    activeBass: presets.activeBass,
    effects,
    antiClipMode,
    effectOrder: getJSON("mpump-effect-order", null) ?? undefined,
    gesture: getJSON<{ t: number; x: number; y: number }[]>("mpump-gesture", []),
    scaleLock: getItem("mpump-scale-lock", "chromatic"),
    arpMode: getItem("mpump-arp-mode", "off"),
    arpRate: getItem("mpump-arp-rate", "1/8"),
    humanize: getBool("mpump-humanize"),
    sidechainDuck: getBool("mpump-sidechain"),
    metronome: getBool("mpump-metronome"),
    palette: getItem("mpump-palette", "forest"),
  };
}

/** Download session as a JSON file with native "Save As" dialog when available. */
export async function downloadSession(session: SessionData, filename?: string): Promise<void> {
  trackEvent("session-export");
  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const date = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const defaultName = filename ?? `mpump-session-${date}.json`;

  // Use File System Access API for native "Save As" dialog (Chrome/Edge)
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: defaultName,
        types: [{ description: "mpump session", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // user cancelled
    }
  }

  // Fallback: standard download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read a session JSON file and return parsed data. */
export function readSessionFile(file: File): Promise<SessionData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.version || !data.devices) throw new Error("Invalid session file");
        resolve(data as SessionData);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ── Recent sessions ─────────────────────────────────────────────────────

const RECENT_KEY = "mpump-last-session";
const RECENT_LIST_KEY = "mpump-recent-sessions";
const MAX_RECENT = 5;

export interface RecentSession {
  label: string;
  timestamp: number;
  data: SessionData;
}

/** Save current session as the last-played session + add to recent list. */
export function saveLastSession(session: SessionData, genreName: string): void {
  const entry: RecentSession = {
    label: genreName,
    timestamp: Date.now(),
    data: session,
  };
  setJSON(RECENT_KEY, entry);

  // Add to recent list (avoid duplicates by label, cap at MAX_RECENT)
  const list = getJSON<RecentSession[]>(RECENT_LIST_KEY, []);
  const filtered = list.filter(r => r.label !== genreName);
  filtered.unshift(entry);
  if (filtered.length > MAX_RECENT) filtered.length = MAX_RECENT;
  setJSON(RECENT_LIST_KEY, filtered);
}

/** Get the last-played session, or null if none saved. */
export function getLastSession(): RecentSession | null {
  return getJSON<RecentSession | null>(RECENT_KEY, null);
}

/** Get list of recent sessions (newest first). */
export function getRecentSessions(): RecentSession[] {
  return getJSON<RecentSession[]>(RECENT_LIST_KEY, []);
}

// ── Saved sessions (persistent, user-managed) ──────────────────────────

const SAVED_KEY = "mpump-saved-sessions";

export interface SavedSession {
  id: string;
  name: string;
  timestamp: number;
  data: SessionData;
}

export function getSavedSessions(): SavedSession[] {
  return getJSON<SavedSession[]>(SAVED_KEY, []);
}

export function saveSession(name: string, data: SessionData): SavedSession {
  const list = getSavedSessions();
  const entry: SavedSession = { id: crypto.randomUUID(), name, timestamp: Date.now(), data };
  list.unshift(entry);
  setJSON(SAVED_KEY, list);
  return entry;
}

export function renameSavedSession(id: string, name: string): void {
  const list = getSavedSessions();
  const item = list.find(s => s.id === id);
  if (item) { item.name = name; setJSON(SAVED_KEY, list); }
}

export function deleteSavedSession(id: string): void {
  setJSON(SAVED_KEY, getSavedSessions().filter(s => s.id !== id));
}
