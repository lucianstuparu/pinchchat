/**
 * In the shop (trip.ts): the list for the shelves. A tap puts a thing in the basket (and back);
 * nothing is bought until Paid, at the till. The camera adds things not on the list: their photos
 * go to the assistant at Paid, for the catalogue, the purchases and the pantry.
 *
 * A ticked thing stays where it was, crossed out on green (Lucian 2026-10-29: "helps me quickly check
 * that I didn't check by mistake"). Search finds anything on the list, for any shop; Ask opens the
 * Shopping assistant's bar (the same as on the main screen); a product photo opens full size.
 *
 * A long press opens a small menu instead of the browser's text selection (Lucian 2026-11-01): Add a
 * photo, Not at this shop, Not needed any more. A thing in the basket without a photo shows a camera
 * button: its photo goes to the assistant at Paid and becomes the item's product card.
 *
 * A thing in the basket shows how many ("×1"); a tap on it picks the number. At Paid the count goes on
 * the item, and food goes into At home with it (Lucian 2026-11-01: "I might buy more of the same thing").
 *
 * Lucian 2026-11-07: the list reads shelf by shelf, neighbours together with a gap and no headings
 * (aisles.ts). A product can have several photos, the front and the expiry date. Out of stock today is
 * crossed out for this trip and stays on the list; Never at this shop takes it off this shop's list for good.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Ban, Camera, Check, ChevronDown, Lock, MessageSquare, PackageX, Plus, RotateCcw, Search, ShoppingBasket, Trash2, X } from 'lucide-react';
import { UndoBar, type UndoInfo } from '../app/UndoBar';
import { Sheet } from '../ui/Sheet';
import { SearchHeader } from '../ui/Controls';
import { useBusy } from '../ui/draft';
import { aisleBlocks } from './aisles';
import { fold, neverTag, newPhotoRef, type Item, type Op, type Product, type Purchase, type Store } from './logic';
import { photoUrl, shrinkPhoto } from './photos';
import { ProductPicture } from './ProductPicture';
import { countOf, MAX_PHOTOS, photosOf, thumbOf, tripLists, withoutPhoto, withPhoto, type Shot, type Trip } from './trip';
import { ShopLogo, ShopLogos } from './ShopLogo';

export function InStore({ trip, onTrip, items, stores, purchases, products, storeName, apply, onPaid, onLeave, onChangeShop, askBar }: {
  trip: Trip; onTrip: (t: Trip) => void;
  items: Item[]; stores: Store[]; purchases: Purchase[]; products: Product[];
  storeName: (t: string) => string;
  apply: (op: Op) => void; onPaid: () => void; onLeave: () => void; onChangeShop: () => void;
  /** The Shopping assistant's bar (ShopApp's AddBar), shown in a sheet from Ask. */
  askBar: ReactNode;
}) {
  const { here, maybe } = tripLists(items, trip.store, stores, purchases, products);
  const picked = new Set(trip.picked);
  // In the basket: what was picked and is still open (bought meanwhile by someone else: gone).
  const basket = items.filter(i => picked.has(i.id) && i.status === 'open');
  const outOfStock = new Set(trip.out ?? []);
  const toFind = here.filter(i => !picked.has(i.id) && !outOfStock.has(i.id));
  const nOut = here.filter(i => outOfStock.has(i.id) && !picked.has(i.id)).length;
  const findLine = toFind.length ? `${toFind.length} to find` : nOut ? 'Nothing left to find' : 'All found';
  // Undo acts on the trip as it is by then, not as it was when the bar appeared.
  const latest = useRef(trip);
  useEffect(() => { latest.current = trip; }, [trip]);
  // Ticked things stay in their place; only those found by search (not on this shop's lists) sit in the basket box.
  const listed = new Set([...here.map(i => i.id), ...maybe.map(m => m.item.id)]);
  const fromSearch = basket.filter(i => !listed.has(i.id));
  const productOf = (id?: string) => (id ? products.find(p => p.id === id) : undefined);
  // Found after all: a tap on something out of stock puts it in the basket and takes the mark away.
  const toggle = (id: string) => onTrip({ ...trip, picked: picked.has(id) ? trip.picked.filter(x => x !== id) : [...trip.picked, id], out: (trip.out ?? []).filter(x => x !== id) });
  const [showMaybe, setShowMaybe] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const searching = query !== null && !!query.trim();
  const found = searching ? items.filter(i => i.status === 'open' && i.kind === 'buy' && fold(i.title).includes(fold(query.trim()))).slice(0, 30) : [];
  const [asking, setAsking] = useState(false);
  const [photo, setPhoto] = useState<string[] | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  useBusy('shop-trip', true);   // never reload the app in the middle of a shop
  const n = basket.length + trip.extras.length;
  const shots = trip.shots ?? [];
  const shotOf = (id: string) => shots.find(s => s.id === id);
  const [menu, setMenu] = useState<Item | null>(null);
  const [counting, setCounting] = useState<Item | null>(null);
  const countFor = (i: Item) => trip.count?.[i.id] ?? countOf(i.qty) ?? 1;
  const setCount = (id: string, n: number) => onTrip({ ...trip, count: { ...trip.count, [id]: n } });
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const undoKey = useRef(0);
  const closeUndo = useCallback(() => setUndo(null), []);
  // What the camera is photographing: an item, a product not on the list again, or (null) a new one.
  type Aim = { item: string } | { extra: string } | null;
  const shotFor = useRef<Aim>(null);
  const shoot = (aim: Aim) => { shotFor.current = aim; camera.current?.click(); };
  const shootItem = (id: string) => shoot({ item: id });
  const shootExtra = () => shoot(null);
  // The product just photographed: the bar offers another photo of it, without a sheet in the way.
  const [lastAim, setLastAim] = useState<Exclude<Aim, null> | null>(null);
  const last = lastAim && 'item' in lastAim ? shots.find(s => s.id === lastAim.item) : lastAim ? trip.extras.find(e => e.ref === lastAim.extra) : undefined;
  const drop = (i: Item) => {
    apply({ op: 'drop', id: i.id });
    onTrip({ ...trip, picked: trip.picked.filter(x => x !== i.id), shots: shots.filter(s => s.id !== i.id), out: (trip.out ?? []).filter(x => x !== i.id) });
    setUndo({ key: ++undoKey.current, label: `Not needed: ${i.title}`, undo: () => apply({ op: 'untick', id: i.id }) });
  };
  const neverHere = (i: Item) => {
    const tags = i.tags ?? [];
    const wasPicked = picked.has(i.id), wasOut = outOfStock.has(i.id);
    apply({ op: 'edit', id: i.id, tags: [...tags.filter(t => t !== trip.store), neverTag(trip.store)] });
    onTrip({ ...trip, picked: trip.picked.filter(x => x !== i.id), out: (trip.out ?? []).filter(x => x !== i.id) });
    setUndo({ key: ++undoKey.current, label: `Never at ${storeName(trip.store)}: ${i.title}`, undo: () => {
      apply({ op: 'edit', id: i.id, tags });
      const now = latest.current;
      onTrip({ ...now, picked: wasPicked ? [...now.picked, i.id] : now.picked, out: wasOut ? [...(now.out ?? []), i.id] : now.out });
    } });
  };
  const setOut = (i: Item, on: boolean) => {
    const others = (trip.out ?? []).filter(x => x !== i.id);
    const wasPicked = picked.has(i.id);
    onTrip({ ...trip, out: on ? [...others, i.id] : others, picked: on ? trip.picked.filter(x => x !== i.id) : trip.picked });
    if (on) setUndo({ key: ++undoKey.current, label: `Out of stock today: ${i.title}`, undo: () => {
      const now = latest.current;
      onTrip({ ...now, out: (now.out ?? []).filter(x => x !== i.id), picked: wasPicked ? [...now.picked, i.id] : now.picked });
    } });
  };

  const addPhoto = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const data = await shrinkPhoto(f);
      const ref = newPhotoRef();
      apply({ op: 'photo', ref, data });   // goes up now, while still in the shop, or as soon as there is signal
      const thumb = await thumbOf(f);
      const aim = shotFor.current, p = { ref, thumb };
      if (aim && 'item' in aim) {
        const had = shots.find(s => s.id === aim.item);
        onTrip({ ...trip, shots: had ? shots.map(s => (s === had ? withPhoto(s, p) : s)) : [...shots, { id: aim.item, ...p } satisfies Shot] });
        setLastAim(aim);
      } else if (aim) {
        onTrip({ ...trip, extras: trip.extras.map(e => (e.ref === aim.extra ? withPhoto(e, p) : e)) });
        setLastAim(aim);
      } else {
        onTrip({ ...trip, extras: [...trip.extras, p] });
        setLastAim({ extra: ref });
      }
    } catch { /* unreadable image: skipped */ }
    setBusy(false);
    if (camera.current) camera.current.value = '';
  };

  const hereBlocks = aisleBlocks(here, i => i, productOf);
  const maybeBlocks = aisleBlocks(maybe, m => m.item, productOf);
  const rowProps = (i: Item) => ({
    item: i, count: countFor(i), onCount: () => setCounting(i), shot: shotOf(i.id), onMenu: () => setMenu(i), onShoot: () => shootItem(i.id),
    product: productOf(i.product), inBasket: picked.has(i.id), out: outOfStock.has(i.id) && !picked.has(i.id), onTap: () => toggle(i.id), onPhoto: setPhoto,
  });

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-pc-base pt-[env(safe-area-inset-top)]">
        <div className="flex h-[56px] items-center gap-1 px-2">
          <button type="button" onClick={() => (n ? setLeaving(true) : onLeave())} aria-label="Leave the shop" className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <X size={22} />
          </button>
          <button type="button" onClick={onChangeShop} aria-haspopup="dialog" aria-label={`In ${storeName(trip.store)}. Change shop`} className="min-w-0 flex-1 px-1 text-left">
            <span className="flex items-center gap-1.5 text-[17px] font-semibold leading-tight"><ShopLogo tag={trip.store} name="" size={22} /><span className="truncate">{storeName(trip.store)}</span><ChevronDown size={16} className="shrink-0 opacity-60" /></span>
            <span className="block truncate text-[12px] leading-tight text-pc-text-muted">
              {findLine}{nOut ? ` · ${nOut} out of stock` : ''}{n ? ` · ${n} in the basket` : ''}
            </span>
          </button>
          <button type="button" onClick={() => setQuery(q => (q === null ? '' : null))} aria-label="Search the list" aria-pressed={query !== null}
            className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Search size={21} />
          </button>
          <button type="button" onClick={() => setAsking(true)} aria-label="Ask the assistant" className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <MessageSquare size={21} />
          </button>
        </div>
        {query !== null && <SearchHeader value={query} onChange={setQuery} onCancel={() => setQuery(null)} placeholder="Search the whole list" />}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto pb-4">
        {searching ? (
          <section className="mt-2">
            <h2 className="px-4 pb-1 pt-2 text-[13px] font-semibold text-pc-text-muted">On the list · {found.length}</h2>
            {found.length === 0 && <p className="px-4 py-2 text-[15px] text-pc-text-muted">Nothing on the list matches. Ask the assistant to add it.</p>}
            <div className="divide-y divide-[var(--pc-separator)]">
              {found.map(i => <TripRow key={i.id} {...rowProps(i)} />)}
            </div>
          </section>
        ) : <>
          {here.length === 0 && maybe.length === 0 && basket.length === 0 && (
            <div className="flex flex-col items-center px-10 py-14 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.12)] text-[var(--pc-accent-ink)]"><ShoppingBasket size={26} /></span>
              <p className="text-[17px] font-semibold">Nothing on the list for {storeName(trip.store)}</p>
              <p className="mt-1 text-[15px] text-pc-text-muted">Photograph what you buy with the camera below; it is added at Paid.</p>
            </div>
          )}

          {here.length > 0 && (
            <section className="mt-2">
              <h2 className="px-4 pb-1 pt-2 text-[13px] font-semibold text-pc-text-muted">For this shop · {findLine.toLowerCase()}</h2>
              {hereBlocks.map(list => (
                <div key={list[0].id} className="mb-2 divide-y divide-[var(--pc-separator)] bg-pc-surface">
                  {list.map(i => <TripRow key={i.id} {...rowProps(i)} />)}
                </div>
              ))}
            </section>
          )}

          {maybe.length > 0 && (
            <section className="mt-3">
              <button type="button" onClick={() => setShowMaybe(s => !s)} aria-expanded={showMaybe}
                className="flex h-10 w-full items-center gap-1.5 px-4 text-left text-[13px] font-semibold text-pc-text-muted">
                <ChevronDown size={15} className={showMaybe ? '' : '-rotate-90'} /> Maybe here too · {maybe.length}
              </button>
              {showMaybe && maybeBlocks.map(list => (
                <div key={list[0].item.id} className="mb-2 divide-y divide-[var(--pc-separator)] bg-pc-surface">
                  {list.map(m => <TripRow key={m.item.id} {...rowProps(m.item)} why={m.why} shops={m.shops} storeName={storeName} />)}
                </div>
              ))}
            </section>
          )}

          {fromSearch.length + trip.extras.length > 0 && (
            <section className="mx-3 mt-4 overflow-hidden rounded-[12px] bg-pc-surface">
              <h2 className="flex items-center gap-1.5 px-4 pb-0.5 pt-2.5 text-[13px] font-semibold text-[var(--pc-accent-ink)]"><ShoppingBasket size={14} /> Also in the basket · {fromSearch.length + trip.extras.length}</h2>
              <div className="divide-y divide-[var(--pc-separator)]">
                {fromSearch.map(i => <TripRow key={i.id} {...rowProps(i)} />)}
              </div>
              {trip.extras.length > 0 && (
                <div className="px-4 pb-3 pt-2">
                  <p className="pb-2 text-[13px] text-pc-text-muted">Not on the list · the assistant adds them at Paid</p>
                  <div className="space-y-3">
                    {trip.extras.map(e => (
                      <div key={e.ref} className="flex flex-wrap gap-3 rounded-[12px] bg-pc-base p-2" role="group" aria-label="Photos of one product">
                        {photosOf(e).map(p => (
                          <div key={p.ref} className="relative">
                            <button type="button" onClick={() => setPhoto([photoUrl(p.ref)])} aria-label="See this photo full size">
                              <img src={p.thumb} alt="Something not on the list" className="h-16 w-16 rounded-[12px] object-cover" />
                            </button>
                            <button type="button" onClick={() => {
                              const kept = withoutPhoto(e, p.ref);
                              onTrip({ ...trip, extras: trip.extras.flatMap(x => (x.ref !== e.ref ? [x] : kept ? [kept] : [])) });
                              if (lastAim && 'extra' in lastAim && lastAim.extra === e.ref) setLastAim(kept ? { extra: kept.ref } : null);
                            }}
                              className="absolute -right-3.5 -top-3.5 flex h-10 w-10 items-center justify-center" aria-label="Remove this photo">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pc-text text-pc-base shadow"><X size={13} strokeWidth={3} /></span>
                            </button>
                          </div>
                        ))}
                        {photosOf(e).length < MAX_PHOTOS && (
                          <button type="button" disabled={busy} onClick={() => shoot({ extra: e.ref })} aria-label="Another photo of this product"
                            className="press flex h-16 w-16 items-center justify-center rounded-[12px] bg-pc-surface text-[var(--pc-accent-ink)]">
                            <Plus size={22} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>}
      </main>

      <UndoBar info={undo} onClose={closeUndo} />
      <div className="shrink-0 border-t border-pc-border bg-pc-base px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void addPhoto(e.target.files)} />
        {last && lastAim && photosOf(last).length < MAX_PHOTOS && (
          <div className="mb-2 flex items-center gap-2">
            <span className="flex shrink-0 -space-x-3">
              {photosOf(last).map(p => <img key={p.ref} src={p.thumb} alt="" className="h-12 w-12 rounded-[8px] border-2 border-pc-base object-cover" />)}
            </span>
            <button type="button" disabled={busy} onClick={() => shoot(lastAim)}
              className="press flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[rgba(var(--pc-accent-rgb),0.22)] px-3 text-[15px] font-semibold disabled:opacity-50">
              <Camera size={20} className="shrink-0" /><span className="truncate">Add the date</span>
            </button>
            <button type="button" onClick={() => setLastAim(null)} aria-label="No more photos of this one" className="press flex h-12 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={shootExtra}
            className="press flex h-14 shrink-0 items-center gap-2 rounded-full bg-pc-surface pl-4 pr-5 text-[15px] font-medium text-pc-text disabled:opacity-50"
            aria-label="Photograph something not on the list">
            <Camera size={22} className="text-[var(--pc-accent-ink)]" /> Not on the list
          </button>
          <button type="button" disabled={n === 0} onClick={onPaid}
            className="press h-14 min-w-0 flex-1 rounded-full bg-pc-accent px-4 text-[17px] font-semibold text-[var(--pc-on-accent)] shadow-[0_4px_14px_rgba(0,0,0,0.18)] disabled:opacity-40 disabled:shadow-none">
            {n ? `Paid · ${n}` : 'Paid'}
          </button>
        </div>
      </div>

      {counting && (
        <Sheet label={`How many: ${counting.title}`} onClose={() => setCounting(null)} className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <p className="truncate px-1 text-[17px] font-semibold">How many?</p>
          <p className="truncate px-1 pb-3 text-[15px] text-pc-text-muted">{counting.title}</p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, k) => k + 1).map(n => (
              <button key={n} type="button" onClick={() => { setCount(counting.id, n); setCounting(null); }} aria-pressed={countFor(counting) === n}
                className={`press h-14 rounded-[12px] text-[19px] font-semibold ${countFor(counting) === n ? 'bg-pc-accent text-[var(--pc-on-accent)]' : 'bg-pc-surface'}`}>
                {n}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {menu && (
        <Sheet label={menu.title} onClose={() => setMenu(null)} className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <p className="truncate px-1 pb-3 text-[17px] font-semibold">{menu.title}</p>
          <div className="space-y-2">
            <button type="button" disabled={busy} onClick={() => { const id = menu.id; setMenu(null); shootItem(id); }}
              className="press flex h-12 w-full items-center gap-3 rounded-[12px] bg-pc-surface px-4 text-[16px] font-medium">
              <Camera size={20} className="text-[var(--pc-accent-ink)]" /> {shotOf(menu.id) ? 'Another photo of it' : 'Add a photo of it'}
            </button>
            {shotOf(menu.id) && (
              <button type="button" onClick={() => { const id = menu.id; onTrip({ ...trip, shots: shots.filter(s => s.id !== id) }); if (lastAim && 'item' in lastAim && lastAim.item === id) setLastAim(null); setMenu(null); }}
                className="press flex h-12 w-full items-center gap-3 rounded-[12px] bg-pc-surface px-4 text-[16px] font-medium">
                <X size={20} className="text-pc-text-muted" /> Remove its photos
              </button>
            )}
            {outOfStock.has(menu.id) ? (
              <button type="button" onClick={() => { setOut(menu, false); setMenu(null); }}
                className="press flex h-12 w-full items-center gap-3 rounded-[12px] bg-pc-surface px-4 text-[16px] font-medium">
                <RotateCcw size={20} className="text-pc-text-muted" /> In stock after all
              </button>
            ) : (
              <button type="button" onClick={() => { setOut(menu, true); setMenu(null); }}
                className="press flex h-12 w-full items-center gap-3 rounded-[12px] bg-pc-surface px-4 text-[16px] font-medium">
                <PackageX size={20} className="text-pc-text-muted" /> Out of stock today
              </button>
            )}
            <button type="button" onClick={() => { neverHere(menu); setMenu(null); }}
              className="press flex h-12 w-full items-center gap-3 rounded-[12px] bg-pc-surface px-4 text-[16px] font-medium">
              <Ban size={20} className="shrink-0 text-pc-text-muted" /> <span className="truncate">Never at {storeName(trip.store)}</span>
            </button>
            <button type="button" onClick={() => { drop(menu); setMenu(null); }}
              className="press flex h-12 w-full items-center gap-3 rounded-[12px] bg-pc-surface px-4 text-[16px] font-medium text-red-500">
              <Trash2 size={20} /> Not needed any more
            </button>
          </div>
        </Sheet>
      )}

      {asking && (
        <Sheet label="Ask the assistant" onClose={() => setAsking(false)} className="flex max-h-[85dvh] flex-col pt-2">
          <div className="flex items-center justify-between px-4 pb-1">
            <p className="text-[17px] font-semibold">Ask the assistant</p>
            <button type="button" onClick={() => setAsking(false)} aria-label="Close" className="press flex h-10 w-10 items-center justify-center rounded-full"><X size={20} /></button>
          </div>
          <p className="px-4 pb-2 text-[14px] text-pc-text-muted">“Is this one healthy?” with a photo, “which yogurt did we buy last time?”, “add 2 lemons”.</p>
          {askBar}
        </Sheet>
      )}

      {photo && (
        <Sheet label="Photo" onClose={() => setPhoto(null)} className="p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setPhoto(null)} aria-label="Close the photo" className="block max-h-[85dvh] w-full space-y-2 overflow-y-auto">
            {photo.map(src => <img key={src} src={src} alt="" className="max-h-[85dvh] w-full rounded-[12px] bg-pc-surface object-contain" />)}
          </button>
        </Sheet>
      )}

      {leaving && (
        <Sheet label="Leave the shop" onClose={() => setLeaving(false)} className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <p className="px-1 text-[17px] font-semibold">{n} in the basket</p>
          <p className="px-1 pb-3 text-[15px] text-pc-text-muted">Did you pay for them?</p>
          <div className="space-y-2">
            <button type="button" onClick={() => { setLeaving(false); onPaid(); }} className="press h-12 w-full rounded-[12px] bg-pc-accent text-[16px] font-semibold text-[var(--pc-on-accent)]">Paid for everything</button>
            <button type="button" onClick={() => { setLeaving(false); onLeave(); }} className="press h-12 w-full rounded-[12px] bg-pc-surface text-[16px] font-medium text-red-500">Put it all back</button>
            <button type="button" onClick={() => setLeaving(false)} className="press h-12 w-full rounded-[12px] text-[16px] text-pc-text-muted">Keep shopping</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Ticked = in the basket: the same green as a done task in oc. */
const GREEN = '#1d9e75';

function TripRow({ item, product, shot, count, onCount, why, shops = [], storeName = t => t, inBasket, out, onTap, onPhoto, onMenu, onShoot }: {
  item: Item; product?: Product; shot?: Shot; count?: number; onCount?: () => void; why?: string; shops?: string[]; storeName?: (t: string) => string; inBasket?: boolean; out?: boolean;
  onTap: () => void; onPhoto?: (src: string[]) => void; onMenu?: () => void; onShoot?: () => void;
}) {
  // The full-size view opens the photo as taken (the label), the row shows the product's picture.
  const pics = shot ? photosOf(shot).map(p => photoUrl(p.ref)) : product?.photos[0] ? [photoUrl(product.photos[0])] : null;
  const sub = out ? ['Out of stock today'] : [item.qty ? `×${item.qty}` : '', item.notes ?? '', why ?? ''].filter(Boolean);
  return (
    <div className="flex select-none items-center transition-colors [-webkit-touch-callout:none]" style={inBasket ? { background: 'rgba(29,158,117,0.10)' } : undefined}
      onContextMenu={onMenu ? e => { e.preventDefault(); onMenu(); } : undefined}>
      <button type="button" onClick={onTap} aria-pressed={!!inBasket}
        aria-label={inBasket ? `Take “${item.title}” out of the basket` : out ? `Out of stock today: ${item.title}. Found it after all, put it in the basket` : `Put “${item.title}” in the basket`}
        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-1 pr-2 text-left active:bg-[var(--pc-hover-strong)]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center">
          <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border-[1.75px] ${inBasket ? 'text-white' : 'border-pc-text-faint'}`}
            style={inBasket ? { borderColor: GREEN, background: GREEN } : undefined}>
            {inBasket && <Check size={16} strokeWidth={3} />}
            {out && <X size={16} strokeWidth={2.5} className="text-pc-text-muted" />}
          </span>
        </span>
        <span className={`min-w-0 flex-1 py-2 ${inBasket ? 'opacity-75' : ''}`}>
          <span className={`block truncate text-[17px] leading-snug ${inBasket ? 'line-through decoration-2' : out ? 'text-pc-text-muted line-through decoration-2' : ''}`} style={inBasket ? { color: GREEN } : undefined}>{item.title}</span>
          {(sub.length > 0 || shops.length > 0 || item.scope === 'private') && (
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] leading-tight text-pc-text-muted">
              {sub.length > 0 && <span className="truncate">{sub.join(' · ')}</span>}
              <ShopLogos tags={shops} storeName={storeName} size={18} />
              {item.scope === 'private' && <span className="inline-flex shrink-0 items-center gap-0.5"><Lock size={11} /> just me</span>}
            </span>
          )}
        </span>
      </button>
      {inBasket && onCount && (
        <button type="button" onClick={onCount} aria-label={`How many: ${count ?? 1}. Change`}
          className="press mr-2 flex h-10 min-w-[48px] shrink-0 items-center justify-center rounded-full bg-pc-base px-3 text-[15px] font-semibold tabular-nums" style={{ color: GREEN }}>
          ×{count ?? 1}
        </button>
      )}
      {pics ? (
        <button type="button" onClick={() => onPhoto?.(pics)} aria-label={`See the photo of ${item.title}`} className="press mr-3 shrink-0">
          {shot ? <img src={shot.thumb} alt="" className={`h-12 w-12 rounded-[8px] bg-pc-surface object-cover ${inBasket || out ? 'opacity-50' : ''}`} />
            : <ProductPicture p={product} size={48} radius={8} dim={inBasket || out} />}
        </button>
      ) : inBasket && onShoot ? (
        <button type="button" onClick={onShoot} aria-label={`Photograph ${item.title}`}
          className="press mr-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-pc-surface text-[var(--pc-accent-ink)]">
          <Camera size={20} />
        </button>
      ) : null}
    </div>
  );
}
