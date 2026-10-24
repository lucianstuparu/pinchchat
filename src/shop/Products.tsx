/**
 * The product catalogue (Shopping Phase B): products the Shopper built from label photos, with a
 * health note on the /health evidence base, nutrition per 100 g, ingredients as printed, and when,
 * where and at what price they were last bought. Shared by the household.
 */
import { Segmented } from '../ui/Controls';
import { CloseButton, Sheet } from '../ui/Sheet';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Euro, Heart, MessageSquare, Package, Plus, Search, X } from 'lucide-react';
import { fold, novaBadge, type Nutrition, type Product, type Purchase, type Store } from './logic';
import { photoUrl } from './photos';

const NUTRIENTS: Array<[keyof Nutrition, string, string]> = [
  ['kcal', 'Energy', 'kcal'], ['fat', 'Fat', 'g'], ['sat_fat', '  of which saturates', 'g'], ['carbs', 'Carbohydrates', 'g'],
  ['sugar', '  of which sugars', 'g'], ['fiber', 'Fibre', 'g'], ['protein', 'Protein', 'g'], ['salt', 'Salt', 'g'],
];
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const money = (v?: number, c?: string) => (v == null ? '' : `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c === 'EUR' || !c ? '€' : c}`);

export function NovaBadge({ nova, small }: { nova?: number; small?: boolean }) {
  const b = novaBadge(nova);
  if (!b) return null;
  return <span className={`inline-flex shrink-0 items-center rounded-[8px] font-semibold text-white ${b.cls} ${small ? 'h-[18px] px-1.5 text-[10px]' : 'h-6 px-2 text-[12px]'}`}>{b.label}</span>;
}

function Thumb({ p, size = 48 }: { p: Product; size?: number }) {
  return p.photos[0]
    ? <img src={photoUrl(p.photos[0])} alt="" loading="lazy" className="shrink-0 rounded-[12px] bg-pc-surface object-cover" style={{ width: size, height: size }} />
    : <span className="flex shrink-0 items-center justify-center rounded-[12px] bg-pc-surface text-pc-text-faint" style={{ width: size, height: size }}><Package size={size / 2.4} /></span>;
}


/** One screen, two tabs (2026-10-23): what is at home, and the catalogue of products. */
/** The home screen's three tabs: what is at home (food, with dates), the products, Things we own. */
export type HomeTab = 'home' | 'products' | 'owned';
export function HomeTabs({ tab, onTab, counts }: { tab: HomeTab; onTab: (t: HomeTab) => void; counts: Record<HomeTab, number> }) {
  return (
    <Segmented<HomeTab> value={tab} onChange={onTab} label="At home, products and things we own"
      options={[{ value: 'home', label: 'At home', count: counts.home }, { value: 'products', label: 'Products', count: counts.products }, { value: 'owned', label: 'Owned', count: counts.owned }]} />
  );
}

export function ProductRow({ p, onOpen, storeName, liked, onAdd, atHome }: { p: Product; onOpen: (id: string) => void; storeName: (t: string) => string; liked?: boolean; onAdd?: () => void; atHome?: string }) {
  return (
    <div className="flex items-center pr-3">
    <button type="button" onClick={() => onOpen(p.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
      <Thumb p={p} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5"><span className="truncate text-[16px] leading-snug">{p.name}</span>{liked && <Heart size={13} className="shrink-0 fill-red-500 text-red-500" aria-label="favourite" />}</span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-pc-text-muted">
          <NovaBadge nova={p.health?.nova} small />
          {atHome && <span className="shrink-0 rounded-[8px] bg-[rgba(var(--pc-accent-rgb),0.16)] px-1.5 text-[12px] font-semibold text-[var(--pc-accent-ink)]">{atHome} at home</span>}
          <span className="truncate">{[p.brand, p.size, p.stats ? `${money(p.stats.last_price, p.stats.currency)}${p.stats.last_store ? ` at ${storeName(p.stats.last_store)}` : ''}` : ''].filter(Boolean).join(' · ')}</span>
        </span>
      </span>
      {!onAdd && <ChevronRight size={17} className="shrink-0 text-pc-text-faint" />}
    </button>
    {onAdd && <button type="button" onClick={onAdd} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-pc-accent px-3 text-[13px] font-semibold text-[var(--pc-on-accent)]" aria-label={`Add ${p.name} to the list`}><Plus size={15} /> Add</button>}
    </div>
  );
}

/** All products, searchable. */
export function ProductsSheet({ products, onOpen, onClose, storeName, person, onList, onAdd, onTab, counts, atHome }: {
  products: Product[]; onOpen: (id: string) => void; onClose: () => void; storeName: (t: string) => string;
  person: string; onList: (id: string) => boolean; onAdd: (p: Product) => void;
  /** The other tabs of the same screen. */
  onTab: (t: HomeTab) => void; counts: Record<HomeTab, number>;
  /** How many of a product are at home ("x8"), from the inventory. */
  atHome: (id: string) => string | undefined;
}) {
  const [q, setQ] = useState('');
  const likedByMe = (p: Product) => (p.fav_by ?? []).includes(person);
  const favs = products.filter(likedByMe);
  const [tab, setTab] = useState<'fav' | 'all'>(favs.length ? 'fav' : 'all');
  const words = fold(q).split(/\s+/).filter(Boolean);
  const shown = products
    .filter(p => tab === 'all' || likedByMe(p))
    .filter(p => { const hay = fold([p.name, p.brand, ...(p.aliases ?? []), ...(p.tags ?? [])].join(' ')); return words.every(w => hay.includes(w)); })
    .sort((a, b) => (b.stats?.last_date ?? b.updated ?? '').localeCompare(a.stats?.last_date ?? a.updated ?? ''));
  return (
    <Sheet label="Products" onClose={onClose} className="flex h-[88dvh] flex-col md:h-[80dvh] md:max-w-lg">
        <div className="flex shrink-0 items-center gap-3 px-4 pb-1 pt-2">
          <HomeTabs tab="products" onTab={onTab} counts={counts} />
          <CloseButton onClick={onClose} />
        </div>
        <p className="shrink-0 px-4 pb-2 text-[13px] text-pc-text-muted">What each product is: label, health note, prices, when you last bought it.</p>
        <div className="mx-4 mb-2 flex shrink-0">
          <Segmented<'fav' | 'all'> size="s" value={tab} onChange={setTab} label="Which products"
            options={[{ value: 'fav', label: 'Favourites', count: favs.length }, { value: 'all', label: 'All', count: products.length }]} />
        </div>
        <div className="mx-4 mb-2 flex h-9 shrink-0 items-center gap-2 rounded-[12px] bg-pc-surface px-2.5">
          <Search size={16} className="shrink-0 text-pc-text-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" type="search"
            className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none placeholder:text-pc-text-muted [&::-webkit-search-cancel-button]:hidden" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {products.length === 0 ? (
            <div className="px-10 py-14 text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.18)] text-[var(--pc-accent-ink)]"><Package size={26} /></span>
              <p className="text-[17px] font-semibold">No products yet</p>
              <p className="mt-1 text-[15px] text-pc-text-muted">Take a photo of a label with the camera button: the assistant reads it, files the product and says how healthy it is.</p>
            </div>
          ) : shown.length === 0 && tab === 'fav' && !q.trim() ? (
            <p className="px-8 py-12 text-center text-[15px] text-pc-text-muted">No favourites yet. Open a product and tap the heart, or tell the assistant “I like this one” with a photo. They wait here, one tap from the list.</p>
          ) : shown.length === 0 ? (
            <p className="px-8 py-12 text-center text-[15px] text-pc-text-muted">Nothing matches “{q.trim()}”</p>
          ) : (
            <div className="divide-y divide-[var(--pc-separator)]">{shown.map(p => <ProductRow key={p.id} p={p} onOpen={onOpen} storeName={storeName} liked={likedByMe(p)} atHome={atHome(p.id)}
              onAdd={tab === 'fav' && !onList(p.id) ? () => onAdd(p) : undefined} />)}</div>
          )}
        </div>
    </Sheet>
  );
}

/** One product: photos, health, nutrition, ingredients, buying history, and what to do with it. */
export function ProductSheet({ product: p, purchases, stores, onClose, onAdd, onAsk, onList, liked, onLike }: {
  product: Product; purchases: Purchase[]; stores: Store[]; onClose: () => void;
  onAdd: () => void; onAsk: (text: string) => void; onList: boolean; liked: boolean; onLike: (on: boolean) => void;
}) {
  const [showIngredients, setShowIngredients] = useState(false);
  const [photo, setPhoto] = useState(0);
  const storeName = (t?: string) => (t ? stores.find(s => s.tag === t)?.name ?? t : '');
  const mine = purchases.filter(x => x.product === p.id).slice(0, 6);
  const n = p.nutrition;
  return (
    <Sheet label={p.name} onClose={onClose} z={50} className="max-h-[92dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] md:max-w-lg">
        {p.photos.length > 0 ? (
          <div className="relative">
            <img src={photoUrl(p.photos[photo] ?? p.photos[0])} alt={p.name} className="h-64 w-full rounded-t-[20px] bg-pc-surface object-contain md:rounded-t-[20px]" />
            {p.photos.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {p.photos.map((_, i) => <button key={i} type="button" onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} className={`h-2 w-2 rounded-full ${i === photo ? 'bg-white' : 'bg-white/50'}`} />)}
              </div>
            )}
            <button type="button" onClick={onClose} className="press absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white" aria-label="Close"><X size={16} strokeWidth={2.5} /></button>
          </div>
        ) : (
          <div className="flex justify-end px-4 pt-3"><CloseButton onClick={onClose} /></div>
        )}

        <div className="px-4 pt-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-pc-text-muted">{[p.brand, p.size].filter(Boolean).join(' · ')}</p>
              <h2 className="text-[22px] font-bold leading-tight">{p.name}</h2>
            </div>
            <button type="button" onClick={() => onLike(!liked)} aria-pressed={liked} aria-label={liked ? 'Remove from favourites' : 'Add to favourites'}
              className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pc-surface">
              <Heart size={21} className={liked ? 'fill-red-500 text-red-500' : 'text-pc-text-muted'} />
            </button>
          </div>

          {p.health && (p.health.nova || p.health.note) && (
            <div className="mt-3 rounded-[12px] bg-pc-surface px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <NovaBadge nova={p.health.nova} />
                {(p.health.flags ?? []).map(f => <span key={f} className="rounded-[8px] bg-pc-elevated px-2 py-0.5 text-[12px] text-pc-text-secondary">{f}</span>)}
              </div>
              {p.health.note && <p className="mt-2 text-[15px] leading-snug text-pc-text-secondary">{p.health.note}</p>}
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            {!onList && <button type="button" onClick={onAdd} className="flex flex-col items-center justify-center gap-1 rounded-[12px] bg-pc-accent py-3 text-[13px] font-semibold text-[var(--pc-on-accent)]"><Plus size={19} /> Add to list</button>}
            <button type="button" onClick={() => onAsk(`Despre ${p.name}: `)} className="flex flex-col items-center justify-center gap-1 rounded-[12px] bg-pc-surface py-3 text-[13px]"><MessageSquare size={19} className="text-[var(--pc-accent-ink)]" /> Ask about it</button>
            <button type="button" onClick={() => onAsk(`Am cumpărat ${p.name} cu `)} className="flex flex-col items-center justify-center gap-1 rounded-[12px] bg-pc-surface py-3 text-[13px]"><Euro size={19} className="text-[var(--pc-accent-ink)]" /> Log a price</button>
          </div>

          {n && Object.keys(n).length > 0 && (
            <>
              <p className="mb-1 mt-4 px-1 text-[13px] text-pc-text-muted">Per 100 g</p>
              <dl className="divide-y divide-[var(--pc-separator)] rounded-[12px] bg-pc-surface px-4">
                {NUTRIENTS.filter(([k]) => n[k] != null).map(([k, label, unit]) => (
                  <div key={k} className="flex justify-between py-2 text-[15px]">
                    <dt className={label.startsWith('  ') ? 'pl-3 text-pc-text-muted' : ''}>{label.trim()}</dt>
                    <dd className="tabular-nums">{n[k]} {unit}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {p.ingredients && (
            <div className="mt-3 rounded-[12px] bg-pc-surface px-4 py-3">
              <button type="button" onClick={() => setShowIngredients(s => !s)} className="flex w-full items-center justify-between text-[15px] font-medium" aria-expanded={showIngredients}>
                Ingredients {showIngredients ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
              </button>
              {showIngredients && <p className="mt-2 text-[15px] leading-snug text-pc-text-secondary">{p.ingredients}</p>}
            </div>
          )}

          {(p.stats || mine.length > 0) && (
            <>
              <p className="mb-1 mt-4 px-1 text-[13px] text-pc-text-muted">Bought {p.stats ? `${p.stats.times} time${p.stats.times === 1 ? '' : 's'} this year` : ''}</p>
              <div className="divide-y divide-[var(--pc-separator)] rounded-[12px] bg-pc-surface px-4">
                {mine.map(x => (
                  <div key={x.id} className="flex justify-between py-2 text-[15px]">
                    <span>{fmtDay(x.date)}{x.store ? ` · ${storeName(x.store)}` : ''}{x.by ? ` · ${x.by}` : ''}</span>
                    <span className="tabular-nums">{money(x.price, x.currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {p.health?.date && <p className="mt-3 text-center text-[12px] text-pc-text-faint">Health note from {fmtDay(p.health.date)} · added by {p.added_by ?? 'someone'}</p>}
        </div>
    </Sheet>
  );
}
