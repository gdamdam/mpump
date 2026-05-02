/**
 * Jam relay configuration — feature flag + named provider registry.
 *
 * Off by default. Users opt in via Settings → Jam, and can switch between
 * the built-in mpump relay and their own self-hosted WebSocket endpoints.
 */

import { getBool, setBool, getItem, setItem, getJSON, setJSON } from "./storage";

export interface JamProvider {
  id: string;
  name: string;
  url: string;
}

export const DEFAULT_JAM_PROVIDER: JamProvider = {
  id: "default",
  name: "mpump.live (Fly.io)",
  url: "wss://mpump-jam-relay.fly.dev",
};

export function isJamEnabled(): boolean {
  return getBool("mpump-jam-enabled", false);
}

export function setJamEnabled(on: boolean): void {
  setBool("mpump-jam-enabled", on);
}

export function getCustomJamProviders(): JamProvider[] {
  const list = getJSON<JamProvider[]>("mpump-jam-providers", []);
  return Array.isArray(list) ? list.filter(p => p && p.id && p.url && p.name) : [];
}

export function setCustomJamProviders(list: JamProvider[]): void {
  setJSON("mpump-jam-providers", list);
}

export function getAllJamProviders(): JamProvider[] {
  return [DEFAULT_JAM_PROVIDER, ...getCustomJamProviders()];
}

export function getSelectedJamProviderId(): string {
  return getItem("mpump-jam-provider", DEFAULT_JAM_PROVIDER.id);
}

export function setSelectedJamProviderId(id: string): void {
  setItem("mpump-jam-provider", id);
}

/** Resolve the active relay URL. In dev always returns the local relay. */
export function getJamRelayUrl(): string {
  if (import.meta.env.DEV) return `ws://${location.hostname}:4444`;
  const id = getSelectedJamProviderId();
  const provider = getAllJamProviders().find(p => p.id === id);
  return provider?.url || DEFAULT_JAM_PROVIDER.url;
}
