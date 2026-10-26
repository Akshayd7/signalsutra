// SignalSutra service worker. Network-first for the page so a new version always wins when online;
// cache is only the offline fallback. Cross-origin requests (Binance API) are never touched.
const CACHE = "signalsutra-shell-v9-7-12-p1v3";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/icon.svg"];
self.addEventListener("install", e => {
  // cache:"reload" skips the HTTP cache so the precache is never an old copy
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: "reload" })).then(r => { if (!r.ok) throw new Error(u); return c.put(u, r) })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter(k => k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE), nav = req.mode === "navigate", key = nav ? "index.html" : req;
    try {
      const r = await fetch(req, { cache: "no-cache" }); // always revalidate with the server
      if (r && r.ok) cache.put(key, r.clone());
      return r;
    } catch (_) {
      return (await cache.match(key, { ignoreSearch: nav })) || (nav ? await cache.match("index.html") : null) || Response.error();
    }
  })());
});
