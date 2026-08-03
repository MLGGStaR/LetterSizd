// LetterSizd service worker — app-shell caching so launches are instant and
// the app works offline (data comes from IndexedDB via the page itself).
const CACHE = 'lettersizd-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // dashboard.json (legacy fallback data): network-first
  if (url.pathname.endsWith('/dashboard.json')) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request)),
    );
    return;
  }

  // hashed assets + icons: cache-first (immutable)
  if (
    url.pathname.includes('/assets/') ||
    /\.(png|svg|webmanifest)$/.test(url.pathname)
  ) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((r) => {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return r;
          }),
      ),
    );
    return;
  }

  // navigations / index.html: network-first, cached shell as offline fallback
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      })
      .catch(async () => (await caches.match(e.request)) || (await caches.match('./index.html')) || Response.error()),
  );
});
