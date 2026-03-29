/**
 * catalog — loads catalog.json (genre/pattern metadata) and pattern JSONs,
 * then merges user-saved "extras" patterns from localStorage into the genre
 * list. Extras appear as a virtual "extras" genre appended to each pattern pool.
 */
import type { Catalog, DeviceMode, GenreInfo } from "../types";
import { loadPatterns, setStore, type PatternStore } from "./patterns";
import { getJSON } from "../utils/storage";

export interface LoadedCatalog {
  catalog: Catalog;
  patterns: PatternStore;
}

/** Load catalog.json, pattern JSONs, and merge extras from localStorage. */
export async function loadCatalog(): Promise<LoadedCatalog> {
  const [catalogData, patterns] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/catalog.json`).then(r => r.json()).catch(e => { console.error("Failed to load patterns:", e); return { s1: { genres: [] }, t8: { drum_genres: [], bass_genres: [] } }; }) as Promise<Catalog>,
    loadPatterns(),
  ]);

  // Merge extras from localStorage
  const extras = loadExtras();
  const result = mergeExtras(catalogData, patterns, extras);

  // Update global pattern store
  setStore(result.patterns);

  return result;
}

// ── Device-to-catalog helpers ────────────────────────────────────────────

/** Get the main genre list for a device (melodic genres for synths, drum genres for drums). */
export function getDeviceGenres(catalog: Catalog, deviceId: string, mode: DeviceMode): GenreInfo[] {
  if (mode === "synth") {
    return catalog.s1.genres;
  }
  if (mode === "bass") {
    return catalog.t8.bass_genres;
  }
  // drums or drums+bass → drum genres
  return catalog.t8.drum_genres;
}

/** Get the bass genre list (for drums+bass or standalone bass devices). */
export function getDeviceBassGenres(catalog: Catalog): GenreInfo[] {
  return catalog.t8.bass_genres;
}

/** Get the extras storage key for a device's main patterns. */
export function getExtrasKey(deviceId: string, mode: DeviceMode): string {
  if (mode === "synth") return "s1";
  if (mode === "bass") return "t8_bass";
  return "t8_drums";
}

/** Get the extras storage key for a device's bass patterns (drums+bass only). */
export function getBassExtrasKey(mode: DeviceMode): string | undefined {
  return mode === "drums+bass" ? "t8_bass" : undefined;
}

/** Get the melodic pattern source pool for a device. */
export function getMelodicSource(deviceId: string): "s1" | "bass" {
  if (deviceId === "preview_bass") return "bass";
  return "s1";
}

// ── Extras loading ───────────────────────────────────────────────────────

function loadExtras(): Record<string, { name: string; desc: string; steps: unknown }[]> {
  return getJSON("mpump-extras", {} as Record<string, { name: string; desc: string; steps: unknown }[]>);
}

/**
 * Merge user-saved extras into catalog and pattern store.
 * Each extras category (s1, t8_drums, t8_bass) becomes a virtual "extras"
 * genre appended to the corresponding genre list, with pattern data injected
 * into the pattern store under the "extras" key.
 */
function mergeExtras(
  catalog: Catalog,
  patterns: PatternStore,
  extras: Record<string, { name: string; desc: string; steps: unknown }[]>,
): LoadedCatalog {
  // Deep clone to avoid mutating originals
  const cat = JSON.parse(JSON.stringify(catalog)) as Catalog;
  const pats: PatternStore = {
    s1: { ...patterns.s1 },
    t8Drums: { ...patterns.t8Drums },
    t8Bass: { ...patterns.t8Bass },
  };

  // S-1 extras — melodic synth patterns saved by the user
  const s1Extras = extras["s1"] ?? [];
  if (s1Extras.length > 0) {
    cat.s1.genres.push({
      name: "extras",
      patterns: s1Extras.map(e => ({ name: e.name, desc: e.desc })),
    });
    pats.s1["extras"] = s1Extras.map(e => e.steps) as PatternStore["s1"][""];
  }

  // T-8 drum extras
  const t8DrumExtras = extras["t8_drums"] ?? [];
  if (t8DrumExtras.length > 0) {
    cat.t8.drum_genres.push({
      name: "extras",
      patterns: t8DrumExtras.map(e => ({ name: e.name, desc: e.desc })),
    });
    pats.t8Drums["extras"] = t8DrumExtras.map(e => e.steps) as PatternStore["t8Drums"][""];
  }

  // T-8 bass extras
  const t8BassExtras = extras["t8_bass"] ?? [];
  if (t8BassExtras.length > 0) {
    cat.t8.bass_genres.push({
      name: "extras",
      patterns: t8BassExtras.map(e => ({ name: e.name, desc: e.desc })),
    });
    pats.t8Bass["extras"] = t8BassExtras.map(e => e.steps) as PatternStore["t8Bass"][""];
  }

  return { catalog: cat, patterns: pats };
}
