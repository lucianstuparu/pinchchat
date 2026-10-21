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
// Store it in Cache Storage and redirect to /?share=<id>; the app
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
      return Response.redirect(`/?share=${id}`, 303);
    } catch (err) {
      return Response.redirect('/?share=failed', 303);
    }
  })());
});

// ---------------------------------------------------------------------------
// Push notifications (openclaw-pwa fork addition — see MOBILE.md)
//
// Sent by oc-push on CT 105 (agents, reminders, health alerts). Payload JSON:
// { title, body, url, tag, actions?, data? }. Tapping opens the app on `url`, reusing an open
// window when there is one. Reminders (ai.manager) carry actions Done / Snooze and data.item:
// a button posts /reg/act on this origin (register-api on CT 103 via Caddy) without opening the app.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'OpenClaw';
  const item = data.data && typeof data.data.item === 'string' ? data.data.item : undefined;
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/logo-192.png',
    badge: '/favicon-32.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    actions: item && Array.isArray(data.actions) ? data.actions.slice(0, 2) : undefined,
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/', item },
  }));
});

// A reminder button: change the register item, then confirm (or, if that failed, open the app).
async function reminderAction(notification, action) {
  const { item, url } = notification.data || {};
  try {
    const res = await fetch('/reg/act', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, action }),
    });
    const r = await res.json();
    if (!res.ok || !r.ok) throw new Error(r.error || String(res.status));
    await self.registration.showNotification(action === 'done' ? `✓ Done: ${r.title}` : `Snoozed: ${r.title}`, {
      body: action === 'done' ? `Marked ${r.status}.` : `Reminding you again on ${r.remind_on}.`,
      icon: '/logo-192.png', badge: '/favicon-32.png', tag: notification.tag || undefined, silent: true,
      data: { url },
    });
  } catch {
    await self.clients.openWindow(new URL(url || '/', self.location.origin).href);
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action && event.notification.data && event.notification.data.item) {
    event.waitUntil(reminderAction(event.notification, event.action));
    return;
  }
  const target = new URL(event.notification.data && event.notification.data.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of windows) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        if (w.url !== target && 'navigate' in w) await w.navigate(target).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
