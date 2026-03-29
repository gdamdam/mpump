/**
 * patterns — singleton pattern store. Loads pattern JSONs once at init,
 * caches in memory, and provides lookup by genre + index. Three pools:
 *   s1      — melodic synth patterns (semitone offset + velocity + slide)
 *   t8Drums — drum patterns (per-step hit arrays with note + velocity)
 *   t8Bass  — bass patterns (same format as s1, shared with drums+bass devices)
 */
import type { StepData, DrumHit } from "../types";

export interface PatternStore {
  s1: Record<string, (StepData | null)[][]>;
  t8Drums: Record<string, DrumHit[][][]>;
  t8Bass: Record<string, (StepData | null)[][]>;
}

let store: PatternStore | null = null;

/** Load all pattern JSON files. Called once at init. */
export async function loadPatterns(): Promise<PatternStore> {
  if (store) return store;

  const [s1, t8Drums, t8Bass] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/patterns-s1.json`).then(r => r.json()).catch(e => { console.error("Failed to load patterns:", e); return {}; }),
    fetch(`${import.meta.env.BASE_URL}data/patterns-t8-drums.json`).then(r => r.json()).catch(e => { console.error("Failed to load patterns:", e); return {}; }),
    fetch(`${import.meta.env.BASE_URL}data/patterns-t8-bass.json`).then(r => r.json()).catch(e => { console.error("Failed to load patterns:", e); return {}; }),
  ]);

  store = { s1, t8Drums, t8Bass };
  return store;
}

/** Get the current pattern store (must be loaded first). */
export function getStore(): PatternStore {
  if (!store) throw new Error("Patterns not loaded");
  return store;
}

/** Update the store in-place (used for extras injection). */
export function setStore(s: PatternStore): void {
  store = s;
}

/** Get a melodic pattern by source pool ("s1" or "bass"). */
export function getMelodicPattern(source: "s1" | "bass", genre: string, idx: number): (StepData | null)[] {
  const s = getStore();
  const pool = source === "bass" ? s.t8Bass : s.s1;
  return pool[genre]?.[idx] ?? emptyMelodic();
}

/** Get a drum pattern. */
export function getDrumPattern(genre: string, idx: number): DrumHit[][] {
  const s = getStore();
  return s.t8Drums[genre]?.[idx] ?? emptyDrums();
}

/** Get a bass pattern. */
export function getBassPattern(genre: string, idx: number): (StepData | null)[] {
  const s = getStore();
  return s.t8Bass[genre]?.[idx] ?? emptyMelodic();
}

function emptyMelodic(): (StepData | null)[] {
  return Array.from({ length: 16 }, () => null);
}

function emptyDrums(): DrumHit[][] {
  return Array.from({ length: 16 }, () => []);
}
