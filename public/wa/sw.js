// Relay's service worker (the WhatsApp app). Everything is relative to its own scope, so it works at
// chat.stuparu.eu/wa/ now and at whatsapp.stuparu.eu/ later. Pages and the manifest network-first
// (a deploy reaches the phone at the next open), hashed assets cache-first, the API never cached.
// VERSION is replaced at build time (tools/wa-dist.mjs); a new version drops the old cache.
const VERSION = '__SW_VERSION__';
const CACHE = `relay-${VERSION}`;
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('relay-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;   // the API, /ws, /whoami: never touched
  if (req.mode === 'navigate' || url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('/sw.js')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res.ok && req.mode === 'navigate') (await caches.open(CACHE)).put(SCOPE.pathname, res.clone());
        return res;
      } catch {
        return (await caches.match(req.mode === 'navigate' ? SCOPE.pathname : req)) || Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith(`${SCOPE.pathname}assets/`) || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});

// A notification for Relay (later, when it has its own push): open the person's line.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || SCOPE.pathname, SCOPE.origin).href;
  event.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if (c.url.startsWith(SCOPE.href) && 'navigate' in c) { await c.focus(); return c.navigate(target); }
    }
    return self.clients.openWindow(target);
  })());
});
