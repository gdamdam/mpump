import type { StepData, DrumHit } from "../types";

export interface PatternStore {
  s1: Record<string, (StepData | null)[][]>;
  t8Drums: Record<string, DrumHit[][][]>;
  t8Bass: Record<string, (StepData | null)[][]>;
  j6: Record<string, (StepData | null)[][]>;
}

let store: PatternStore | null = null;

/** Load all pattern JSON files. Called once at init. */
export async function loadPatterns(): Promise<PatternStore> {
  if (store) return store;

  const [s1, t8Drums, t8Bass, j6] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/patterns-s1.json`).then(r => r.json()),
    fetch(`${import.meta.env.BASE_URL}data/patterns-t8-drums.json`).then(r => r.json()),
    fetch(`${import.meta.env.BASE_URL}data/patterns-t8-bass.json`).then(r => r.json()),
    fetch(`${import.meta.env.BASE_URL}data/patterns-j6.json`).then(r => r.json()),
  ]);

  store = { s1, t8Drums, t8Bass, j6 };
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

/** Get a melodic pattern by source pool ("s1" or "j6"). */
export function getMelodicPattern(source: "s1" | "j6", genre: string, idx: number): (StepData | null)[] {
  const s = getStore();
  const pool = source === "j6" ? s.j6 : s.s1;
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
