/**
 * Push notifications for the messenger (openclaw-pwa fork).
 *
 * The phone subscribes through the browser's Push API; the subscription is stored by oc-push on
 * the same origin (/push/*, proxied by Caddy). Agents, digests and health alerts then reach the
 * phone even when the app is closed. The service worker (public/sw.js) shows them.
 */

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

function supported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const sub = await (await registration()).pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Ask permission (must be called from a tap), subscribe, and register with oc-push. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const res = await fetch('/push/public-key', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not reach the notification service (${res.status})`);
  const { key } = (await res.json()) as { key: string };
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource });
  const saved = await fetch('/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!saved.ok) throw new Error(`Could not register this phone (${saved.status})`);
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) {
    await fetch('/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return 'off';
}
