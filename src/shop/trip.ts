/**
 * A trip to a shop (Lucian, 2026-10-25: "I'm picking stuff off the shelves and I need to mark them
 * as picked but not yet bought ... and photograph additional items that I'm buying"). In the shop
 * the list splits in two: what is meant for this shop, and what may well be here too. A tap puts a
 * thing in the basket; it is bought only at "Paid", which ticks the basket at this shop and sends the
 * photos of things not on the list to the assistant. The trip lives on this phone only, so it
 * survives no reception and the app being closed in the shop.
 */
import { groupOf, shopGroup, type Group } from './groups';
import { fold, isWish, storeTagsOf, tagOf, type Item, type Product, type Purchase, type Store } from './logic';

export interface Extra { ref: string; thumb: string }
export interface Trip { store: string; started: string; picked: string[]; extras: Extra[] }

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
  const open = items.filter(i => i.status === 'open' && !isWish(i));
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

/** The instruction for the assistant at "Paid": the things bought that were not on the list. */
export const extrasAsk = (shopName: string, n: number) =>
  `[In the shop] Paid at ${shopName} just now. Also bought, not on the list: ${n === 1 ? 'the product in the photo' : `the ${n} products in the photos, one each`}. `
  + 'Save each to the catalogue, record the purchase at this shop today, and put food in the pantry (no date unless the photo shows one).';
