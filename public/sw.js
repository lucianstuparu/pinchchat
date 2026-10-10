// PinchChat Service Worker — cache static assets for offline/instant load
// App files: one cache per build. scripts/stamp-sw.mjs replaces the
// placeholder after `vite build` with a hash of the built index.html, so each
// deploy gets a fresh cache and old ones are deleted on activate.
const CACHE_NAME = 'pinchchat-__BUILD_VERSION__';
// Pending Share Sheet payloads live in their own, stable cache so a deploy
// never deletes a share that has not been opened yet.
const SHARE_CACHE = 'pinchchat-share-inbox';

// Cache static assets on install
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Clean old caches on activate. Older builds kept pending shares inside the
// app cache: move any /share-inbox/ entries to SHARE_CACHE before deleting.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const shares = await caches.open(SHARE_CACHE);
    for (const name of await caches.keys()) {
      if (name === CACHE_NAME || name === SHARE_CACHE) continue;
      const old = await caches.open(name);
      for (const req of await old.keys()) {
        if (new URL(req.url).pathname.startsWith('/share-inbox/')) {
          const res = await old.match(req);
          if (res) await shares.put(req, res);
        }
      }
      await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// Stale-while-revalidate for static assets, network-first for API/WS
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, WebSocket upgrades, and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Don't cache API calls or WebSocket-related requests
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return;

  // For navigation requests (HTML), always go network-first to get latest SPA shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts): stale-while-revalidate
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|woff2?|ttf|ico|json)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }
});

// ---------------------------------------------------------------------------
// Share target (openclaw-pwa fork addition — see MOBILE.md)
//
// Android's Share Sheet POSTs multipart data to /share (manifest share_target).
// Store it in Cache Storage and redirect to /?ui=mobile&share=<id>; the app
// (src/share/shareInbox.ts, which searches every cache) prefills the composer
// from it. Stored in SHARE_CACHE, which the activate handler never deletes.
// Handled entirely here, so it works offline and before any login.
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share') return;

  event.respondWith((async () => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try {
      const form = await event.request.formData();
      const cache = await caches.open(SHARE_CACHE);
      const files = form.getAll('files').filter((f) => f && typeof f === 'object' && 'size' in f);
      const meta = {
        id,
        title: String(form.get('title') || ''),
        text: String(form.get('text') || ''),
        url: String(form.get('url') || ''),
        files: [],
        receivedAt: Date.now(),
      };
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const key = `/share-inbox/${id}/${i}`;
        await cache.put(key, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream' } }));
        meta.files.push({ key, name: f.name || `shared-${i + 1}`, type: f.type || 'application/octet-stream', size: f.size });
      }
      await cache.put(`/share-inbox/${id}/meta.json`, new Response(JSON.stringify(meta), {
        headers: { 'content-type': 'application/json' },
      }));
      return Response.redirect(`/?ui=mobile&share=${id}`, 303);
    } catch (err) {
      return Response.redirect('/?ui=mobile&share=failed', 303);
    }
  })());
});
