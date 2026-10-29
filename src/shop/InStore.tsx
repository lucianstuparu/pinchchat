/**
 * In the shop (trip.ts): the list for the shelves. A tap puts a thing in the basket (and back);
 * nothing is bought until Paid, at the till. The camera adds things not on the list: their photos
 * go to the assistant at Paid, for the catalogue, the purchases and the pantry.
 *
 * A ticked thing stays where it was, crossed out on green (Lucian 2026-10-29: "helps me quickly check
 * that I didn't check by mistake"). Search finds anything on the list, for any shop; Ask opens the
 * Shopping assistant's bar (the same as on the main screen); a product photo opens full size.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Camera, Check, ChevronDown, Lock, MessageSquare, Search, ShoppingBasket, X } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { SearchHeader } from '../ui/Controls';
import { useBusy } from '../ui/draft';
import { GROUPS, GROUP_NAMES, groupColours, groupOf } from './groups';
import { fold, newPhotoRef, type Item, type Op, type Product, type Purchase, type Store } from './logic';
import { photoUrl, shrinkPhoto } from './photos';
import { thumbOf, tripLists, type Trip } from './trip';
import { ShopLogo, ShopLogos } from './ShopLogo';

export function InStore({ trip, onTrip, items, stores, purchases, products, storeName, mode, apply, onPaid, onLeave, onChangeShop, askBar }: {
  trip: Trip; onTrip: (t: Trip) => void;
  items: Item[]; stores: Store[]; purchases: Purchase[]; products: Product[];
  storeName: (t: string) => string; mode: 'light' | 'dark';
  apply: (op: Op) => void; onPaid: () => void; onLeave: () => void; onChangeShop: () => void;
  /** The Shopping assistant's bar (ShopApp's AddBar), shown in a sheet from Ask. */
  askBar: ReactNode;
}) {
  const { here, maybe } = tripLists(items, trip.store, stores, purchases, products);
  const picked = new Set(trip.picked);
  // In the basket: what was picked and is still open (bought meanwhile by someone else: gone).
  const basket = items.filter(i => picked.has(i.id) && i.status === 'open');
  const toFind = here.filter(i => !picked.has(i.id));
  // Ticked things stay in their place; only those found by search (not on this shop's lists) sit in the basket box.
  const listed = new Set([...here.map(i => i.id), ...maybe.map(m => m.item.id)]);
  const fromSearch = basket.filter(i => !listed.has(i.id));
  const productOf = (id?: string) => (id ? products.find(p => p.id === id) : undefined);
  const toggle = (id: string) => onTrip({ ...trip, picked: picked.has(id) ? trip.picked.filter(x => x !== id) : [...trip.picked, id] });
  const [showMaybe, setShowMaybe] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const searching = query !== null && !!query.trim();
  const found = searching ? items.filter(i => i.status === 'open' && i.kind === 'buy' && fold(i.title).includes(fold(query.trim()))).slice(0, 30) : [];
  const [asking, setAsking] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  useBusy('shop-trip', true);   // never reload the app in the middle of a shop
  const n = basket.length + trip.extras.length;

  const addPhoto = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const data = await shrinkPhoto(f);
      const ref = newPhotoRef();
      apply({ op: 'photo', ref, data });   // goes up now, while still in the shop, or as soon as there is signal
      onTrip({ ...trip, extras: [...trip.extras, { ref, thumb: await thumbOf(f) }] });
    } catch { /* unreadable image: skipped */ }
    setBusy(false);
    if (camera.current) camera.current.value = '';
  };

  const byGroup = (list: Item[]) => GROUPS.map(g => ({ g, list: list.filter(i => groupOf(i) === g) })).filter(x => x.list.length > 0);
  const groups = byGroup(here);

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
              {toFind.length ? `${toFind.length} to find` : 'All found'}{n ? ` · ${n} in the basket` : ''}
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
              {found.map(i => <TripRow key={i.id} item={i} product={productOf(i.product)} inBasket={picked.has(i.id)} onTap={() => toggle(i.id)} onPhoto={setPhoto} />)}
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
              <h2 className="px-4 pb-1 pt-2 text-[13px] font-semibold text-pc-text-muted">For this shop · {toFind.length ? `${toFind.length} to find` : 'all found'}</h2>
              {groups.map(({ g, list }) => (
                <div key={g}>
                  {groups.length > 1 && <h3 className="px-4 pb-0.5 pt-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: groupColours(g, mode).ink }}>{GROUP_NAMES[g]}</h3>}
                  <div className="divide-y divide-[var(--pc-separator)]">
                    {list.map(i => <TripRow key={i.id} item={i} product={productOf(i.product)} inBasket={picked.has(i.id)} onTap={() => toggle(i.id)} onPhoto={setPhoto} />)}
                  </div>
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
              {showMaybe && (
                <div className="divide-y divide-[var(--pc-separator)]">
                  {maybe.map(m => <TripRow key={m.item.id} item={m.item} product={productOf(m.item.product)} why={m.why} shops={m.shops} storeName={storeName}
                    inBasket={picked.has(m.item.id)} onTap={() => toggle(m.item.id)} onPhoto={setPhoto} />)}
                </div>
              )}
            </section>
          )}

          {fromSearch.length + trip.extras.length > 0 && (
            <section className="mx-3 mt-4 overflow-hidden rounded-[12px] bg-pc-surface">
              <h2 className="flex items-center gap-1.5 px-4 pb-0.5 pt-2.5 text-[13px] font-semibold text-[var(--pc-accent-ink)]"><ShoppingBasket size={14} /> Also in the basket · {fromSearch.length + trip.extras.length}</h2>
              <div className="divide-y divide-[var(--pc-separator)]">
                {fromSearch.map(i => <TripRow key={i.id} item={i} product={productOf(i.product)} inBasket onTap={() => toggle(i.id)} onPhoto={setPhoto} />)}
              </div>
              {trip.extras.length > 0 && (
                <div className="px-4 pb-3 pt-2">
                  <p className="pb-2 text-[13px] text-pc-text-muted">Not on the list · the assistant adds them at Paid</p>
                  <div className="flex flex-wrap gap-3">
                    {trip.extras.map(e => (
                      <div key={e.ref} className="relative">
                        <button type="button" onClick={() => setPhoto(photoUrl(e.ref))} aria-label="See this photo full size">
                          <img src={e.thumb} alt="Something not on the list" className="h-16 w-16 rounded-[12px] object-cover" />
                        </button>
                        <button type="button" onClick={() => onTrip({ ...trip, extras: trip.extras.filter(x => x.ref !== e.ref) })}
                          className="absolute -right-3.5 -top-3.5 flex h-10 w-10 items-center justify-center" aria-label="Remove this photo">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pc-text text-pc-base shadow"><X size={13} strokeWidth={3} /></span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>}
      </main>

      <div className="shrink-0 border-t border-pc-border bg-pc-base px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void addPhoto(e.target.files)} />
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={() => camera.current?.click()}
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
          <button type="button" onClick={() => setPhoto(null)} aria-label="Close the photo" className="block w-full">
            <img src={photo} alt="" className="max-h-[85dvh] w-full rounded-[12px] bg-pc-surface object-contain" />
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

function TripRow({ item, product, why, shops = [], storeName = t => t, inBasket, onTap, onPhoto }: {
  item: Item; product?: Product; why?: string; shops?: string[]; storeName?: (t: string) => string; inBasket?: boolean;
  onTap: () => void; onPhoto?: (src: string) => void;
}) {
  const sub = [item.qty ? `×${item.qty}` : '', item.notes ?? '', why ?? ''].filter(Boolean);
  return (
    <div className="flex items-center transition-colors" style={inBasket ? { background: 'rgba(29,158,117,0.10)' } : undefined}>
      <button type="button" onClick={onTap} aria-pressed={!!inBasket}
        aria-label={inBasket ? `Take “${item.title}” out of the basket` : `Put “${item.title}” in the basket`}
        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-1 pr-2 text-left active:bg-[var(--pc-hover-strong)]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center">
          <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border-[1.75px] ${inBasket ? 'text-white' : 'border-pc-text-faint'}`}
            style={inBasket ? { borderColor: GREEN, background: GREEN } : undefined}>
            {inBasket && <Check size={16} strokeWidth={3} />}
          </span>
        </span>
        <span className={`min-w-0 flex-1 py-2 ${inBasket ? 'opacity-75' : ''}`}>
          <span className={`block truncate text-[17px] leading-snug ${inBasket ? 'line-through decoration-2' : ''}`} style={inBasket ? { color: GREEN } : undefined}>{item.title}</span>
          {(sub.length > 0 || shops.length > 0 || item.scope === 'private') && (
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] leading-tight text-pc-text-muted">
              {sub.length > 0 && <span className="truncate">{sub.join(' · ')}</span>}
              <ShopLogos tags={shops} storeName={storeName} size={18} />
              {item.scope === 'private' && <span className="inline-flex shrink-0 items-center gap-0.5"><Lock size={11} /> just me</span>}
            </span>
          )}
        </span>
      </button>
      {product?.photos[0] && (
        <button type="button" onClick={() => onPhoto?.(photoUrl(product.photos[0]))} aria-label={`See the photo of ${item.title}`} className="press mr-3 shrink-0">
          <img src={photoUrl(product.photos[0])} alt="" loading="lazy" className={`h-12 w-12 rounded-[8px] bg-pc-surface object-cover ${inBasket ? 'opacity-75' : ''}`} />
        </button>
      )}
    </div>
  );
}
