import type { Catalog } from "../types";
import { loadPatterns, setStore, type PatternStore } from "./patterns";

export interface LoadedCatalog {
  catalog: Catalog;
  patterns: PatternStore;
}

/** Load catalog.json, pattern JSONs, and merge extras from localStorage. */
export async function loadCatalog(): Promise<LoadedCatalog> {
  const [catalogData, patterns] = await Promise.all([
    fetch("/data/catalog.json").then(r => r.json()) as Promise<Catalog>,
    loadPatterns(),
  ]);

  // Merge extras from localStorage
  const extras = loadExtras();
  const result = mergeExtras(catalogData, patterns, extras);

  // Update global pattern store
  setStore(result.patterns);

  return result;
}

function loadExtras(): Record<string, { name: string; desc: string; steps: unknown }[]> {
  try {
    const raw = localStorage.getItem("mpump-extras");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

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
    j6: { ...patterns.j6 },
  };

  // S-1 extras
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

  // J-6 extras
  const j6Extras = extras["j6"] ?? [];
  if (j6Extras.length > 0) {
    cat.j6.genres.push({
      name: "extras",
      patterns: j6Extras.map(e => ({ name: e.name, desc: e.desc })),
    });
    pats.j6["extras"] = j6Extras.map(e => e.steps) as PatternStore["j6"][""];
  }

  return { catalog: cat, patterns: pats };
}
