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
  /** The assistant is turning the raw text into proper items. */
  sorting?: boolean;
}
export interface Known { title: string; tags: string[]; n: number }
export interface Snapshot { today: string; stores: Store[]; items: Item[]; known: Known[] }

export type Op =
  | { op: 'add'; id: string; title: string; tags?: string[]; qty?: string; notes?: string; scope?: 'shared' | 'private'; kind?: 'buy' | 'return'; due_date?: string; link?: string;
      /** Have the assistant sort the raw text (title, shop, quantity, several items); store = the shop list in view. */
      smart?: boolean; store?: string }
  | { op: 'tick'; id: string; store?: string }
  | { op: 'untick'; id: string }
  | { op: 'drop'; id: string }
  | { op: 'edit'; id: string; title?: string; tags?: string[]; qty?: string; notes?: string; due_date?: string; kind?: 'buy' | 'return' }
  | { op: 'scope'; id: string; scope: 'shared' | 'private' };

/** The shops, used before the first sync (the server sends the same list). */
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

export const storeTagsOf = (item: Pick<Item, 'tags'>, stores: Store[]) => (item.tags || []).filter(t => stores.some(s => s.tag === t));

/** Does an item belong on the list at this shop? Items with no shop tag belong everywhere. */
export function atStore(item: Pick<Item, 'tags'>, store: string | null, stores: Store[]): boolean {
  const own = storeTagsOf(item, stores);
  if (!store || own.length === 0) return true;
  const s = stores.find(x => x.tag === store);
  return own.includes(store) || (s?.also ?? []).some(t => own.includes(t));
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
  if (op.op === 'add') {
    if (items.some(i => i.id === op.id)) return items;
    return [...items, {
      id: op.id, kind: op.kind === 'return' ? 'return' : 'buy', title: op.title.trim(), tags: [...new Set((op.tags ?? []).map(tagOf).filter(Boolean))],
      qty: op.qty, notes: op.notes, due_date: op.due_date, link: op.link, status: 'open', scope: op.scope === 'private' ? 'private' : 'shared',
      added_by: person, created: now, updated: now, sorting: op.smart || undefined,
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
