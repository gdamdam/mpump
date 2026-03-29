const STORAGE_KEY = "mpump-extras";

export type ExtrasData = Record<string, { name: string; desc: string; steps: unknown }[]>;

export function loadExtras(): ExtrasData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveExtras(extras: Record<string, unknown>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(extras));
}
