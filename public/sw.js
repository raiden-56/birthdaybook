/* BirthdayBook service worker.
 * - Precaches every file of the static export (list injected at build time by
 *   scripts/postbuild-sw.mjs), so the installed PWA works fully offline.
 * - Network-first for pages (fresh when online), cache-first for hashed assets.
 * - Relays notification action clicks (snooze / mark as wished) to the app.
 */
const VERSION = "__BUILD_ID__";
const CACHE = `birthdaybook-${VERSION}`;
// Base path ("/" at a domain root, "/birthdaybook/" on GitHub Pages) comes from the SW scope.
const BASE = new URL(self.registration.scope).pathname;
const PRECACHE = self.__PRECACHE__ || [BASE, `${BASE}manifest.webmanifest`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("birthdaybook-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
          return (await cache.match(path)) || (await cache.match(`${path}index.html`)) || (await cache.match(BASE)) || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: url.pathname.startsWith(`${BASE}_next/`) }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith(`${BASE}_next/`) || url.pathname.startsWith(`${BASE}icons/`) || url.pathname.endsWith(".txt"))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const action = event.action || "tap";
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      let client = all[0];
      if (client) await client.focus();
      else client = await self.clients.openWindow(BASE);
      // Give a freshly opened window a moment to boot before messaging it.
      setTimeout(() => {
        client && client.postMessage({ type: "bb-notification-action", action, extra: data.extra, title: data.title, body: data.body });
      }, all[0] ? 0 : 2500);
    })(),
  );
});
