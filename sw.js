// SignalSutra service worker. Network-first for the page so a new version always wins when online;
// cache is only the offline fallback. Cross-origin requests (Binance API) are never touched.
const CACHE = "signalsutra-shell-r1-explain-premium-v1";
const SHELL = ["./", "index.html", "privacy.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/icon.svg"];
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
      return (await cache.match(key, { ignoreSearch: nav })) || (nav ? await cache.match("index.html") : null) || (nav ? offlinePage() : Response.error());
    }
  })());
});
// Last-resort offline page when nothing is cached yet (first visit without a connection).
function offlinePage() {
  return new Response('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · SignalSutra Guide</title></head><body style="margin:0;background:#0a0e16;color:#e9edf4;font:16px/1.6 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px"><main><h1 style="font-size:20px">You are offline</h1><p style="color:#a7b1c3">SignalSutra Guide needs a connection to load market data. Reconnect and reopen the app.</p></main></body></html>', { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
}
