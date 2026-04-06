// Cache version — bump this on every deploy to invalidate old caches
const CACHE_VERSION = "1.10.2";
const CACHE = `mpump-${CACHE_VERSION}`;

// Pre-cache essential assets on install for offline support
const PRECACHE_URLS = [
  "./",
  "./index.html",
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
