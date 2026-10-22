/**
 * The shopping list, offline first: the last snapshot and the queue of changes live on the phone
 * (localStorage, a few KB), every change applies at once to the local copy and is sent when the
 * server is reachable. The server applies operations idempotently, so a change sent twice (a lost
 * reply in the shop's bad reception) does no harm. After a sync the server's snapshot replaces the
 * local one, with the changes still waiting re-applied on top.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_STORES, applyLocal, type Op, type Snapshot } from './logic';
import { applyPantry, type PantryOp } from './pantry';

/** One change on the local copy: list items and the pantry. */
const applyAll = (s: Snapshot, op: Op, person: string): Snapshot => ({
  ...s, items: applyLocal(s.items, op, person),
  pantry: op.op.startsWith('pantry-') ? applyPantry(s.pantry ?? [], op as PantryOp, person) : s.pantry,
  products: op.op === 'favorite' ? (s.products ?? []).map(p => p.id !== op.product ? p : {
    ...p, fav_by: op.on ? [...new Set([...(p.fav_by ?? []), person])] : (p.fav_by ?? []).filter(x => x !== person) }) : s.products,
});

const SNAP_KEY = 'shop:snapshot';
const QUEUE_KEY = 'shop:queue';
const EMPTY: Snapshot = { today: '', stores: DEFAULT_STORES, items: [], known: [] };

export class SignedOut extends Error {}

const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: still works in memory */ } };

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error('offline');   // no network, or a Cloudflare Access redirect (opaque)
  }
  if (res.redirected || res.type === 'opaqueredirect' || res.status === 401) throw new SignedOut('signed out');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Speech to text through Whisper on the server: the recorded audio in, the text out. */
export async function transcribeShop(audio: { content: string; mimeType: string }): Promise<string> {
  const r = await post<{ text: string }>('/shop/transcribe', { audio: audio.content, mimeType: audio.mimeType });
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
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => write(QUEUE_KEY, queue), [queue]);

  /** Send what is waiting (or just fetch), then take the server's state. */
  const flush = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setSync('syncing');
    const sending = queueRef.current;
    try {
      const r = sending.length > 0
        ? await post<Snapshot & { results: Array<{ error?: string }> }>('/shop/ops', { ops: sending })
        : await post<Snapshot>('/shop/list', {});
      // Changes made while this was in flight stay queued and are re-applied on the new state.
      const rest = queueRef.current.slice(sending.length);
      const fresh: Snapshot = { today: r.today, stores: r.stores?.length ? r.stores : DEFAULT_STORES, items: r.items, known: r.known ?? [], asks: r.asks ?? [], products: r.products ?? [], purchases: r.purchases ?? [], pantry: r.pantry ?? [] };
      write(SNAP_KEY, fresh);
      setQueue(rest);
      setSnap(rest.reduce((acc, op) => applyAll(acc, op, person), fresh));
      setSync('idle');
      setLastSync(Date.now());
    } catch (e) {
      setSync(e instanceof SignedOut ? 'signed-out' : 'offline');
    } finally {
      busy.current = false;
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

  return { snap, queue, sync, lastSync, apply, refresh: flush };
}
