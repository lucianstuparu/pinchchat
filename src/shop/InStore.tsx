/**
 * In the shop (trip.ts): the list for the shelves. A tap puts a thing in the basket (and back);
 * nothing is bought until Paid, at the till. The camera adds things not on the list: their photos
 * go to the assistant at Paid, for the catalogue, the purchases and the pantry.
 */
import { useRef, useState } from 'react';
import { Camera, Check, ChevronDown, Lock, ShoppingBasket, X } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { useBusy } from '../ui/draft';
import { GROUPS, GROUP_NAMES, groupColours, groupOf } from './groups';
import { newPhotoRef, type Item, type Op, type Product, type Purchase, type Store } from './logic';
import { photoUrl, shrinkPhoto } from './photos';
import { thumbOf, tripLists, type Trip } from './trip';

export function InStore({ trip, onTrip, items, stores, purchases, products, storeName, mode, apply, onPaid, onLeave, onChangeShop }: {
  trip: Trip; onTrip: (t: Trip) => void;
  items: Item[]; stores: Store[]; purchases: Purchase[]; products: Product[];
  storeName: (t: string) => string; mode: 'light' | 'dark';
  apply: (op: Op) => void; onPaid: () => void; onLeave: () => void; onChangeShop: () => void;
}) {
  const { here, maybe } = tripLists(items, trip.store, stores, purchases, products, storeName);
  const picked = new Set(trip.picked);
  // In the basket: what was picked and is still open (bought meanwhile by someone else: gone).
  const basket = items.filter(i => picked.has(i.id) && i.status === 'open');
  const toFind = here.filter(i => !picked.has(i.id));
  const maybeLeft = maybe.filter(m => !picked.has(m.item.id));
  const productOf = (id?: string) => (id ? products.find(p => p.id === id) : undefined);
  const toggle = (id: string) => onTrip({ ...trip, picked: picked.has(id) ? trip.picked.filter(x => x !== id) : [...trip.picked, id] });
  const [showMaybe, setShowMaybe] = useState(true);
  const [leaving, setLeaving] = useState(false);
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

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-pc-base pt-[env(safe-area-inset-top)]">
        <div className="flex h-[56px] items-center gap-1 px-2">
          <button type="button" onClick={() => (n ? setLeaving(true) : onLeave())} aria-label="Leave the shop" className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <X size={22} />
          </button>
          <button type="button" onClick={onChangeShop} aria-haspopup="dialog" aria-label={`In ${storeName(trip.store)}. Change shop`} className="min-w-0 flex-1 px-1 text-left">
            <span className="flex items-center gap-1 text-[17px] font-semibold leading-tight"><span className="truncate">In {storeName(trip.store)}</span><ChevronDown size={16} className="shrink-0 opacity-60" /></span>
            <span className="block truncate text-[12px] leading-tight text-pc-text-muted">
              {toFind.length ? `${toFind.length} to find` : 'All found'}{n ? ` · ${n} in the basket` : ''}
            </span>
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto pb-4">
        {here.length === 0 && maybe.length === 0 && basket.length === 0 && (
          <div className="flex flex-col items-center px-10 py-14 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.12)] text-[var(--pc-accent-ink)]"><ShoppingBasket size={26} /></span>
            <p className="text-[17px] font-semibold">Nothing on the list for {storeName(trip.store)}</p>
            <p className="mt-1 text-[15px] text-pc-text-muted">Photograph what you buy with the camera below; it is added at Paid.</p>
          </div>
        )}

        {toFind.length > 0 && (
          <section className="mt-2">
            <h2 className="px-4 pb-1 pt-2 text-[13px] font-semibold text-pc-text-muted">For {storeName(trip.store)} · {toFind.length}</h2>
            {byGroup(toFind).map(({ g, list }) => (
              <div key={g}>
                {byGroup(toFind).length > 1 && <h3 className="px-4 pb-0.5 pt-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: groupColours(g, mode).ink }}>{GROUP_NAMES[g]}</h3>}
                <div className="divide-y divide-[var(--pc-separator)]">
                  {list.map(i => <TripRow key={i.id} item={i} product={productOf(i.product)} onTap={() => toggle(i.id)} />)}
                </div>
              </div>
            ))}
          </section>
        )}
        {here.length > 0 && toFind.length === 0 && (
          <p className="mx-4 mt-4 rounded-[12px] bg-pc-surface px-4 py-3 text-[15px]">Everything for {storeName(trip.store)} is in the basket.</p>
        )}

        {maybeLeft.length > 0 && (
          <section className="mt-3">
            <button type="button" onClick={() => setShowMaybe(s => !s)} aria-expanded={showMaybe}
              className="flex h-10 w-full items-center gap-1.5 px-4 text-left text-[13px] font-semibold text-pc-text-muted">
              <ChevronDown size={15} className={showMaybe ? '' : '-rotate-90'} /> Maybe here too · {maybeLeft.length}
            </button>
            {showMaybe && (
              <div className="divide-y divide-[var(--pc-separator)]">
                {maybeLeft.map(m => <TripRow key={m.item.id} item={m.item} product={productOf(m.item.product)} why={m.why} onTap={() => toggle(m.item.id)} />)}
              </div>
            )}
          </section>
        )}

        {n > 0 && (
          <section className="mx-3 mt-4 overflow-hidden rounded-[12px] bg-pc-surface">
            <h2 className="flex items-center gap-1.5 px-4 pb-0.5 pt-2.5 text-[13px] font-semibold text-[var(--pc-accent-ink)]"><ShoppingBasket size={14} /> In the basket · {n}</h2>
            <div className="divide-y divide-[var(--pc-separator)]">
              {basket.map(i => <TripRow key={i.id} item={i} product={productOf(i.product)} inBasket onTap={() => toggle(i.id)} />)}
            </div>
            {trip.extras.length > 0 && (
              <div className="px-4 pb-3 pt-2">
                <p className="pb-2 text-[13px] text-pc-text-muted">Not on the list · the assistant adds them at Paid</p>
                <div className="flex flex-wrap gap-3">
                  {trip.extras.map(e => (
                    <div key={e.ref} className="relative">
                      <img src={e.thumb} alt="Something not on the list" className="h-16 w-16 rounded-[12px] object-cover" />
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

function TripRow({ item, product, why, inBasket, onTap }: { item: Item; product?: Product; why?: string; inBasket?: boolean; onTap: () => void }) {
  const sub = [item.qty ? `×${item.qty}` : '', item.notes ?? '', why ?? ''].filter(Boolean);
  return (
    <button type="button" onClick={onTap} aria-pressed={!!inBasket}
      aria-label={inBasket ? `Take “${item.title}” out of the basket` : `Put “${item.title}” in the basket`}
      className={`flex min-h-[56px] w-full items-center gap-1 pr-3 text-left active:bg-[var(--pc-hover-strong)] ${inBasket ? '' : 'bg-pc-base'}`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center">
        <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border-[1.75px] ${inBasket ? 'border-pc-accent bg-pc-accent text-[var(--pc-on-accent)]' : 'border-pc-text-faint'}`}>
          {inBasket && <Check size={16} strokeWidth={3} />}
        </span>
      </span>
      <span className="min-w-0 flex-1 py-2">
        <span className={`block truncate text-[17px] leading-snug ${inBasket ? 'text-pc-text-muted' : ''}`}>{item.title}</span>
        {(sub.length > 0 || item.scope === 'private') && (
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] leading-tight text-pc-text-muted">
            <span className="truncate">{sub.join(' · ')}</span>
            {item.scope === 'private' && <span className="inline-flex shrink-0 items-center gap-0.5"><Lock size={11} /> just me</span>}
          </span>
        )}
      </span>
      {product?.photos[0] && <img src={photoUrl(product.photos[0])} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-[8px] bg-pc-surface object-cover" />}
    </button>
  );
}
