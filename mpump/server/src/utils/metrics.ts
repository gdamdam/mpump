/**
 * Privacy-preserving event tracking via GoatCounter.
 * Fires anonymous counter increments — no cookies, no user IDs, no PII.
 */
const noCount = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cnt") === "0";

export function trackEvent(name: string) {
  if (noCount) return;
  try {
    const gc = (window as unknown as { goatcounter?: { count: (opts: { path: string; event: boolean }) => void } }).goatcounter;
    if (gc?.count) gc.count({ path: `event/${name}`, event: true });
  } catch { /* silent */ }
}
