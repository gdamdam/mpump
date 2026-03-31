// Cache version — bump this on every deploy to invalidate old caches
const CACHE_VERSION = "3.10.3";
const CACHE = `mpump-${CACHE_VERSION}`;

self.addEventListener("install", () => {
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
  // Never cache sw.js or version.json
  if (e.request.url.includes("sw.js") || e.request.url.includes("version.json")) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request)
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
