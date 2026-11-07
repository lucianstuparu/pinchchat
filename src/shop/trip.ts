/**
 * A trip to a shop (Lucian, 2026-10-25: "I'm picking stuff off the shelves and I need to mark them
 * as picked but not yet bought ... and photograph additional items that I'm buying"). In the shop
 * the list splits in two: what is meant for this shop, and what may well be here too. A tap puts a
 * thing in the basket; it is bought only at "Paid", which ticks the basket at this shop and sends the
 * photos of things not on the list to the assistant. The trip lives on this phone only, so it
 * survives no reception and the app being closed in the shop.
 */
import { groupOf, shopGroup, type Group } from './groups';
import { fold, isWish, neverTag, storeTagsOf, tagOf, type Item, type Product, type Purchase, type Store } from './logic';

export interface Photo { ref: string; thumb: string }
/**
 * One product not on the list. `ref`/`thumb` are its first photo (the front), `also` the others, such as
 * the expiry date (Lucian, 2026-11-07: "at least 2 photos per product").
 */
export interface Extra extends Photo { also?: Photo[] }
/** The photos of a thing on the list, taken in the shop (2026-11-01): at Paid they become that item's product card. */
export interface Shot extends Photo { id: string; also?: Photo[] }
/**
 * `count`: how many of a thing went in the basket, when set in the shop (2026-11-01).
 * `out`: out of stock on this trip (2026-11-07): crossed out, still on the list after Paid.
 */
export interface Trip { store: string; started: string; picked: string[]; extras: Extra[]; shots?: Shot[]; count?: Record<string, number>; out?: string[] }

/** The most photos of one product: the server takes 6 per ask, and a product's photos stay in one ask. */
export const MAX_PHOTOS = 4;
export const photosOf = (x: Photo & { also?: Photo[] }): Photo[] => [{ ref: x.ref, thumb: x.thumb }, ...(x.also ?? [])];
export const withPhoto = <T extends Photo & { also?: Photo[] }>(x: T, p: Photo): T => ({ ...x, also: [...(x.also ?? []), p] });
/** Without one photo: the next becomes the first; null when none is left. */
export function withoutPhoto<T extends Photo & { also?: Photo[] }>(x: T, ref: string): T | null {
  const [first, ...rest] = photosOf(x).filter(p => p.ref !== ref);
  return first ? { ...x, ref: first.ref, thumb: first.thumb, also: rest } : null;
}
/** Products into asks of at most `max` photos each, in order, a product's photos never split. */
export function askBatches<T extends Photo & { also?: Photo[] }>(list: T[], max = 6): T[][] {
  const out: T[][] = [];
  let n = 0;
  for (const x of list) {
    const k = photosOf(x).length;
    if (!out.length || n + k > max) { out.push([]); n = 0; }
    out[out.length - 1].push(x);
    n += k;
  }
  return out;
}
/** "photo 1", "photos 2-3": where a product's photos are in the ask. */
const photoSpans = (counts: number[]) => {
  let at = 0;
  return counts.map(k => { const a = at + 1; at += k; return k === 1 ? `photo ${a}` : `photos ${a}-${at}`; });
};

/** The number at the start of a quantity ("2", "x20", "3 kg"), else undefined. */
export const countOf = (qty?: string): number | undefined => { const m = /\d+/.exec(qty ?? ''); const n = m ? Number(m[0]) : 0; return n > 0 ? n : undefined; };

const KEY = 'shop:trip';
export const readTrip = (): Trip | null => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) as Trip : null; } catch { return null; } };
export const writeTrip = (t: Trip | null) => { try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); } catch { /* fine in memory */ } };
export const newTrip = (store: string, now = new Date()): Trip => ({ store, started: now.toISOString(), picked: [], extras: [] });

/** A receipt's or a purchase's shop name as a list tag ("Carrefour Market Lyon" -> carrefour-market), like the server. */
export function shopTagOf(name: string | undefined, stores: Store[]): string | null {
  if (!name) return null;
  const slug = tagOf(name);
  const tags = stores.map(s => s.tag).sort((a, b) => b.length - a.length);
  return tags.find(t => slug === t || slug.startsWith(`${t}-`)) ?? null;
}

/** Why it may be here; `shops` = the shops it is meant for (shown as their logos). */
export interface Maybe { item: Item; why: string; shops?: string[] }

/**
 * What to look for in this shop. `here`: open things meant for it (or a related shop: Carrefour and
 * Carrefour Market). `maybe`: other open things to buy that could be here too, most likely first:
 * bought here before, then meant for any shop, then the kind of thing this shop has sold us
 * (groceries at a supermarket), from the history; a shop with no history counts as a supermarket
 * unless it is known for one kind (IKEA: house). Returns stay with their own shop; the wishlist stays out.
 */
export function tripLists(items: Item[], store: string, stores: Store[], purchases: Purchase[] = [], products: Product[] = []): { here: Item[]; maybe: Maybe[] } {
  const shop = stores.find(s => s.tag === store);
  const sameShop = new Set([store, ...(shop?.also ?? [])]);
  // Never at this shop: marked on an item, and so on the same thing when it is back on the list later.
  const never = new Set(items.filter(i => (i.tags ?? []).includes(neverTag(store))).flatMap(i => [fold(i.title), ...(i.product ? [i.product] : [])]));
  const open = items.filter(i => i.status === 'open' && !isWish(i) && !never.has(fold(i.title)) && !(i.product && never.has(i.product)));
  const here = open.filter(i => storeTagsOf(i, stores).some(t => sameShop.has(t)));
  const hereIds = new Set(here.map(i => i.id));

  // What was bought at this shop: the list's ticks and the receipts.
  const boughtHere = new Set<string>();
  const groups = new Set<Group>();
  for (const i of items) {
    if (i.status === 'bought' && i.bought_at && sameShop.has(i.bought_at)) { boughtHere.add(fold(i.title)); if (i.product) boughtHere.add(i.product); groups.add(groupOf(i)); }
  }
  for (const p of purchases) {
    const t = shopTagOf(p.store, stores);
    if (!t || !sameShop.has(t)) continue;
    boughtHere.add(fold(p.title)); if (p.product) boughtHere.add(p.product);
    const prod = p.product ? products.find(x => x.id === p.product) : undefined;
    groups.add(groupOf({ title: prod?.name ?? p.title, tags: [] }));
  }
  for (const pr of products) { const t = shopTagOf(pr.stats?.last_store, stores); if (t && sameShop.has(t)) boughtHere.add(pr.id); }
  if (groups.size === 0) { const g = shopGroup(store); if (g) groups.add(g); else { groups.add('groceries'); groups.add('house'); } }

  type Ranked = Maybe & { k: number };
  const rank = (m: Ranked) => m.k;
  const maybe = open.filter(i => i.kind === 'buy' && !hereIds.has(i.id)).flatMap((i): Ranked[] => {
    const own = storeTagsOf(i, stores);
    if (boughtHere.has(fold(i.title)) || (i.product && boughtHere.has(i.product))) return [{ item: i, why: 'bought here before', k: 0 }];
    if (own.length === 0) return [{ item: i, why: 'any shop', k: 1 }];
    if (groups.has(groupOf(i))) return [{ item: i, why: '', shops: own, k: 2 }];
    return [];
  }).sort((a, b) => rank(a) - rank(b));
  return { here, maybe: maybe.map(({ item, why, shops }) => ({ item, why, ...(shops ? { shops } : {}) })) };
}

/** A small preview of a photo for the basket (the full one goes to the server). */
export async function thumbOf(file: Blob, side = 160): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close?.();
  return c.toDataURL('image/jpeg', 0.7);
}

/**
 * The instruction for the assistant at "Paid": the things bought that were not on the list. `counts`: how
 * many photos each product has, in the order of the photos.
 */
export const extrasAsk = (shopName: string, counts: number[]) =>
  `[In the shop] Paid at ${shopName} just now. Also bought, not on the list: ${counts.length} ${counts.length === 1 ? 'product' : 'products'} in the photos: `
  + `${photoSpans(counts).map((s, k) => `product ${k + 1} = ${s}`).join('; ')}. `
  + 'Photos of one product are the same product: the first is its front, the others its back or its expiry date. '
  + 'Save each product once to the catalogue, record the purchase at this shop today, and put food in the pantry with the expiry date a photo shows (no date if none does).';

/** The instruction for the photos of things on the list: each set of photos is the exact product of one item. */
export const shotsAsk = (shopName: string, shots: { id: string; title: string; count: number }[]) => {
  const spans = photoSpans(shots.map(s => s.count));
  return `[In the shop] Photos at ${shopName} of things on the list, in this order: ${shots.map((s, k) => `${s.title} (${s.id}) = ${spans[k]}`).join('; ')}. `
    + "An item's photos show its exact product: the first is the front, the others its back or its expiry date. product_find, else product_save from the photos, then link it to the item (shop_update edit product). "
    + 'If a photo shows an expiry date, set it on that thing in the pantry. Do not tick or add anything.';
};
