import { getJSON, setJSON } from "../utils/storage";

const STORAGE_KEY = "mpump-extras";

export type ExtrasData = Record<string, { name: string; desc: string; steps: unknown }[]>;

export function loadExtras(): ExtrasData {
  return getJSON<ExtrasData>(STORAGE_KEY, {});
}

/** Persist extras. Returns false if storage is full/unavailable (never throws). */
export function saveExtras(extras: Record<string, unknown>): boolean {
  return setJSON(STORAGE_KEY, extras);
}
