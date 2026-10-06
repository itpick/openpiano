/* OpenPiano service worker — the proven simpli-piano pattern:
 * - precache the app shell (CACHE name bumped with version.js on release)
 * - fetch: network-first for navigations/JS (fresh code), cache fallback for offline
 * - update flow lives in app.js (unregister → clear caches → reload)
 */
const VERSION = "openpiano-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./app/data.js",
  "./app/mic.js",
  "./app/render.js",
  "./app/midi.js",
  "./app/sampler.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(resp => {
      // refresh cache opportunistically
      const copy = resp.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy)).catch(()=>{});
      return resp;
    }).catch(() =>
      caches.match(e.request).then(r => r || caches.match("./index.html"))
    )
  );
});
