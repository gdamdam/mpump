/**
 * Share relay client — health check, URL shortener, remix lineage.
 * Relay: s.mpump.live (Cloudflare Worker + KV)
 */

const RELAY = import.meta.env.DEV ? "http://localhost:8787" : "https://s.mpump.live";

let healthCache: boolean | null = null;
let healthCheckedAt = 0;
const HEALTH_TTL = 60_000; // re-check every 60s

/** Check if the share relay is reachable. Caches result for 60s. */
export async function checkRelayHealth(): Promise<boolean> {
  const now = Date.now();
  if (healthCache !== null && now - healthCheckedAt < HEALTH_TTL) return healthCache;
  try {
    const r = await fetch(`${RELAY}/health`, { signal: AbortSignal.timeout(3000) });
    healthCache = r.ok;
  } catch {
    healthCache = false;
  }
  healthCheckedAt = now;
  return healthCache;
}

/** Create a short URL for a beat. Returns null if relay is down. */
export async function shortenBeat(
  url: string,
  parent?: string | null,
): Promise<{ id: string; short: string } | null> {
  try {
    const body: Record<string, string> = { url };
    if (parent) body.parent = parent;
    const r = await fetch(`${RELAY}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

/** Fire-and-forget share tracking. Call when user copies link or uses native share. */
export function trackShare(id: string): void {
  fetch(`${RELAY}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
}

/** Extract parent ID from current URL params. */
export function getParentId(): string | null {
  return new URLSearchParams(window.location.search).get("p");
}

/** Build the full short URL from an ID. */
export function shortUrl(id: string): string {
  return `${RELAY}/${id}`;
}

/** Submit a beat for Discover review. Returns null on network failure. */
export async function submitBeat(payload: {
  id: string;
  shortUrl: string;
  title: string;
  genre: string;
  note?: string;
  contact?: string;
  parentId?: string | null;
}): Promise<{ ok: boolean; duplicate?: boolean } | null> {
  try {
    const r = await fetch(`${RELAY}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}
