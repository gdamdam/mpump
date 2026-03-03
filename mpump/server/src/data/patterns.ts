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
    fetch("/data/patterns-s1.json").then(r => r.json()),
    fetch("/data/patterns-t8-drums.json").then(r => r.json()),
    fetch("/data/patterns-t8-bass.json").then(r => r.json()),
    fetch("/data/patterns-j6.json").then(r => r.json()),
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

/** Get an S-1 melodic pattern. */
export function getPattern(device: string, genre: string, idx: number): (StepData | null)[] {
  const s = getStore();
  if (device === "s1") {
    return s.s1[genre]?.[idx] ?? emptyMelodic();
  }
  return emptyMelodic();
}

/** Get a T-8 drum pattern. */
export function getDrumPattern(genre: string, idx: number): DrumHit[][] {
  const s = getStore();
  return s.t8Drums[genre]?.[idx] ?? emptyDrums();
}

/** Get a T-8 bass pattern. */
export function getBassPattern(genre: string, idx: number): (StepData | null)[] {
  const s = getStore();
  return s.t8Bass[genre]?.[idx] ?? emptyMelodic();
}

/** Get a J-6 chord pattern. */
export function getJ6Pattern(genre: string, idx: number): (StepData | null)[] {
  const s = getStore();
  return s.j6[genre]?.[idx] ?? emptyMelodic();
}

function emptyMelodic(): (StepData | null)[] {
  return Array.from({ length: 16 }, () => null);
}

function emptyDrums(): DrumHit[][] {
  return Array.from({ length: 16 }, () => []);
}
