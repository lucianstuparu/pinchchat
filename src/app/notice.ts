/**
 * The notification that was tapped, so the app can show what it was about (2026-10-22: a health
 * alert opened the app with nothing related on screen). The service worker keeps it in Cache
 * Storage and either messages an open window or opens the app on ?notice=1.
 */
import { useEffect, useState } from 'react';

export interface Notice { title: string; body?: string; item?: string; ts: number }

const KEY = '/notice-inbox/latest';
const CACHE = 'pinchchat-share-inbox';

async function takeStored(): Promise<Notice | null> {
  try {
    const cache = await caches.open(CACHE);
    const res = await cache.match(KEY);
    if (!res) return null;
    await cache.delete(KEY);
    return await res.json() as Notice;
  } catch {
    return null;
  }
}

/** The last tapped notification, until dismissed. */
export function useNotice(): [Notice | null, () => void] {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('notice')) {
      url.searchParams.delete('notice');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      void takeStored().then(n => { if (n) setNotice(n); });
    }
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'notice' && e.data.notice) { setNotice(e.data.notice as Notice); void takeStored(); }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);
  return [notice, () => setNotice(null)];
}
