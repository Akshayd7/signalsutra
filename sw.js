// SignalSutra service worker: cache-first app shell, network-only for everything cross-origin (Binance API).
const CACHE = "signalsutra-shell-v5-1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/icon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // Binance and other origins: untouched, straight to network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    const net = fetch(req).then(r => { if (r && r.ok) cache.put(req.mode === "navigate" ? "index.html" : req, r.clone()); return r }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; } // cache first, refresh in background
    return (await net) || (await cache.match("index.html")) || Response.error();
  })());
});
