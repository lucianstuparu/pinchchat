// Relay's service worker (the WhatsApp app). Everything is relative to its own scope, so it works at
// msg.stuparu.eu/ (and at any base path). Pages and the manifest network-first
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

// ---- Relay's notifications (oc-push, app "relay"): a message a mail rule prepared, waiting in Drafts.
// Payload {title, body, url, tag, actions?, data?: {draft}}. Tapping the notification opens that person's
// line with the message on the card. The Send button sends from here, after the app's 5 s with Undo
// (Lucian 2026-10-27: "the tap variant"); Later only closes it (the draft stays in Drafts).
const SEND_DELAY = 5000;
const pending = new Map();   // draft id -> {cancelled}, while its 5 s run (the worker stays alive meanwhile)
const ICON = new URL('logo-192.png', SCOPE).href;
const BADGE = new URL('favicon-32.png', SCOPE).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const show = (title, opts) => self.registration.showNotification(title, { icon: ICON, badge: BADGE, ...opts });

self.addEventListener('push', (event) => {
  let m = {};
  try { m = event.data ? event.data.json() : {}; } catch { m = { body: event.data && event.data.text() }; }
  const draft = m.data && typeof m.data.draft === 'string' ? m.data.draft : undefined;
  event.waitUntil(show(m.title || 'Relay', {
    body: m.body || '', tag: m.tag || undefined, renotify: !!m.tag,
    actions: draft && Array.isArray(m.actions) ? m.actions.slice(0, 2) : undefined,
    data: { url: typeof m.url === 'string' && m.url.startsWith('/') ? m.url : SCOPE.pathname, draft, title: m.title || 'Relay', body: m.body || '' },
  }));
});

async function sendFromNotification(n) {
  const { draft, url, body } = n.data;
  const p = { cancelled: false };
  pending.set(draft, p);
  await show(`Sending in ${SEND_DELAY / 1000} s…`, { body, tag: n.tag || draft, silent: true, actions: [{ action: 'undo', title: 'Undo' }], data: { ...n.data } });
  await sleep(SEND_DELAY);
  pending.delete(draft);
  if (p.cancelled) return;
  try {
    const res = await fetch(new URL('/reg/wa/act', SCOPE.origin).href, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft, action: 'send' }),
    });
    const r = await res.json();
    if (!res.ok || r.status !== 'sent') throw new Error(r.error || `HTTP ${res.status}`);
    await show(`Sent to ${r.name}`, { body: r.text, tag: n.tag || draft, silent: true, data: { url } });
  } catch (e) {
    // Signed out (Access), offline or refused: the draft stays; tapping opens it in Relay.
    await show('Not sent', { body: `${String(e.message || e).slice(0, 80)} · tap to open it in Relay`, tag: n.tag || draft, data: { url } });
  }
}

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  n.close();
  const draft = n.data && n.data.draft;
  if (event.action === 'send' && draft) { event.waitUntil(sendFromNotification(n)); return; }
  if (event.action === 'undo' && draft) {
    const p = pending.get(draft);
    if (p) p.cancelled = true;
    event.waitUntil(show('Not sent', { body: 'It waits in Relay’s Drafts.', tag: n.tag || draft, silent: true, data: { url: n.data.url } }));
    return;
  }
  if (event.action === 'later') return;   // it stays in Drafts
  const target = new URL(n.data?.url || SCOPE.pathname, SCOPE.origin).href;
  event.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if (c.url.startsWith(SCOPE.href) && 'navigate' in c) { await c.focus(); return c.navigate(target); }
    }
    return self.clients.openWindow(target);
  })());
});
