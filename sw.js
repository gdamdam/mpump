// Cache version — bump this on every deploy to invalidate old caches
const CACHE_VERSION = "1.15.8";
const CACHE = `mpump-${CACHE_VERSION}`;

// Pre-cache the assets needed to produce sound + patterns offline. The hashed
// JS bundle is cached network-first on first load; these static assets (audio
// worklets + pattern data) are NOT hashed and would otherwise be missing on a
// cold offline load, leaving the app silent with no patterns.
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./worklets/poly-synth.js",
  "./worklets/bitcrusher.js",
  "./worklets/diode-filter.js",
  "./worklets/fm-osc.js",
  "./worklets/moog-filter.js",
  "./worklets/sync-osc.js",
  "./worklets/wavetable-osc.js",
  "./data/catalog.json",
  "./data/featured.json",
  "./data/patterns-s1.json",
  "./data/patterns-t8-bass.json",
  "./data/patterns-t8-drums.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Delete ALL old caches (any name that doesn't match current)
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first: always try fresh, fall back to cache for offline
self.addEventListener("fetch", (e) => {
  // Never cache sw.js or version.json (need fresh for update detection)
  if (e.request.url.includes("sw.js") || e.request.url.includes("version.json")) {
    e.respondWith(fetch(e.request).catch(() => new Response("", { status: 503 })));
    return;
  }

  // Navigation requests: bust HTTP cache to get fresh HTML/JS
  const isNav = e.request.mode === "navigate";
  const fetchOpts = isNav ? { cache: "no-cache" } : undefined;

  e.respondWith(
    fetch(e.request, fetchOpts)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
