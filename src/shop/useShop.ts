/**
 * The shopping list, offline first: the last snapshot and the queue of changes live on the phone
 * (localStorage, a few KB), every change applies at once to the local copy and is sent when the
 * server is reachable. The server applies operations idempotently, so a change sent twice (a lost
 * reply in the shop's bad reception) does no harm. After a sync the server's snapshot replaces the
 * local one, with the changes still waiting re-applied on top.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_STORES, applyLocal, newStore, type Op, type Snapshot } from './logic';
import { applyPantry, type PantryOp } from './pantry';
import { applyOwned, type OwnedOp } from './owned';

/** One change on the local copy: list items and the pantry. */
const applyAll = (s: Snapshot, op: Op, person: string): Snapshot => ({
  ...s, items: applyLocal(s.items, op, person),
  stores: op.op === 'shop' && !s.stores.some(x => x.tag === newStore(op.name).tag) ? [...s.stores, newStore(op.name)] : s.stores,
  pantry: op.op.startsWith('pantry-') ? applyPantry(s.pantry ?? [], op as PantryOp, person) : s.pantry,
  owned: op.op.startsWith('owned-') ? applyOwned(s.owned ?? [], op as OwnedOp, person) : s.owned,
  products: op.op === 'favorite' ? (s.products ?? []).map(p => p.id !== op.product ? p : {
    ...p, fav_by: op.on ? [...new Set([...(p.fav_by ?? []), person])] : (p.fav_by ?? []).filter(x => x !== person) }) : s.products,
});

const SNAP_KEY = 'shop:snapshot';
const QUEUE_KEY = 'shop:queue';
const EMPTY: Snapshot = { today: '', stores: DEFAULT_STORES, items: [], known: [] };

export class SignedOut extends Error {}

const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: still works in memory */ } };

async function post<T>(path: string, body: unknown, timeoutMs = 15_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new Error('slow');   // the server took too long
    throw new Error('offline');   // no network, or a Cloudflare Access redirect (opaque)
  }
  if (res.redirected || res.type === 'opaqueredirect' || res.status === 401) throw new SignedOut('signed out');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * The same request with upload progress (XMLHttpRequest reports it, fetch does not), for operations
 * carrying photos; `ctl.abort` cancels it ("cancelled").
 */
function postWithProgress<T>(path: string, body: unknown, onProgress: (sent: number, total: number) => void, ctl: { abort?: () => void }, onSent: () => void, timeoutMs = 120_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', path);
    x.withCredentials = true;
    x.timeout = timeoutMs;
    x.setRequestHeader('Content-Type', 'application/json');
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
    // Everything is up: the server is already acting on it, so there is nothing left to cancel.
    x.upload.onload = () => { ctl.abort = undefined; onSent(); };
    x.onload = () => {
      if (x.status === 401) { reject(new SignedOut('signed out')); return; }
      if (x.status < 200 || x.status >= 300) { reject(new Error(`HTTP ${x.status}`)); return; }
      try { resolve(JSON.parse(x.responseText) as T); } catch { reject(new SignedOut('signed out')); }   // an Access page, not JSON
    };
    x.onerror = () => reject(new Error('offline'));
    x.ontimeout = () => reject(new Error('slow'));
    x.onabort = () => reject(new Error('cancelled'));
    ctl.abort = () => x.abort();
    x.send(JSON.stringify(body));
  });
}

/** Photos going up: how many, how far, the first one as a thumbnail. */
export interface Upload { refs: string[]; thumb: string; sent: number; total: number; done?: boolean }

/** Speech to text through Whisper on the server: the recorded audio in, the text out. */
export async function transcribeShop(audio: { content: string; mimeType: string }): Promise<string> {
  // Whisper on CT 104 takes ~12 s for a sentence and longer for longer speech (21.7 s seen): wait 3 minutes.
  const r = await post<{ text: string }>('/shop/transcribe', { audio: audio.content, mimeType: audio.mimeType }, 180_000);
  return r.text ?? '';
}

export type SyncState = 'idle' | 'syncing' | 'offline' | 'signed-out';

export function useShop(person: string) {
  const [queue, setQueue] = useState<Op[]>(() => read(QUEUE_KEY, [] as Op[]));
  // The stored copy is the server's last state: changes still waiting go on top of it (an app
  // restarted in the shop, offline, still shows what was ticked).
  const [snap, setSnap] = useState<Snapshot>(() => {
    const s = read(SNAP_KEY, EMPTY);
    return read(QUEUE_KEY, [] as Op[]).reduce((acc, op) => applyAll(acc, op, person), s);
  });
  const [sync, setSync] = useState<SyncState>('idle');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const busy = useRef(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const uploadCtl = useRef<{ abort?: () => void }>({});
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => write(QUEUE_KEY, queue), [queue]);

  /** Send what is waiting (or just fetch), then take the server's state. */
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const flush = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setSync('syncing');
    const sending = queueRef.current;
    try {
      const photos = sending.filter((op): op is Extract<Op, { op: 'photo' }> => op.op === 'photo');
      if (photos.length) setUpload({ refs: photos.map(p => p.ref), thumb: photos[0].data, sent: 0, total: 0 });
      const r = photos.length
        ? await postWithProgress<Snapshot & { results: Array<{ error?: string }> }>('/shop/ops', { ops: sending },
          (sent, total) => setUpload(u => (u ? { ...u, sent, total } : u)), (uploadCtl.current = {}), () => setUpload(u => (u ? { ...u, done: true } : u)))
        : sending.length > 0
        ? await post<Snapshot & { results: Array<{ error?: string }> }>('/shop/ops', { ops: sending })
        : await post<Snapshot>('/shop/list', {});
      // Changes made while this was in flight stay queued and are re-applied on the new state.
      const rest = queueRef.current.slice(sending.length);
      const fresh: Snapshot = { today: r.today, stores: r.stores?.length ? r.stores : DEFAULT_STORES, items: r.items, known: r.known ?? [], asks: r.asks ?? [], products: r.products ?? [], purchases: r.purchases ?? [], pantry: r.pantry ?? [], usual: r.usual ?? [], owned: r.owned ?? [] };
      write(SNAP_KEY, fresh);
      setQueue(rest);
      setSnap(rest.reduce((acc, op) => applyAll(acc, op, person), fresh));
      setSync('idle');
      setLastSync(Date.now());
    } catch (e) {
      if (e instanceof Error && e.message === 'cancelled') {
        // Cancelled by the person: the photos and the instruction that carried them are dropped.
        const refs = new Set(sending.filter(op => op.op === 'photo').map(op => (op as { ref: string }).ref));
        const keep = (op: Op) => !(op.op === 'photo' && refs.has(op.ref)) && !(op.op === 'ask' && (op.photos ?? []).some(r => refs.has(r)));
        const rest = queueRef.current.filter(keep);
        setQueue(rest);
        setSnap(rest.reduce((acc, op) => applyAll(acc, op, person), read(SNAP_KEY, EMPTY)));
        setSync('idle');
        if (rest.length) window.setTimeout(() => void flushRef.current?.(), 50);   // ticks queued with them still go now
        return;
      }
      setSync(e instanceof SignedOut ? 'signed-out' : 'offline');
    } finally {
      busy.current = false;
      setUpload(null);
    }
  }, [person]);

  /** Make a change: at once on the phone, to the server as soon as it can. */
  const apply = useCallback((op: Op) => {
    setSnap(s => applyAll(s, op, person));
    setQueue(q => [...q, op]);
    window.setTimeout(() => void flush(), 50);
  }, [person, flush]);

  useEffect(() => {
    void flush();
    const onVisible = () => { if (document.visibilityState === 'visible') void flush(); };
    const onOnline = () => void flush();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void flush(); }, 60_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); window.clearInterval(t); };
  }, [flush]);

  // While the assistant works on an instruction, look again every few seconds.
  const working = (snap.asks ?? []).some(a => a.status === 'working');
  useEffect(() => {
    if (!working || sync === 'offline' || sync === 'signed-out') return;
    const t = window.setTimeout(() => void flush(), 3000);
    return () => window.clearTimeout(t);
  }, [working, snap, sync, flush]);

  useEffect(() => { flushRef.current = flush; }, [flush]);
  const cancelUpload = useCallback(() => uploadCtl.current.abort?.(), []);
  return { snap, queue, sync, lastSync, apply, refresh: flush, upload, cancelUpload };
}
