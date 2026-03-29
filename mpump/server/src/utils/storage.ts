/**
 * Safe localStorage wrapper with try-catch and fallback defaults.
 * Prevents crashes in private browsing or when quota is exceeded.
 */

export function getItem(key: string, fallback = ""): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or private browsing — silently fail
  }
}

export function getBool(key: string, fallback = false): boolean {
  return getItem(key, fallback ? "1" : "0") === "1";
}

export function setBool(key: string, value: boolean): void {
  setItem(key, value ? "1" : "0");
}

export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded
  }
}
