/**
 * Shopping (shop.stuparu.eu; ai.manager shopping-app.md, Phase A): one list for the household,
 * filtered by the shop you are in. Items carry tags, not lists; shared with the family unless
 * marked "just me"; returns pinned on top while there are any. Works offline (see useShop).
 * Same look and pieces as the oc desk: themes, Settings sheet, speak to type.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Camera, Check, ChevronDown, ChevronRight, CloudOff, Images, Loader2, Lock, Mic, Package, RefreshCw, Refrigerator, Search, ShoppingBasket, Sparkles, Square, Undo2, X } from 'lucide-react';
import { getLook, lookVars, setLook, useMode, useThemeChrome, type Look } from '../app/themes';
import { SettingsSheet } from '../app/SettingsSheet';
import { SILENT, canRecord, record, type Recorder } from '../app/voice';
import { transcribeShop } from './useShop';
import { whoami } from '../app/api';
import { clearShareParam, pendingShareId, takeSharedContent } from '../share/shareInbox';
import { atStore, fold, newAskId, newItemId, newPhotoRef, plainReply, storeTagsOf, suggest, type Ask, type Item, type Known, type Op, type Product, type Store } from './logic';
import { NovaBadge, ProductRow, ProductSheet, ProductsSheet } from './Products';
import { photoUrl, shrinkPhoto } from './photos';
import { PantrySheet } from './PantrySheet';
import { addDays, daysUntil, newPantryId, whereIcon } from './pantry';
import { useShop } from './useShop';
import { disablePush, enablePush, getPushState, type PushState } from '../mobile/pushNotifications';

const STORE_KEY = 'shop:store';
const readStore = () => {
  // An arrival notification opens the app on /?store=<tag>: that shop, remembered from then on.
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('store');
  if (fromUrl) {
    url.searchParams.delete('store'); url.searchParams.delete('notice');
    window.history.replaceState(null, '', url.pathname + url.search);
    try { localStorage.setItem(STORE_KEY, fromUrl); } catch { /* fine */ }
    return fromUrl;
  }
  try { return localStorage.getItem(STORE_KEY) || null; } catch { return null; }
};
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const daysTo = (d: string, today: string) => Math.round((Date.parse(d) - Date.parse(today || new Date().toISOString().slice(0, 10))) / 86_400_000);

export default function ShopApp() {
  const [look, setLookState] = useState<Look>(getLook);
  const mode = useMode(look.appearance);
  useThemeChrome(mode);
  useEffect(() => { document.title = 'Shopping'; }, []);
  return (
    <div style={lookVars(mode, 'keep')} className="h-dvh bg-pc-base text-pc-text antialiased">
      <Shop look={look} mode={mode} onLook={l => { setLook(l); setLookState(l); }} />
    </div>
  );
}

function Shop({ look, mode, onLook }: { look: Look; mode: 'light' | 'dark'; onLook: (l: Look) => void }) {
  const [person, setPerson] = useState<string>(() => { try { return localStorage.getItem('shop:person') || ''; } catch { return ''; } });
  useEffect(() => { void whoami().then(p => { if (p) { setPerson(p); try { localStorage.setItem('shop:person', p); } catch { /* fine */ } } }); }, []);
  const { snap, queue, sync, apply, refresh } = useShop(person || 'me');
  const stores = snap.stores;
  const [store, setStoreState] = useState<string | null>(readStore);
  const setStore = (s: string | null) => { setStoreState(s); try { if (s) localStorage.setItem(STORE_KEY, s); else localStorage.removeItem(STORE_KEY); } catch { /* fine */ } };
  const [search, setSearch] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  // Notifications of the Shopping app itself (arrival at a shop); separate from oc's.
  const [pushState, setPushState] = useState<PushState | 'busy'>('off');
  useEffect(() => { void getPushState().then(setPushState).catch(() => setPushState('unsupported')); }, []);
  const togglePush = async () => {
    const from = pushState; setPushState('busy');
    try { setPushState(from === 'on' ? await disablePush() : await enablePush()); } catch { setPushState(from); }
  };
  const [showProducts, setShowProducts] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [showPantry, setShowPantry] = useState(false);
  // After ticking something that keeps a few days: offer to note it in the pantry (8 s).
  const [offer, setOffer] = useState<{ item: Item; days: number } | null>(null);
  const [showBought, setShowBought] = useState(false);
  const storeName = (tag: string) => stores.find(s => s.tag === tag)?.name ?? tag;

  // ---- what to show
  const open = snap.items.filter(i => i.status === 'open');
  const here = open.filter(i => atStore(i, store, stores));
  const returns = here.filter(i => i.kind === 'return').sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const toBuy = here.filter(i => i.kind === 'buy');
  const forThisShop = store ? toBuy.filter(i => storeTagsOf(i, stores).length > 0) : toBuy;
  const anywhere = store ? toBuy.filter(i => storeTagsOf(i, stores).length === 0) : [];
  const bought = snap.items.filter(i => i.status === 'bought' || i.status === 'returned')
    .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  const countAt = (tag: string | null) => open.filter(i => atStore(i, tag, stores)).length;
  const q = fold((search ?? '').trim());
  const found = q.length >= 1 ? snap.items.filter(i => i.status !== 'cancelled' && fold(`${i.title} ${i.notes ?? ''} ${i.tags.join(' ')}`).includes(q)) : [];

  const products = snap.products ?? [];
  const productOf = (id?: string) => (id ? products.find(p => p.id === id) : undefined);
  const foundProducts = q.length >= 1 ? products.filter(p => fold([p.name, p.brand, ...(p.aliases ?? [])].join(' ')).includes(q)) : [];
  const pantry = snap.pantry ?? [];
  const soon = pantry.filter(e => e.status === 'open' && e.due_date && daysUntil(e.due_date, snap.today || new Date().toISOString().slice(0, 10)) <= 2).length;
  const tick = (i: Item) => {
    apply(i.status === 'open' ? { op: 'tick', id: i.id, store: store ?? undefined } : { op: 'untick', id: i.id });
    if (i.status === 'open' && i.kind === 'buy' && i.shelf) setOffer({ item: i, days: i.shelf });
  };
  useEffect(() => {
    if (!offer) return;
    const t = window.setTimeout(() => setOffer(null), 9000);
    return () => window.clearTimeout(t);
  }, [offer]);

  // ---- shared from another app (share sheet): the text becomes the new item
  const [prefill, setPrefill] = useState<string | null>(null);
  useEffect(() => {
    const id = pendingShareId();
    if (!id) return;
    clearShareParam();
    if (id === 'failed') return;
    void takeSharedContent(id).then(s => { if (s?.text) setPrefill(s.text.trim()); });
  }, []);

  const syncLabel = sync === 'offline' ? (queue.length ? `Offline · ${queue.length} to send` : 'Offline')
    : sync === 'signed-out' ? 'Signed out' : queue.length ? `Sending ${queue.length}…` : null;
  const iconBtn = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-[var(--pc-hover-strong)]';

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[color-mix(in_srgb,var(--pc-bg-base)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-[52px] items-center gap-1 px-2">
          {search !== null ? (
            <>
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-pc-surface px-2.5">
                <Search size={16} className="shrink-0 text-pc-text-muted" />
                <input autoFocus type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" aria-label="Search" enterKeyHint="search"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none focus:outline-none focus-visible:outline-none placeholder:text-pc-text-muted [&::-webkit-search-cancel-button]:hidden" />
              </div>
              <button type="button" onClick={() => setSearch(null)} className="px-2 text-[16px] text-[var(--pc-accent-ink)]">Cancel</button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1 px-2">
                <h1 className="truncate text-[17px] font-semibold leading-tight">{store ? storeName(store) : 'Shopping'}</h1>
                <p className="flex items-center gap-1 truncate text-[12px] leading-tight text-pc-text-muted">
                  {syncLabel
                    ? <>{sync === 'offline' && <CloudOff size={12} />}{syncLabel}</>
                    : store ? `${countAt(store)} to get here` : `${open.length} on the list`}
                </p>
              </div>
              {sync === 'offline' || sync === 'signed-out'
                ? <button type="button" onClick={() => sync === 'signed-out' ? window.location.reload() : void refresh()} className={iconBtn} aria-label="Try again"><RefreshCw size={19} /></button>
                : null}
              <button type="button" onClick={() => setShowPantry(true)} className={`relative ${iconBtn}`} aria-label={soon ? `At home: ${soon} expiring soon` : 'At home'}>
                <Refrigerator size={21} />
                {soon > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{soon}</span>}
              </button>
              <button type="button" onClick={() => setShowProducts(true)} className={iconBtn} aria-label="Products"><Package size={21} /></button>
              <button type="button" onClick={() => setSearch('')} className={iconBtn} aria-label="Search"><Search size={21} /></button>
              <button type="button" onClick={() => setSettings(true)} className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pc-accent text-[15px] font-semibold text-[var(--pc-on-accent)] active:opacity-80" aria-label="Settings">
                {person ? person[0].toUpperCase() : '⋯'}
              </button>
            </>
          )}
        </div>
        {search === null && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 pt-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label="Shops">
            <Chip on={store === null} onClick={() => setStore(null)} label="All shops" n={open.length} />
            {stores.map(s => <Chip key={s.tag} on={store === s.tag} onClick={() => setStore(s.tag)} label={s.name} n={countAt(s.tag)} />)}
          </div>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto pb-3">
        {search !== null ? (
          <div className="pt-2">
            {q.length === 0 && <p className="px-8 py-12 text-center text-[15px] text-pc-text-muted">Search everything on the list and what was bought lately.</p>}
            {foundProducts.length > 0 && (
              <section className="mb-2">
                <h2 className="px-4 pb-0.5 pt-1 text-[13px] font-semibold text-pc-text-muted">Products</h2>
                <div className="divide-y divide-[var(--pc-separator)]">{foundProducts.map(p => <ProductRow key={p.id} p={p} onOpen={setProductId} storeName={storeName} />)}</div>
              </section>
            )}
            {q.length > 0 && found.length === 0 && foundProducts.length === 0 && <p className="px-8 py-12 text-center text-[15px] text-pc-text-muted">Nothing matches “{search?.trim()}”</p>}
            {found.length > 0 && <Rows items={found} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} productOf={productOf} />}
          </div>
        ) : (
          <>
            {returns.length > 0 && (
              <section className="mx-3 mt-3 overflow-hidden rounded-2xl bg-pc-surface">
                <h2 className="flex items-center gap-1.5 px-4 pb-0.5 pt-2.5 text-[13px] font-semibold text-[var(--pc-accent-ink)]"><Undo2 size={14} /> To return · {returns.length}</h2>
                <Rows items={returns} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} productOf={productOf} tinted />
              </section>
            )}

            {toBuy.length === 0 && returns.length === 0 && (
              <div className="flex flex-col items-center px-10 py-16 text-center">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.12)] text-[var(--pc-accent-ink)]"><ShoppingBasket size={26} /></span>
                <p className="text-[17px] font-semibold">{store ? `Nothing to get at ${storeName(store)}` : 'The list is empty'}</p>
                <p className="mt-1 text-[15px] text-pc-text-muted">Tell the assistant below, by voice or typing: “we need oat milk and two kefirs from Lidl”, “no more kefir”, “bought everything at Carrefour”.</p>
              </div>
            )}

            {forThisShop.length > 0 && (
              <section className="pt-1">
                {store && anywhere.length > 0 && <h2 className="px-4 pb-0.5 pt-3 text-[13px] font-semibold text-pc-text-muted">At {storeName(store)}</h2>}
                <Rows items={forThisShop} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} productOf={productOf} hideStore={store} />
              </section>
            )}
            {anywhere.length > 0 && (
              <section>
                <h2 className="px-4 pb-0.5 pt-4 text-[13px] font-semibold text-pc-text-muted">Anywhere</h2>
                <Rows items={anywhere} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} productOf={productOf} />
              </section>
            )}

            {bought.length > 0 && (
              <section className="mt-3">
                <button type="button" onClick={() => setShowBought(b => !b)} className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[13px] font-semibold text-pc-text-muted" aria-expanded={showBought}>
                  {showBought ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Bought lately · {bought.length}
                </button>
                {showBought && <Rows items={bought} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} productOf={productOf} />}
              </section>
            )}
          </>
        )}
      </main>

      {offer && search === null && (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-2xl bg-pc-text px-3 py-2 text-[14px] text-pc-base shadow-lg" role="status">
          <span className="text-[18px]" aria-hidden>{whereIcon('fridge')}</span>
          <span className="min-w-0 flex-1 leading-snug">At home until {new Date(`${addDays(snap.today || new Date().toISOString().slice(0, 10), offer.days)}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}? <span className="opacity-70">{offer.item.title}</span></span>
          <button type="button" onClick={() => { apply({ op: 'pantry-add', id: newPantryId(), title: offer.item.title, product: offer.item.product, qty: offer.item.qty, in_days: offer.days }); setOffer(null); }}
            className="h-8 shrink-0 rounded-full bg-pc-accent px-3 text-[13px] font-semibold text-[var(--pc-on-accent)]">Add</button>
          <button type="button" onClick={() => setOffer(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-70" aria-label="No"><X size={15} /></button>
        </div>
      )}
      {search === null && (
        <AddBar key={prefill ?? ''} prefill={prefill} store={store} stores={stores} known={snap.known} items={snap.items}
          asks={[...(snap.asks ?? []), ...queue.flatMap(op => (op.op === 'ask' && !(snap.asks ?? []).some(a => a.id === op.id)
            ? [{ id: op.id, text: op.text, photos: op.photos, status: (sync === 'offline' || sync === 'signed-out' ? 'queued' : 'working') as Ask['status'], ts: new Date().toISOString() }] : []))]}
          onAdd={(op) => { apply(op); setPrefill(null); }} />
      )}

      {editing && (() => {
        const item = snap.items.find(i => i.id === editing);
        return item ? <ItemSheet item={item} stores={stores} today={snap.today} onClose={() => setEditing(null)} apply={apply} product={productOf(item.product)} onProduct={(id) => { setEditing(null); setProductId(id); }} /> : null;
      })()}
      {showPantry && (
        <PantrySheet pantry={pantry} today={snap.today || new Date().toISOString().slice(0, 10)} onOp={op => apply(op)} onClose={() => setShowPantry(false)}
          onAsk={t => apply({ op: 'ask', id: newAskId(), text: `[Pantry] ${t}` })}
          lastAsk={[...(snap.asks ?? [])].reverse().find(a => a.text.startsWith('[Pantry]'))} />
      )}
      {showProducts && <ProductsSheet products={products} onOpen={setProductId} onClose={() => setShowProducts(false)} storeName={storeName}
        person={person || 'me'} onList={id => open.some(i => i.product === id)}
        onAdd={p => apply({ op: 'add', id: newItemId(), title: p.name, product: p.id, tags: store ? [store] : [] })} />}
      {productId && (() => {
        const p = productOf(productId);
        if (!p) return null;
        const onList = open.some(i => i.product === p.id);
        return <ProductSheet product={p} purchases={snap.purchases ?? []} stores={stores} onList={onList} onClose={() => setProductId(null)}
          liked={(p.fav_by ?? []).includes(person || 'me')} onLike={on => apply({ op: 'favorite', product: p.id, on })}
          onAdd={() => { apply({ op: 'add', id: newItemId(), title: p.name, product: p.id, tags: store ? [store] : [] }); setProductId(null); setShowProducts(false); }}
          onAsk={(t) => { setPrefill(t); setProductId(null); setShowProducts(false); }} />;
      })()}
      {settings && (
        <SettingsSheet fixedAccent person={person || null} mode={mode} look={look} onLook={onLook} push={pushState} onTogglePush={() => void togglePush()} onLogout={() => { window.location.href = '/cdn-cgi/access/logout'; }} onClose={() => setSettings(false)} />
      )}
    </div>
  );
}

function Chip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button type="button" role="tab" aria-selected={on} onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors ${on ? 'bg-pc-accent text-[var(--pc-on-accent)]' : 'bg-pc-surface text-pc-text-secondary active:bg-[var(--pc-hover-strong)]'}`}>
      {label}{n > 0 && <span className={on ? 'opacity-70' : 'text-pc-text-muted'}>{n}</span>}
    </button>
  );
}

function Rows({ items, stores, storeName, onTick, onOpen, today, hideStore, tinted, productOf }: {
  items: Item[]; stores: Store[]; storeName: (t: string) => string; onTick: (i: Item) => void; onOpen: (id: string) => void; today: string; hideStore?: string | null; tinted?: boolean;
  productOf: (id?: string) => Product | undefined;
}) {
  return (
    <div className="divide-y divide-[var(--pc-separator)]">
      {items.map(i => <Row key={i.id} item={i} stores={stores} storeName={storeName} onTick={onTick} onOpen={onOpen} today={today} hideStore={hideStore} tinted={tinted} product={productOf(i.product)} />)}
    </div>
  );
}

function Row({ item, stores, storeName, onTick, onOpen, today, hideStore, tinted, product }: {
  item: Item; stores: Store[]; storeName: (t: string) => string; onTick: (i: Item) => void; onOpen: (id: string) => void; today: string; hideStore?: string | null; tinted?: boolean;
  product?: Product;
}) {
  const [flash, setFlash] = useState(false);
  const done = item.status !== 'open';
  const shops = storeTagsOf(item, stores).filter(t => t !== hideStore).map(storeName);
  const other = item.tags.filter(t => !stores.some(s => s.tag === t));
  const due = item.kind === 'return' && item.due_date ? daysTo(item.due_date, today) : null;
  const tap = () => {
    if (done) { onTick(item); return; }
    setFlash(true);
    window.setTimeout(() => { onTick(item); setFlash(false); }, 320);   // let the check show first
  };
  const sub = [
    item.qty ? `×${item.qty}` : '',
    ...shops,
    ...other.map(t => `#${t}`),
    done && item.bought_on ? `${item.status === 'returned' ? 'returned' : 'bought'} ${item.bought_on === today ? 'today' : fmtDay(item.bought_on)}${item.bought_by ? ` · ${item.bought_by}` : ''}` : '',
  ].filter(Boolean);
  return (
    <div className={`flex items-center gap-1 pr-2 ${tinted ? '' : 'bg-pc-base'}`}>
      <button type="button" onClick={tap} className="flex h-12 w-12 shrink-0 items-center justify-center" aria-label={done ? `Put “${item.title}” back on the list` : `Mark “${item.title}” ${item.kind === 'return' ? 'returned' : 'bought'}`}>
        <span className={`flex h-[24px] w-[24px] items-center justify-center rounded-full border-[1.75px] transition-colors ${
          done || flash ? 'border-pc-accent bg-pc-accent text-[var(--pc-on-accent)]' : 'border-pc-text-faint'}`}>
          {(done || flash) && <Check size={15} strokeWidth={3} />}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[17px] leading-snug ${done || flash ? 'text-pc-text-muted line-through' : 'text-pc-text-primary'}`}>{item.title}</span>
          {(sub.length > 0 || item.scope === 'private' || due !== null || product?.health?.nova) && (
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] leading-tight text-pc-text-muted">
              {product?.health?.nova && <NovaBadge nova={product.health.nova} small />}
              {due !== null && !done && <span className={due <= 2 ? 'font-medium text-red-500' : 'text-amber-700 dark:text-amber-400'}>{due < 0 ? 'Overdue' : due === 0 ? 'Last day' : `by ${fmtDay(item.due_date!)}`}</span>}
              {sub.length > 0 && <span className="truncate">{sub.join(' · ')}</span>}
              {item.scope === 'private' && <span className="inline-flex shrink-0 items-center gap-0.5"><Lock size={11} /> just me</span>}
            </span>
          )}
        </span>
        {product?.photos[0] && <img src={photoUrl(product.photos[0])} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-pc-surface object-cover" />}
      </button>
    </div>
  );
}

function AddBar({ prefill, store, stores, known, items, asks, onAdd }: {
  prefill: string | null; store: string | null; stores: Store[]; known: Known[]; items: Item[];
  asks: Ask[]; onAdd: (op: Op) => void;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // The last few instructions (within half an hour of the newest), newest last, until dismissed.
  const newest = Math.max(0, ...asks.map(a => Date.parse(a.ts)));
  const recent = asks.filter(a => !hidden.has(a.id) && newest - Date.parse(a.ts) < 30 * 60_000).slice(-3);
  const [text, setText] = useState(prefill ?? '');
  // The mic records; Whisper (CT 104) writes the text, in whatever language or mix was spoken, and it
  // lands in the box to edit or add to. Nothing is sent until Send.
  const [mic, setMic] = useState<'idle' | 'starting' | 'recording' | 'writing'>('idle');
  const listening = mic === 'recording' || mic === 'starting';
  const rec = useRef<Recorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(true);   // false after 2.5 s of silence: say so while recording
  // Sending bumps the round, so a transcription that comes back after the text was sent is dropped.
  const round = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  // Two pickers: Android offers the camera only for a single image with `capture`, and only the
  // gallery when several images may be chosen, so "Take a photo" and "From the gallery" are separate.
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const hints = suggest(text, known, items);
  /** Photos (a label, a shelf, a receipt) go to the assistant with whatever is in the field. */
  const sendPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const refs: string[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      try { const ref = newPhotoRef(); onAdd({ op: 'photo', ref, data: await shrinkPhoto(f) }); refs.push(ref); } catch { /* unreadable image: skipped */ }
    }
    setBusy(false);
    if (camera.current) camera.current.value = '';
    if (gallery.current) gallery.current.value = '';
    if (refs.length === 0) return;
    onAdd({ op: 'ask', id: newAskId(), text: text.trim(), store: store ?? undefined, photos: refs });
    setText('');
  };
  const tagsFor = (own: string[]) => (own.some(t => stores.some(s => s.tag === t)) || !store ? own : [...own, store]);

  /** A suggestion is added as it is; anything typed or said is an instruction for the assistant. */
  const add = (picked?: Known) => {
    round.current++;
    if (rec.current) { const r = rec.current; rec.current = null; void r.stop(); setMic('idle'); }
    if (picked) {
      onAdd({ op: 'add', id: newItemId(), title: picked.title, tags: tagsFor(picked.tags.filter(t => stores.some(s => s.tag === t))) });
    } else {
      if (!text.trim()) return;
      onAdd({ op: 'ask', id: newAskId(), text: text.trim(), store: store ?? undefined });
    }
    setText('');
  };
  const toggleMic = async () => {
    setMicError(null);
    if (mic === 'idle') {
      setMic('starting');
      try { rec.current = await record(); setSecs(0); setMic('recording'); }
      catch { setMic('idle'); setMicError('Microphone not available: allow it for this app in Chrome’s site settings.'); }
      return;
    }
    if (mic !== 'recording' || !rec.current) return;
    const r = rec.current; rec.current = null;
    const mine = round.current;
    const silent = r.peak() < SILENT;
    setMic('writing');
    const audio = await r.stop();
    if (!audio) { setMic('idle'); return; }
    if (silent) {
      setMic('idle');
      setMicError(`The microphone recorded only silence${r.device ? ` (${r.device})` : ''}. With a Bluetooth headset or watch connected, try again with it off.`);
      return;
    }
    try {
      const t = (await transcribeShop(audio)).trim();
      if (round.current === mine && t) setText(prev => (prev.trim() ? `${prev.replace(/\s*$/, ' ')}${t}` : t));
      else if (!t) setMicError('Nothing was understood. Try again a bit closer.');
    } catch (e) {
      setMicError(e instanceof Error && e.message === 'offline' ? 'Speech needs a connection; type it for now.'
        : e instanceof Error && e.message === 'slow' ? 'Writing it took too long. Try a shorter piece.' : 'Could not turn it into text. Try again.');
    } finally { setMic('idle'); }
  };
  useEffect(() => {
    if (mic !== 'recording') return;
    const t = window.setInterval(() => setSecs(n => n + 1), 1000);
    const m = window.setInterval(() => {
      const r = rec.current; if (!r) return;
      setLevel(r.level());
      setHeard(r.peak() >= SILENT);
    }, 120);
    return () => { window.clearInterval(t); window.clearInterval(m); setLevel(0); setHeard(true); };
  }, [mic]);
  useEffect(() => () => { void rec.current?.stop(); }, []);
  // The box grows with the text, from two lines up to six.
  useEffect(() => {
    const ta = input.current; if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 56), 6 * 22 + 20)}px`;
  }, [text]);

  return (
    <div className="shrink-0 border-t border-pc-border bg-pc-base px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      {recent.length > 0 && (
        <div className="mb-2 space-y-1.5 px-1" aria-live="polite" aria-label="Assistant">
          {recent.map(a => (
            <div key={a.id} className="flex items-start gap-2 rounded-2xl bg-pc-surface px-3 py-2">
              <Sparkles size={15} className={`mt-0.5 shrink-0 text-[var(--pc-accent-ink)] ${a.status === 'working' || a.status === 'queued' ? 'animate-pulse' : ''}`} />
              <div className="min-w-0 flex-1 text-[14px] leading-snug">
                <p className="truncate text-pc-text-muted">{a.text ? `“${a.text}”` : ''}{a.photos?.length ? `${a.text ? ' · ' : ''}📷 ${a.photos.length} photo${a.photos.length > 1 ? 's' : ''}` : ''}</p>
                <p className={a.status === 'failed' ? 'text-red-500' : 'text-pc-text'}>
                  {a.status === 'queued' ? 'Waiting for a connection…' : a.status === 'working' ? 'Working on it…' : plainReply(a.reply) || 'Done.'}
                </p>
              </div>
              {(a.status === 'done' || a.status === 'failed') && (
                <button type="button" onClick={() => setHidden(h => new Set(h).add(a.id))} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-pc-text-muted" aria-label="Dismiss"><X size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {hints.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }} aria-label="Suggestions">
          {hints.map(h => (
            <button key={h.title} type="button" onClick={() => add(h)}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-pc-border px-3 text-[14px] active:bg-[var(--pc-hover-strong)]">
              {h.title}
            </button>
          ))}
        </div>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void sendPhotos(e.target.files)} />
      <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={e => void sendPhotos(e.target.files)} />
      {micError && <p className="mb-1.5 px-2 text-[13px] text-red-500" role="alert">{micError}</p>}
      <form onSubmit={e => { e.preventDefault(); add(); }} className="flex items-end gap-2">
        <div className="relative shrink-0">
          <button type="button" disabled={busy} onClick={() => setPhotoMenu(m => !m)} aria-expanded={photoMenu}
            className="mb-[6px] flex h-11 w-11 items-center justify-center rounded-full bg-pc-surface text-pc-text-secondary active:scale-95 disabled:opacity-50" aria-label="Photo of a label, a shelf or a receipt">
            <Camera size={21} />
          </button>
          {photoMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPhotoMenu(false)} />
              <div className="absolute bottom-12 left-0 z-30 w-56 overflow-hidden rounded-2xl border border-pc-border bg-pc-elevated shadow-xl" role="menu">
                <button type="button" role="menuitem" onClick={() => { setPhotoMenu(false); camera.current?.click(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-[var(--pc-hover-strong)]">
                  <Camera size={19} className="text-[var(--pc-accent-ink)]" /> Take a photo
                </button>
                <div className="mx-4 h-px bg-[var(--pc-separator)]" />
                <button type="button" role="menuitem" onClick={() => { setPhotoMenu(false); gallery.current?.click(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-[var(--pc-hover-strong)]">
                  <Images size={19} className="text-[var(--pc-accent-ink)]" /> From the gallery
                </button>
              </div>
            </>
          )}
        </div>
        <div className={`relative flex min-w-0 flex-1 items-end rounded-[22px] border bg-pc-surface pl-4 pr-1.5 ${listening ? 'border-[rgba(var(--pc-accent-rgb),0.8)]' : 'border-transparent'}`}>
          <textarea ref={input} value={text} rows={2} onChange={e => setText(e.target.value)} enterKeyHint="send" autoComplete="off"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }}
            readOnly={mic === 'writing'}
            placeholder={mic === 'recording' ? (secs >= 3 && !heard ? 'The mic hears nothing… Bluetooth headset or watch connected?' : `Listening ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}… tap the mic when done`) : mic === 'writing' ? 'Writing what you said…' : 'Say or type: add, change, remove…'} aria-label="Instruction for the assistant"
            className="min-h-[56px] min-w-0 flex-1 resize-none border-0 bg-transparent py-[9px] text-[16px] leading-[22px] shadow-none outline-none focus:outline-none focus-visible:outline-none placeholder:text-pc-text-muted" />
          {text && !listening && (
            <button type="button" onClick={() => { setText(''); input.current?.focus(); }} className="mb-[9px] flex h-8 w-7 shrink-0 items-center justify-center" aria-label="Clear">
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-pc-text-faint text-pc-surface"><X size={12} strokeWidth={3} /></span>
            </button>
          )}
          {text.trim() && (
            <button type="submit" className="mb-[6px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pc-accent text-[var(--pc-on-accent)] transition-transform active:scale-95" aria-label="Send">
              <ArrowUp size={19} strokeWidth={2.5} />
            </button>
          )}
        </div>
        {canRecord() && (
          <div className="relative shrink-0">
            <button type="button" onClick={() => void toggleMic()} disabled={mic === 'writing' || mic === 'starting'}
              aria-label={listening ? 'Done speaking' : mic === 'writing' ? 'Writing what you said' : 'Speak'} aria-pressed={listening}
              className={`relative flex h-[60px] w-[60px] items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${listening ? 'bg-red-500 text-white' : 'bg-pc-accent text-[var(--pc-on-accent)]'}`}>
              {mic === 'recording' && <span className="absolute inset-0 rounded-full bg-red-500/35 transition-transform duration-100" style={{ transform: `scale(${1 + Math.min(level * 1.6, 0.6)})` }} />}
              {mic === 'recording' ? <Square size={20} fill="currentColor" /> : mic === 'writing' ? <Loader2 size={26} className="animate-spin" /> : <Mic size={28} strokeWidth={2.2} />}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function ItemSheet({ item, stores, today, onClose, apply, product, onProduct }: {
  item: Item; stores: Store[]; today: string; onClose: () => void; apply: ReturnType<typeof useShop>['apply'];
  product?: Product; onProduct: (id: string) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [qty, setQty] = useState(item.qty ?? '');
  const [tags, setTags] = useState<string[]>(item.tags);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [isReturn, setIsReturn] = useState(item.kind === 'return');
  const [due, setDue] = useState(item.due_date ?? '');
  const [priv, setPriv] = useState(item.scope === 'private');
  const toggle = (t: string) => setTags(ts => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]));
  const others = tags.filter(t => !stores.some(s => s.tag === t));

  const save = () => {
    const kind = isReturn ? 'return' : 'buy';
    if (title !== item.title || qty !== (item.qty ?? '') || notes !== (item.notes ?? '') || due !== (item.due_date ?? '') || kind !== item.kind
      || tags.join(',') !== item.tags.join(',')) {
      apply({ op: 'edit', id: item.id, title, qty, notes, tags, due_date: isReturn ? due : '', kind });
    }
    if (priv !== (item.scope === 'private')) apply({ op: 'scope', id: item.id, scope: priv ? 'private' : 'shared' });
    onClose();
  };
  const field = 'w-full rounded-xl border-0 bg-pc-surface px-3.5 py-2.5 text-[16px] outline-none focus:outline-none focus-visible:outline-none';

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="absolute inset-0 bg-[var(--pc-scrim,rgba(0,0,0,0.3))]" onClick={save} />
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[22px] bg-pc-elevated px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl md:max-w-lg md:rounded-[22px]">
        <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-pc-text-faint/50 md:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={onClose} className="text-[16px] text-pc-text-muted">Cancel</button>
          <span className="text-[15px] font-semibold">{isReturn ? 'To return' : 'To buy'}</span>
          <button type="button" onClick={save} className="text-[16px] font-semibold text-[var(--pc-accent-ink)]">Done</button>
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} className={`${field} text-[18px] font-semibold`} aria-label="Name" />
        <div className="mt-2 flex gap-2">
          <input value={qty} onChange={e => setQty(e.target.value)} placeholder="Quantity" className={`${field} w-32`} aria-label="Quantity" />
          {item.status !== 'open' && item.bought_on && (
            <span className="flex items-center text-[13px] text-pc-text-muted">{item.status === 'returned' ? 'Returned' : 'Bought'} {item.bought_on === today ? 'today' : fmtDay(item.bought_on)}{item.bought_by ? ` by ${item.bought_by}` : ''}</span>
          )}
        </div>

        <p className="mb-1.5 mt-4 px-1 text-[13px] text-pc-text-muted">{isReturn ? "Where to return it" : "Where to get it"} <span className="text-pc-text-faint">(none = anywhere)</span></p>
        <div className="flex flex-wrap gap-2">
          {stores.map(s => (
            <button key={s.tag} type="button" onClick={() => toggle(s.tag)} aria-pressed={tags.includes(s.tag)}
              className={`h-8 rounded-full px-3.5 text-[14px] ${tags.includes(s.tag) ? 'bg-pc-accent text-[var(--pc-on-accent)]' : 'bg-pc-surface text-pc-text-secondary'}`}>{s.name}</button>
          ))}
          {others.map(t => (
            <button key={t} type="button" onClick={() => toggle(t)} className="h-8 rounded-full bg-pc-surface px-3.5 text-[14px] text-pc-text-secondary">#{t} ×</button>
          ))}
        </div>

        <div className="mt-4 divide-y divide-[var(--pc-separator)] rounded-2xl bg-pc-surface">
          <Toggle label="Just me" hint="Only you will see it" on={priv} onChange={setPriv} />
          <Toggle label="To return" hint="Something to take back to a shop" on={isReturn} onChange={setIsReturn} />
          {isReturn && (
            <label className="flex items-center justify-between gap-3 px-4 py-2.5 text-[16px]">
              Last day
              <input type="date" value={due} min={today || undefined} onChange={e => setDue(e.target.value)} className="rounded-lg bg-pc-elevated px-2 py-1 text-[15px] outline-none" />
            </label>
          )}
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (brand, size…)" rows={2} className={`${field} mt-3 resize-none`} aria-label="Notes" />
        {product && (
          <button type="button" onClick={() => onProduct(product.id)} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-pc-surface px-3 py-2.5 text-left">
            {product.photos[0] ? <img src={photoUrl(product.photos[0])} alt="" className="h-11 w-11 rounded-lg object-cover" /> : <Package size={22} className="text-pc-text-faint" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{product.name}</span>
              <span className="flex items-center gap-1.5 text-[13px] text-pc-text-muted"><NovaBadge nova={product.health?.nova} small />{product.brand}</span>
            </span>
            <ChevronRight size={17} className="text-pc-text-faint" />
          </button>
        )}
        {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="mt-2 block truncate px-1 text-[14px] text-[var(--pc-accent-ink)]">{item.link}</a>}

        {item.status === 'open' ? (
          <button type="button" onClick={() => { apply({ op: 'drop', id: item.id }); onClose(); }} className="mt-5 h-12 w-full rounded-2xl bg-pc-surface text-[16px] font-medium text-red-500">
            Remove from the list
          </button>
        ) : (
          <button type="button" onClick={() => { apply({ op: 'untick', id: item.id }); onClose(); }} className="mt-5 h-12 w-full rounded-2xl bg-pc-surface text-[16px] font-medium text-[var(--pc-accent-ink)]">
            Put back on the list
          </button>
        )}
        <p className="mt-3 text-center text-[12px] text-pc-text-faint">Added by {item.added_by ?? 'someone'}{item.created ? ` · ${fmtDay(item.created.slice(0, 10))}` : ''}</p>
      </div>
    </div>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
      <span className="flex-1"><span className="block text-[16px]">{label}</span><span className="block text-[12px] text-pc-text-muted">{hint}</span></span>
      <span className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? 'bg-[#34c759]' : 'bg-pc-text-faint/40'}`}>
        <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[22px]' : 'left-[2px]'}`} />
      </span>
    </button>
  );
}
