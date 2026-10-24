import type { PantryEntry, PantryOp } from './pantry';

/**
 * The shopping list's logic, shared by the app and its tests: the same rules as the server's
 * shop.mjs (tags, which items show at which shop, how an operation changes an item), so the app
 * can apply a change at once, offline, and replay it later.
 */
export interface Store { tag: string; name: string; also: string[] }
export interface Item {
  id: string; kind: 'buy' | 'return'; title: string; tags: string[]; qty?: string; notes?: string; due_date?: string; link?: string;
  status: 'open' | 'bought' | 'returned' | 'cancelled'; scope: 'shared' | 'private';
  added_by?: string; created?: string; updated?: string; bought_on?: string; bought_by?: string; bought_at?: string;
  /** The catalogue product this item is (prd-…). */
  product?: string;
  /** Days it usually keeps (from the server): ticking it offers to put it in the pantry. */
  shelf?: number;
}
export interface Known { title: string; tags: string[]; n: number }
/** An instruction for the assistant, typed or said in the app, and its answer. */
export interface Ask { id: string; text: string; photos?: string[]; store?: string; status: 'queued' | 'working' | 'done' | 'failed'; reply?: string; ts: string }
export interface Nutrition { kcal?: number; protein?: number; fat?: number; sat_fat?: number; carbs?: number; sugar?: number; fiber?: number; salt?: number }
export interface Product {
  id: string; name: string; brand?: string; size?: string; barcode?: string; photos: string[]; ingredients?: string;
  nutrition?: Nutrition; health?: { nova?: number; flags?: string[]; note?: string; date?: string }; tags?: string[]; aliases?: string[];
  added_by?: string; created?: string; updated?: string;
  /** People who like it (to buy again some time). */
  fav_by?: string[];
  stats?: { times: number; last_date: string; last_store?: string; last_price?: number; currency?: string };
}
export interface Purchase { id: string; title: string; product?: string; qty?: string; price?: number; currency?: string; store?: string; date: string; by?: string; source?: string; receipt?: string }
/** "Usually about now" (Phase E): bought regularly and due again, or a favourite not bought for a month. */
export interface Usual { key: string; title: string; product?: string; tags: string[]; every: number | null; last: string | null; since: number | null; reason: 'usual' | 'favourite' }

export interface Snapshot { today: string; stores: Store[]; items: Item[]; known: Known[]; asks?: Ask[]; products?: Product[]; purchases?: Purchase[]; pantry?: PantryEntry[]; usual?: Usual[] }

export type Op =
  | { op: 'add'; id: string; title: string; tags?: string[]; qty?: string; notes?: string; scope?: 'shared' | 'private'; kind?: 'buy' | 'return'; due_date?: string; link?: string; product?: string }
  | { op: 'ask'; id: string; text: string; store?: string; photos?: string[] }
  | { op: 'photo'; ref: string; data: string }
  | { op: 'favorite'; product: string; on: boolean }
  | PantryOp
  | { op: 'tick'; id: string; store?: string }
  | { op: 'untick'; id: string }
  | { op: 'drop'; id: string }
  | { op: 'edit'; id: string; title?: string; tags?: string[]; qty?: string; notes?: string; due_date?: string; kind?: 'buy' | 'return' }
  | { op: 'scope'; id: string; scope: 'shared' | 'private' }
  | { op: 'shop'; name: string; also?: string[] };

/** The shops everyone starts with, used before the first sync (the server adds the shops added since). */
export const DEFAULT_STORES: Store[] = [
  { tag: 'carrefour', name: 'Carrefour', also: ['carrefour-market'] },
  { tag: 'carrefour-market', name: 'Carrefour Market', also: ['carrefour'] },
  { tag: 'lidl', name: 'Lidl', also: [] },
  { tag: 'grand-frais', name: 'Grand Frais', also: [] },
  { tag: 'leclerc', name: 'Leclerc', also: [] },
  { tag: 'migros', name: 'Migros', also: [] },
  { tag: 'paniere', name: 'La Panière', also: [] },
  { tag: 'pharmacy', name: 'Pharmacy', also: [] },
];

export function tagOf(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/^@/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
}

/** Labels that are never a shop (same list as the server). */
export const NOT_SHOPS = new Set(['wishlist', 'bio', 'urgent', 'online', 'anywhere']);
export const isWish = (i: Pick<Item, 'tags'>) => (i.tags || []).includes('wishlist');

/** A shop from a typed name, made like the server makes it: the name keeps its spelling, the tag comes from it. */
export function newStore(name: string): Store {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, 40);
  return { tag: tagOf(n), name: n, also: [] };
}

/**
 * The shop search: with nothing typed, shops with something on the list first (most first), then
 * the ones bought at lately, then by name. Typed: names starting with it, then a word starting with
 * it ("aub" finds "IKEA Aubonne"), then initials ("gf" finds Grand Frais), then anywhere in the name, or a
 * shop whose name starts what is typed.
 */
export function rankShops(stores: Store[], typed: string, counts: Record<string, number> = {}, recent: Record<string, string> = {}): Store[] {
  const q = fold(typed.trim());
  const score = (s: Store) => {
    if (!q) return 0;
    const name = fold(s.name);
    const words = name.split(/[^a-z0-9]+/).filter(Boolean);
    if (name.startsWith(q) || s.tag.startsWith(q)) return 4;
    if (words.some(w => w.startsWith(q))) return 3;
    if (q.length > 1 && words.map(w => w[0]).join('').startsWith(q)) return 2;
    if (name.includes(q) || q.startsWith(`${name} `)) return 1;   // "ikea aubonne" also shows IKEA: no second shop by mistake
    return -1;
  };
  return stores.map(s => ({ s, k: score(s) })).filter(x => x.k >= 0)
    .sort((a, b) => b.k - a.k || (counts[b.s.tag] ?? 0) - (counts[a.s.tag] ?? 0)
      || (recent[b.s.tag] ?? '').localeCompare(recent[a.s.tag] ?? '') || a.s.name.localeCompare(b.s.name))
    .map(x => x.s);
}

export const storeTagsOf = (item: Pick<Item, 'tags'>, stores: Store[]) => (item.tags || []).filter(t => stores.some(s => s.tag === t));

/** Does an item belong on the list at this shop? Items with no shop tag belong everywhere. */
export function atStore(item: Pick<Item, 'tags'>, store: string | null, stores: Store[]): boolean {
  const own = storeTagsOf(item, stores);
  if (!store || own.length === 0) return true;
  const s = stores.find(x => x.tag === store);
  return own.includes(store) || (s?.also ?? []).some(t => own.includes(t));
}

/** An id for an instruction (the server runs each id once, however often the app resends it). */
export function newAskId(now = new Date()): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('');
  return `ask-${now.toISOString().slice(0, 10)}-${hex}`;
}

/** The assistant's answer without the item markers (they are for the oc chat). */
export const plainReply = (s = '') => s.replace(/\s*⟨[a-z]+-[\d-]+[0-9a-f]+⟩/g, '').trim();

/** A name for a photo, in the server's format (month folder, random name). */
export function newPhotoRef(now = new Date()): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('');
  return `${now.toISOString().slice(0, 7)}/ph-${hex}.jpg`;
}

/** NOVA group: label and colour class (1 unprocessed … 4 ultra-processed). */
export function novaBadge(nova?: number): { label: string; cls: string } | null {
  if (!nova) return null;
  const cls = ['', 'bg-emerald-600', 'bg-lime-600', 'bg-amber-500', 'bg-red-500'][nova] ?? 'bg-pc-text-muted';
  return { label: `NOVA ${nova}`, cls };
}

/** A new id in the server's format, so an item added offline keeps its id. */
export function newItemId(now = new Date()): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('');
  return `shp-${now.toISOString().slice(0, 10)}-${hex}`;
}

/**
 * "Oat milk x2 @lidl !me" -> title "Oat milk", qty "2", tags ["lidl"], private.
 * "@shop" matches a shop by tag or name ("@grandfrais", "@carrefour market" is not supported: use the chip).
 */
export function parseQuickAdd(text: string, stores: Store[]): { title: string; qty?: string; tags: string[]; private: boolean } {
  let t = ` ${text} `;
  let qty: string | undefined;
  const tags: string[] = [];
  let priv = false;
  t = t.replace(/\s[x×](\d{1,3})(?=\s)|\s(\d{1,3})\s?[x×](?=\s)/gi, (_m, a, b) => { qty = a || b; return ' '; });
  t = t.replace(/\s!me(?=\s)/gi, () => { priv = true; return ' '; });
  t = t.replace(/\s@([\p{L}\p{N}-]+)(?=\s)/gu, (_m, w: string) => {
    const k = tagOf(w).replace(/-/g, '');
    const s = stores.find(x => x.tag.replace(/-/g, '') === k || tagOf(x.name).replace(/-/g, '') === k);
    tags.push(s ? s.tag : tagOf(w));
    return ' ';
  });
  return { title: t.replace(/\s+/g, ' ').trim(), qty, tags: [...new Set(tags)], private: priv };
}

/** Apply one operation to the local copy (the server does the same; see shop.mjs applyOp). */
export function applyLocal(items: Item[], op: Op, person: string, now = new Date().toISOString()): Item[] {
  const today = now.slice(0, 10);
  if (op.op === 'ask' || op.op === 'photo' || op.op === 'favorite' || op.op === 'shop' || op.op.startsWith('pantry-')) return items;   // not list items
  if (op.op === 'add') {
    if (items.some(i => i.id === op.id)) return items;
    return [...items, {
      id: op.id, kind: op.kind === 'return' ? 'return' : 'buy', title: op.title.trim(), tags: [...new Set((op.tags ?? []).map(tagOf).filter(Boolean))],
      qty: op.qty, notes: op.notes, due_date: op.due_date, link: op.link, product: op.product, status: 'open', scope: op.scope === 'private' ? 'private' : 'shared',
      added_by: person, created: now, updated: now,
    }];
  }
  return items.map(i => {
    if (i.id !== op.id) return i;
    const e: Item = { ...i, updated: now };
    switch (op.op) {
      case 'tick':
        if (i.status !== 'open') return i;
        return { ...e, status: i.kind === 'return' ? 'returned' : 'bought', bought_on: today, bought_by: person, bought_at: op.store };
      case 'untick':
        if (i.status === 'open') return i;
        return { ...e, status: 'open', bought_on: undefined, bought_by: undefined, bought_at: undefined };
      case 'drop':
        return i.status === 'open' ? { ...e, status: 'cancelled' } : i;
      case 'scope':
        return { ...e, scope: op.scope };
      case 'edit':
        return {
          ...e,
          ...(op.title !== undefined && op.title.trim() ? { title: op.title.trim() } : {}),
          ...(op.tags !== undefined ? { tags: [...new Set(op.tags.map(tagOf).filter(Boolean))] } : {}),
          ...(op.qty !== undefined ? { qty: op.qty || undefined } : {}),
          ...(op.notes !== undefined ? { notes: op.notes || undefined } : {}),
          ...(op.due_date !== undefined ? { due_date: op.due_date || undefined } : {}),
          ...(op.kind ? { kind: op.kind } : {}),
        };
    }
    return i;
  });
}

/** Case- and accent-blind match for search and suggestions. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Suggestions while typing: titles bought before that start with (or contain) the text, not already open. */
export function suggest(text: string, known: Known[], items: Item[], limit = 5): Known[] {
  const q = fold(text.trim());
  if (q.length < 2) return [];
  const open = new Set(items.filter(i => i.status === 'open').map(i => fold(i.title)));
  const hits = known.filter(k => !open.has(fold(k.title)) && fold(k.title).includes(q));
  hits.sort((a, b) => Number(fold(b.title).startsWith(q)) - Number(fold(a.title).startsWith(q)) || b.n - a.n);
  return hits.slice(0, limit);
}
