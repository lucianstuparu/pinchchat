/**
 * Reads content handed to the PWA by Android's Share Sheet.
 *
 * Flow: the OS POSTs multipart data to /share (manifest share_target). The
 * service worker (public/sw.js, "Share target" block) stores it in Cache
 * Storage under /share-inbox/<id>/… and redirects to /?share=<id>. This module
 * picks that entry up, converts it for the composer and deletes it.
 *
 * Nothing is sent automatically — the payload only prefills the composer.
 */
import { encodeAttachment, type OutgoingAttachment } from '../mobile/attachments';

interface StoredShareMeta {
  id: string;
  title: string;
  text: string;
  url: string;
  files: Array<{ key: string; name: string; type: string; size: number }>;
  receivedAt: number;
}

export interface SharedContent {
  /** Prefill text for the composer (title / text / url, de-duplicated) */
  text: string;
  attachments: OutgoingAttachment[];
  /** Files that could not be attached (e.g. over the size limit) */
  rejected: string[];
}

/** Returns the share id from the current URL, if this load came from a share. */
export function pendingShareId(): string | null {
  const id = new URLSearchParams(window.location.search).get('share');
  return id && /^[a-z0-9]+$/i.test(id) ? id : null;
}

/** Remove ?share=… from the address bar so a reload does not re-import. */
export function clearShareParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete('share');
  window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
}

/** Combine the share fields into one composer line set, without repeating the URL. */
export function composeShareText(title: string, text: string, url: string): string {
  const parts: string[] = [];
  const t = title.trim();
  const body = text.trim();
  const link = url.trim();
  if (t && !body.includes(t)) parts.push(t);
  if (body) parts.push(body);
  if (link && !body.includes(link)) parts.push(link);
  return parts.join('\n');
}

export async function takeSharedContent(id: string): Promise<SharedContent | null> {
  if (!('caches' in window)) return null;
  const metaKey = `/share-inbox/${id}/meta.json`;
  const metaRes = await caches.match(metaKey);
  if (!metaRes) return null;
  const meta = (await metaRes.json()) as StoredShareMeta;

  const attachments: OutgoingAttachment[] = [];
  const rejected: string[] = [];
  for (const f of meta.files) {
    const res = await caches.match(f.key);
    if (!res) continue;
    try {
      attachments.push(await encodeAttachment(await res.blob(), f.name));
    } catch {
      rejected.push(f.name);
    }
  }

  // Delete the inbox entry from whichever cache holds it
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    await cache.delete(metaKey);
    for (const f of meta.files) await cache.delete(f.key);
  }

  return { text: composeShareText(meta.title, meta.text, meta.url), attachments, rejected };
}
