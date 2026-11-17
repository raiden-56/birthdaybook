/* BirthdayBook service worker.
 * - Precaches every file of the static export (list injected at build time by
 *   scripts/postbuild-sw.mjs), so the installed PWA works fully offline.
 * - Network-first for pages (fresh when online), cache-first for hashed assets.
 * - Relays notification action clicks (snooze / mark as wished) to the app.
 */
const VERSION = "27cK0nkCov9DRGA6rnow4";
const CACHE = `birthdaybook-${VERSION}`;
// Base path ("/" at a domain root, "/birthdaybook/" on GitHub Pages) comes from the SW scope.
const BASE = new URL(self.registration.scope).pathname;
const PRECACHE = ["/birthdaybook/404/","/birthdaybook/__next.__PAGE__.txt","/birthdaybook/__next._full.txt","/birthdaybook/__next._tree.txt","/birthdaybook/_next/static/27cK0nkCov9DRGA6rnow4/_buildManifest.js","/birthdaybook/_next/static/27cK0nkCov9DRGA6rnow4/_clientMiddlewareManifest.js","/birthdaybook/_next/static/27cK0nkCov9DRGA6rnow4/_ssgManifest.js","/birthdaybook/_next/static/chunks/006t7jcat-r1g.js","/birthdaybook/_next/static/chunks/080h7jsj96a79.js","/birthdaybook/_next/static/chunks/091olnbb_xvuf.js","/birthdaybook/_next/static/chunks/0b4ud1j3_s50g.js","/birthdaybook/_next/static/chunks/0bkgub008vd67.js","/birthdaybook/_next/static/chunks/0cz1d0mv5g_q7.js","/birthdaybook/_next/static/chunks/0iab0pl-20xxc.js","/birthdaybook/_next/static/chunks/0k6sbpntzzs_m.js","/birthdaybook/_next/static/chunks/0kf6leu0vmy3l.js","/birthdaybook/_next/static/chunks/0sydeed1vtm_a.js","/birthdaybook/_next/static/chunks/0ymt7lko0ivd0.js","/birthdaybook/_next/static/chunks/10p7b2nkxijh3.js","/birthdaybook/_next/static/chunks/15qqevl9i5k36.js","/birthdaybook/_next/static/chunks/1b29h7jxaitp1.js","/birthdaybook/_next/static/chunks/1ildbtdy24_lq.js","/birthdaybook/_next/static/chunks/1ua2kfq9s-me6.js","/birthdaybook/_next/static/chunks/1wnov70f88xjy.js","/birthdaybook/_next/static/chunks/20xilb_c_rd6u.js","/birthdaybook/_next/static/chunks/246jpqydfy4oo.js","/birthdaybook/_next/static/chunks/26v61fbm7qpg1.js","/birthdaybook/_next/static/chunks/29w-12wdlk1-o.js","/birthdaybook/_next/static/chunks/2bij9xbfpxhpq.js","/birthdaybook/_next/static/chunks/2f0e881spf-os.js","/birthdaybook/_next/static/chunks/2g1z-b9xubfk_.css","/birthdaybook/_next/static/chunks/2j43feiu0959k.js","/birthdaybook/_next/static/chunks/2yrwl_t7ug2cn.js","/birthdaybook/_next/static/chunks/310vm2bl3xxpt.js","/birthdaybook/_next/static/chunks/374ohw9kcxx48.js","/birthdaybook/_next/static/chunks/39_j1bdzreq0m.js","/birthdaybook/_next/static/chunks/3_1birpl76bxg.js","/birthdaybook/_next/static/chunks/3czm0-zc4kj52.js","/birthdaybook/_next/static/chunks/3h399we506bx5.js","/birthdaybook/_next/static/chunks/3lcdtzagu0_jn.js","/birthdaybook/_next/static/chunks/3lsi0z-6obx2d.js","/birthdaybook/_next/static/chunks/3n9i_of5pw32y.js","/birthdaybook/_next/static/chunks/3w1p9z0-oa1tn.js","/birthdaybook/_next/static/chunks/3xj6r47-pddq8.js","/birthdaybook/_next/static/chunks/401rw3ie63cl7.js","/birthdaybook/_next/static/chunks/43nin5_c44_31.js","/birthdaybook/_next/static/chunks/turbopack-3y22or8aykx8t.js","/birthdaybook/_next/static/media/07c7676b89ed2778-s.p.2bn3s6zvc0dyp.woff2","/birthdaybook/_next/static/media/1d0bb6ba8433fca1-s.2zyohmvb-ks7f.woff2","/birthdaybook/_next/static/media/2fb76073e23fd9e4-s.3lvt2whj97whp.woff2","/birthdaybook/_next/static/media/45462fd7b7c12654-s.0k62hbripvv8p.woff2","/birthdaybook/_next/static/media/46a9e2f250689b4a-s.0-dom-5bn10r2.woff2","/birthdaybook/_next/static/media/6131cbbf5549afa2-s.2uwcyprjm3xu3.woff2","/birthdaybook/_next/static/media/6e74c70e8d776c42-s.0iqen1t80zg64.woff2","/birthdaybook/_next/static/media/76b70a1dbe058eb5-s.1y4-pdgsjb-pw.woff2","/birthdaybook/_next/static/media/813db4da1994ef51-s.0vmd737txk1h4.woff2","/birthdaybook/_next/static/media/90bfca24981de995-s.0izitdbyxo4j2.woff2","/birthdaybook/_next/static/media/9d036f80216c14ee-s.p.3u4lli0-axodc.woff2","/birthdaybook/_next/static/media/b0e156020fd1d73f-s.3jppgd0xzx-0d.woff2","/birthdaybook/_next/static/media/ba63f6a0e436df8e-s.3-6t-g6q0vh0a.woff2","/birthdaybook/_next/static/media/ece6651c07dc3133-s.0t8ljjjn9wtsx.woff2","/birthdaybook/_next/static/media/f462257512209772-s.p.39pl-v7c3qrze.woff2","/birthdaybook/_not-found/__next._full.txt","/birthdaybook/_not-found/__next._not-found.__PAGE__.txt","/birthdaybook/_not-found/__next._tree.txt","/birthdaybook/_not-found/","/birthdaybook/_not-found/index.txt","/birthdaybook/alarms/__next._full.txt","/birthdaybook/alarms/__next._tree.txt","/birthdaybook/alarms/__next.alarms.__PAGE__.txt","/birthdaybook/alarms/","/birthdaybook/alarms/index.txt","/birthdaybook/calendar/__next._full.txt","/birthdaybook/calendar/__next._tree.txt","/birthdaybook/calendar/__next.calendar.__PAGE__.txt","/birthdaybook/calendar/","/birthdaybook/calendar/index.txt","/birthdaybook/cards/__next._full.txt","/birthdaybook/cards/__next._tree.txt","/birthdaybook/cards/__next.cards.__PAGE__.txt","/birthdaybook/cards/","/birthdaybook/cards/index.txt","/birthdaybook/data/__next._full.txt","/birthdaybook/data/__next._tree.txt","/birthdaybook/data/__next.data.__PAGE__.txt","/birthdaybook/data/","/birthdaybook/data/index.txt","/birthdaybook/gifts/__next._full.txt","/birthdaybook/gifts/__next._tree.txt","/birthdaybook/gifts/__next.gifts.__PAGE__.txt","/birthdaybook/gifts/","/birthdaybook/gifts/index.txt","/birthdaybook/icons/apple-touch-icon.png","/birthdaybook/icons/badge-96.png","/birthdaybook/icons/icon-192.png","/birthdaybook/icons/icon-512.png","/birthdaybook/icons/icon.svg","/birthdaybook/icons/maskable-512.png","/birthdaybook/","/birthdaybook/index.txt","/birthdaybook/manifest.webmanifest","/birthdaybook/messages/__next._full.txt","/birthdaybook/messages/__next._tree.txt","/birthdaybook/messages/__next.messages.__PAGE__.txt","/birthdaybook/messages/","/birthdaybook/messages/index.txt","/birthdaybook/more/__next._full.txt","/birthdaybook/more/__next._tree.txt","/birthdaybook/more/__next.more.__PAGE__.txt","/birthdaybook/more/","/birthdaybook/more/index.txt","/birthdaybook/occasions/__next._full.txt","/birthdaybook/occasions/__next._tree.txt","/birthdaybook/occasions/__next.occasions.__PAGE__.txt","/birthdaybook/occasions/","/birthdaybook/occasions/index.txt","/birthdaybook/people/__next._full.txt","/birthdaybook/people/__next._tree.txt","/birthdaybook/people/__next.people.__PAGE__.txt","/birthdaybook/people/","/birthdaybook/people/index.txt","/birthdaybook/person/__next._full.txt","/birthdaybook/person/__next._tree.txt","/birthdaybook/person/__next.person.__PAGE__.txt","/birthdaybook/person/","/birthdaybook/person/index.txt","/birthdaybook/settings/__next._full.txt","/birthdaybook/settings/__next._tree.txt","/birthdaybook/settings/__next.settings.__PAGE__.txt","/birthdaybook/settings/","/birthdaybook/settings/index.txt","/birthdaybook/stats/__next._full.txt","/birthdaybook/stats/__next._tree.txt","/birthdaybook/stats/__next.stats.__PAGE__.txt","/birthdaybook/stats/","/birthdaybook/stats/index.txt"] || [BASE, `${BASE}manifest.webmanifest`];

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
