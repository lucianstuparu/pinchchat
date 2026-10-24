/**
 * Shopping (shop.stuparu.eu; ai.manager shopping-app.md, Phase A): one list for the household,
 * filtered by the shop you are in. Items carry tags, not lists; shared with the family unless
 * marked "just me"; returns pinned on top while there are any. Works offline (see useShop).
 * Same look and pieces as the oc desk: themes, Settings sheet, speak to type.
 */
import { failedTurn } from '../mobile/notice';
import { SpeechStatus } from '../app/SpeechStatus';
import { formatBytes, useNow } from '../ui/progress';
import { ProgressRow } from '../ui/ProgressRow';
import { useBusy, useDraft } from '../ui/draft';
import { Sheet } from '../ui/Sheet';
import { useExactSizes } from '../ui/useBackLayer';
import { AppHeader, IconButton, SearchHeader } from '../ui/Controls';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, ChevronRight, CloudOff, Images, Lock, Package, Plus, RefreshCw, Refrigerator, Search, ShoppingBasket, Sparkles, Store as StoreIcon, Undo2, X } from 'lucide-react';
import { getLook, lookVars, setLook, useMode, useThemeChrome, type Look } from '../app/themes';
import { SettingsSheet } from '../app/SettingsSheet';
import { UndoBar, type UndoInfo } from '../app/UndoBar';
import { FieldControls, PrimaryButton } from '../app/MicButton';
import { speechPlaceholder, useSpeech } from '../app/speech';
import { transcribeShop } from './useShop';
import { whoami } from '../app/api';
import { clearShareParam, pendingShareId, takeSharedContent } from '../share/shareInbox';
import { ShopPicker } from './ShopPicker';
import { atStore, fold, isWish, newAskId, newStore, newItemId, newPhotoRef, plainReply, storeTagsOf, suggest, type Ask, type Item, type Known, type Op, type Product, type Store } from './logic';
import { NovaBadge, ProductRow, ProductSheet, ProductsSheet } from './Products';
import { photoUrl, shrinkPhoto } from './photos';
import { PantrySheet } from './PantrySheet';
import { daysUntil } from './pantry';
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
  useExactSizes();
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
  const { snap, queue, sync, apply, refresh, upload, cancelUpload } = useShop(person || 'me');
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
  const [showBought, setShowBought] = useState(false);
  const storeName = (tag: string) => stores.find(s => s.tag === tag)?.name ?? tag;
  const [picking, setPicking] = useState(false);
  const [showWish, setShowWish] = useState(false);

  // ---- what to show (the wishlist, things wanted some day, stays out of the lists and counts)
  const open = snap.items.filter(i => i.status === 'open' && !isWish(i));
  const here = open.filter(i => atStore(i, store, stores));
  const wished = snap.items.filter(i => i.status === 'open' && isWish(i) && atStore(i, store, stores));
  // Phase E: what is usually bought about now; at a shop, that shop's usual things first.
  const openNow = new Set(snap.items.filter(i => i.status === 'open').flatMap(i => [fold(i.title), i.product ?? '']));
  const usual = (snap.usual ?? []).filter(u => !openNow.has(fold(u.title)) && !(u.product && openNow.has(u.product))).sort((a, b) => Number(!!store && b.tags.includes(store)) - Number(!!store && a.tags.includes(store)));
  const returns = here.filter(i => i.kind === 'return').sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const toBuy = here.filter(i => i.kind === 'buy');
  const forThisShop = store ? toBuy.filter(i => storeTagsOf(i, stores).length > 0) : toBuy;
  const anywhere = store ? toBuy.filter(i => storeTagsOf(i, stores).length === 0) : [];
  const bought = snap.items.filter(i => i.status === 'bought' || i.status === 'returned')
    .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  const countAt = (tag: string | null) => open.filter(i => atStore(i, tag, stores)).length;
  // Shops: one button that searches them all, and quick chips only for shops with something to get.
  const shopCounts = Object.fromEntries(stores.map(s => [s.tag, open.filter(i => storeTagsOf(i, stores).includes(s.tag)).length]));
  const boughtAt: Record<string, string> = {};
  for (const i of snap.items) if (i.bought_at && (i.bought_on ?? '') > (boughtAt[i.bought_at] ?? '')) boughtAt[i.bought_at] = i.bought_on ?? '';
  const quick = stores.filter(s => shopCounts[s.tag] > 0 && s.tag !== store).sort((a, b) => shopCounts[b.tag] - shopCounts[a.tag]).slice(0, 6);
  const q = fold((search ?? '').trim());
  const found = q.length >= 1 ? snap.items.filter(i => i.status !== 'cancelled' && fold(`${i.title} ${i.notes ?? ''} ${i.tags.join(' ')}`).includes(q)) : [];

  const products = snap.products ?? [];
  const productOf = (id?: string) => (id ? products.find(p => p.id === id) : undefined);
  const foundProducts = q.length >= 1 ? products.filter(p => fold([p.name, p.brand, ...(p.aliases ?? [])].join(' ')).includes(q)) : [];
  const pantry = snap.pantry ?? [];
  const soon = pantry.filter(e => e.status === 'open' && e.due_date && daysUntil(e.due_date, snap.today || new Date().toISOString().slice(0, 10)) <= 2).length;
  // Undo (the bar at the bottom): a tick or a removal is reopened with untick, offline too.
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const closeUndo = useCallback(() => setUndo(null), [setUndo]);
  const offerUndo = (i: Item, label: string) => setUndo({ key: Date.now(), label: `${label}: ${i.title}`, undo: () => apply({ op: 'untick', id: i.id }) });
  const tick = (i: Item) => {
    apply(i.status === 'open' ? { op: 'tick', id: i.id, store: store ?? undefined } : { op: 'untick', id: i.id });
    if (i.status === 'open') offerUndo(i, i.kind === 'return' ? 'Returned' : 'Bought');
  };

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

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[color-mix(in_srgb,var(--pc-bg-base)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        {search !== null ? (
          <SearchHeader value={search} onChange={setSearch} onCancel={() => setSearch(null)} placeholder="Search the list and products" />
        ) : (
          <AppHeader title={store ? storeName(store) : 'Shopping'} initial={person ? person[0].toUpperCase() : '…'} onSettings={() => setSettings(true)}
            subtitle={syncLabel ? <>{sync === 'offline' && <CloudOff size={12} />}{syncLabel}</> : store ? `${countAt(store)} to get here` : `${open.length} on the list`}
            actions={<>
              {(sync === 'offline' || sync === 'signed-out') && (
                <IconButton label="Try again" onClick={() => (sync === 'signed-out' ? window.location.reload() : void refresh())}><RefreshCw size={20} /></IconButton>
              )}
              <IconButton label={soon ? `At home and products: ${soon} expiring soon` : 'At home and products'} onClick={() => setShowPantry(true)}>
                <Refrigerator size={22} />
                {soon > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{soon}</span>}
              </IconButton>
              <IconButton label="Search" onClick={() => setSearch('')}><Search size={22} /></IconButton>
            </>} />
        )}
        {search === null && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 pt-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label="Shops">
            <button type="button" onClick={() => setPicking(true)} aria-haspopup="dialog" aria-label={store ? `Shop: ${storeName(store)}. Change shop` : 'Choose a shop'}
              className={`press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full pl-3 pr-2.5 text-[15px] font-medium ${store ? 'bg-pc-accent text-[var(--pc-on-accent)]' : 'bg-pc-surface text-pc-text active:bg-[var(--pc-hover-strong)]'}`}>
              <StoreIcon size={15} aria-hidden />{store ? storeName(store) : 'All shops'}<ChevronDown size={15} aria-hidden className="opacity-70" />
            </button>
            {store && <Chip on={false} onClick={() => setStore(null)} label="All shops" n={open.length} />}
            {quick.map(s => <Chip key={s.tag} on={false} onClick={() => setStore(s.tag)} label={s.name} n={shopCounts[s.tag]} />)}
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
            {usual.length > 0 && (
              <section className="mx-3 mt-3" aria-label="Usually about now">
                <h2 className="px-1 pb-1.5 text-[13px] font-semibold text-pc-text-muted">Usually about now</h2>
                <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                  {usual.map(u => (
                    <button key={u.key} type="button" onClick={() => {
                      const id = newItemId();
                      apply({ op: 'add', id, title: u.title, product: u.product, tags: store ? [store] : u.tags });
                      setUndo({ key: Date.now(), label: `Added: ${u.title}`, undo: () => apply({ op: 'drop', id }) });
                    }}
                      aria-label={`Add ${u.title} to the list`}
                      className="press flex h-12 shrink-0 items-center gap-2 rounded-[12px] border border-pc-border bg-pc-elevated pl-3 pr-2 text-left">
                      <span className="min-w-0">
                        <span className="block max-w-[160px] truncate text-[15px] font-medium leading-tight">{u.title}</span>
                        <span className="block text-[12px] leading-tight text-pc-text-muted">
                          {u.reason === 'favourite' ? (u.since === null ? 'favourite' : `favourite · ${u.since} d ago`) : `every ~${u.every} d · ${u.since} d ago`}
                        </span>
                      </span>
                      <Plus size={18} className="shrink-0 text-[var(--pc-accent-ink)]" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {returns.length > 0 && (
              <section className="mx-3 mt-3 overflow-hidden rounded-[12px] bg-pc-surface">
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

            {wished.length > 0 && (
              <section className="mt-3">
                <button type="button" onClick={() => setShowWish(b => !b)} className="flex h-10 w-full items-center gap-1.5 px-4 text-left text-[13px] font-semibold text-pc-text-muted" aria-expanded={showWish}>
                  {showWish ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Wishlist · {wished.length}
                </button>
                {showWish && <Rows items={wished} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} productOf={productOf} />}
              </section>
            )}

            {bought.length > 0 && (
              <section className="mt-3">
                <button type="button" onClick={() => setShowBought(b => !b)} className="flex h-10 w-full items-center gap-1.5 px-4 text-left text-[13px] font-semibold text-pc-text-muted" aria-expanded={showBought}>
                  {showBought ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Bought lately · {bought.length}
                </button>
                {showBought && <Rows items={bought} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} productOf={productOf} />}
              </section>
            )}
          </>
        )}
      </main>

      {search === null && upload && (
        <div className="shrink-0 px-3 pb-2">
          <ProgressRow tile={<img src={`data:image/jpeg;base64,${upload.thumb}`} alt="" className="h-full w-full object-cover" />}
            name={upload.refs.length === 1 ? 'Photo' : `${upload.refs.length} photos`}
            status={upload.done ? 'Sending…' : upload.total ? `Uploading ${Math.round((upload.sent / upload.total) * 100)}%` : 'Starting upload'}
            detail={upload.total ? `${formatBytes(upload.sent)} of ${formatBytes(upload.total)}` : undefined}
            progress={upload.done ? null : upload.total ? upload.sent / upload.total : null} onCancel={upload.done ? undefined : cancelUpload} cancelLabel="Cancel the upload" />
        </div>
      )}
      {search === null && !showPantry && <UndoBar info={undo} onClose={closeUndo} />}
      {search === null && (
        <AddBar key={prefill ?? ''} prefill={prefill} store={store} stores={stores} known={snap.known} items={snap.items}
          asks={[...(snap.asks ?? []), ...queue.flatMap(op => (op.op === 'ask' && !(snap.asks ?? []).some(a => a.id === op.id)
            ? [{ id: op.id, text: op.text, photos: op.photos, status: (sync === 'offline' || sync === 'signed-out' ? 'queued' : 'working') as Ask['status'], ts: new Date().toISOString() }] : []))]}
          onAdd={(op) => { apply(op); setPrefill(null); }} />
      )}

      {editing && (() => {
        const item = snap.items.find(i => i.id === editing);
        return item ? <ItemSheet item={item} stores={stores} today={snap.today} onClose={() => setEditing(null)} apply={op => { apply(op); if (op.op === 'drop') offerUndo(item, 'Removed'); }} product={productOf(item.product)} onProduct={(id) => { setEditing(null); setProductId(id); }} /> : null;
      })()}
      {showPantry && (
        <PantrySheet pantry={pantry} today={snap.today || new Date().toISOString().slice(0, 10)} onClose={() => setShowPantry(false)} footer={<UndoBar info={undo} onClose={closeUndo} />}
          onOp={op => {
            apply(op);
            if (op.op === 'pantry-close') {
              const e = pantry.find(x => x.id === op.id);
              setUndo({ key: Date.now(), label: `${op.how === 'used' ? 'Used' : 'Thrown away'}: ${e?.title ?? ''}`, undo: () => apply({ op: 'pantry-reopen', id: op.id }) });
            }
          }}
          onProducts={() => { setShowPantry(false); setShowProducts(true); }} productCount={products.length}
          onAsk={t => apply({ op: 'ask', id: newAskId(), text: `[Pantry] ${t}` })}
          lastAsk={[...(snap.asks ?? [])].reverse().find(a => a.text.startsWith('[Pantry]'))} />
      )}
      {showProducts && <ProductsSheet products={products} onOpen={setProductId} onClose={() => setShowProducts(false)} storeName={storeName}
        onInventory={() => { setShowProducts(false); setShowPantry(true); }} homeCount={pantry.filter(e => e.status === 'open').length}
        atHome={id => { const e = pantry.find(x => x.status === 'open' && x.product === id); return e ? (e.qty ? `×${e.qty}` : 'some') : undefined; }}
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
      {picking && (
        <ShopPicker stores={stores} counts={shopCounts} recent={boughtAt} current={store} allShops={open.length}
          onPick={tag => { setStore(tag); setPicking(false); }}
          onCreate={name => { apply({ op: 'shop', name }); setStore(newStore(name).tag); setPicking(false); }}
          onClose={() => setPicking(false)} />
      )}
      {settings && (
        <SettingsSheet fixedAccent person={person || null} mode={mode} look={look} onLook={onLook} push={pushState} onTogglePush={() => void togglePush()} onLogout={() => { window.location.href = '/cdn-cgi/access/logout'; }} onClose={() => setSettings(false)} />
      )}
    </div>
  );
}

function Chip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button type="button" role="tab" aria-selected={on} onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-medium transition-colors ${on ? 'bg-pc-accent text-[var(--pc-on-accent)]' : 'bg-pc-surface text-pc-text-secondary active:bg-[var(--pc-hover-strong)]'}`}>
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
        {product?.photos[0] && <img src={photoUrl(product.photos[0])} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-[8px] bg-pc-surface object-cover" />}
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
  const [openReply, setOpenReply] = useState<string | null>(null);
  const recent = asks.filter(a => !hidden.has(a.id) && newest - Date.parse(a.ts) < 30 * 60_000).slice(-2);   // the last two answers, so repeated adding does not pile up
  const now = useNow(recent.some(a => a.status === 'working'));   // ticks once a second while one is working
  const [text, setText] = useDraft('shop', prefill ?? undefined);
  // The mic, the same as oc's (app/speech.tsx): it writes into the box, Live or Whisper; nothing is
  // sent until Send.
  const speech = useSpeech(text, setText, transcribeShop);
  const input = useRef<HTMLTextAreaElement>(null);
  // Two pickers: Android offers the camera only for a single image with `capture`, and only the
  // gallery when several images may be chosen, so "Take a photo" and "From the gallery" are separate.
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  useBusy('shop-photos', busy);   // photos being prepared
  const hints = suggest(text, known, items);
  // Photos (a label, a shelf, a receipt) wait above the box until Send, so a note can go with them:
  // typed or said, "is this one healthy?", "add this, 2 of them", "the receipt from Lidl".
  const [staged, setStaged] = useState<Array<{ ref: string; data: string }>>([]);
  useBusy('shop', !!text.trim() || staged.length > 0 || speech.listening || speech.state === 'writing');
  const stagePhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const added: Array<{ ref: string; data: string }> = [];
    for (const f of Array.from(files).slice(0, 6)) {
      try { added.push({ ref: newPhotoRef(), data: await shrinkPhoto(f) }); } catch { /* unreadable image: skipped */ }
    }
    setBusy(false);
    if (camera.current) camera.current.value = '';
    if (gallery.current) gallery.current.value = '';
    setStaged(prev => [...prev, ...added].slice(0, 6));
    input.current?.focus();
  };
  const tagsFor = (own: string[]) => (own.some(t => stores.some(s => s.tag === t)) || !store ? own : [...own, store]);

  /** A suggestion is added as it is; anything typed or said is an instruction for the assistant. */
  const add = (picked?: Known) => {
    speech.cancel();
    if (picked) {
      onAdd({ op: 'add', id: newItemId(), title: picked.title, tags: tagsFor(picked.tags.filter(t => stores.some(s => s.tag === t))) });
    } else if (staged.length > 0) {
      for (const ph of staged) onAdd({ op: 'photo', ref: ph.ref, data: ph.data });
      onAdd({ op: 'ask', id: newAskId(), text: text.trim(), store: store ?? undefined, photos: staged.map(ph => ph.ref) });
      setStaged([]);
    } else {
      if (!text.trim()) return;
      onAdd({ op: 'ask', id: newAskId(), text: text.trim(), store: store ?? undefined });
    }
    setText('');
  };
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
            <div key={a.id} className="flex items-start gap-2 rounded-[12px] bg-pc-surface px-3 py-2">
              <Sparkles size={15} className={`mt-0.5 shrink-0 text-[var(--pc-accent-ink)] ${a.status === 'working' || a.status === 'queued' ? 'animate-pulse' : ''}`} />
              <div className="min-w-0 flex-1 text-[15px] leading-snug">
                <p className="truncate text-pc-text-muted">{a.text ? `“${a.text}”` : ''}{a.photos?.length ? `${a.text ? ' · ' : ''}${a.photos.length} photo${a.photos.length > 1 ? 's' : ''}` : ''}</p>
                {/* A reply reads at a glance: three lines, the rest on tap; a failure is one line. */}
                <p className={`${a.status === 'failed' ? 'text-red-500' : 'text-pc-text'} ${openReply === a.id ? '' : 'line-clamp-3'}`}
                  onClick={() => setOpenReply(o => (o === a.id ? null : a.id))}>
                  {a.status === 'queued' ? 'Waiting for a connection…'
                    : a.status === 'working' ? `Working on it · ${Math.max(0, Math.floor((now - Date.parse(a.ts)) / 1000))} s`
                    : openReply !== a.id && failedTurn(plainReply(a.reply) || '') ? failedTurn(plainReply(a.reply) || '')!.summary
                    : plainReply(a.reply) || 'Done.'}
                </p>
                {a.status === 'working' && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-[2px] bg-[var(--pc-separator)]" aria-hidden><div className="progress-indeterminate h-full w-1/3 rounded-[2px] bg-pc-accent" /></div>
                )}
              </div>
              {(a.status === 'done' || a.status === 'failed') && (
                <button type="button" onClick={() => setHidden(h => new Set(h).add(a.id))} className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted" aria-label="Dismiss"><X size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {hints.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }} aria-label="Suggestions">
          {hints.map(h => (
            <button key={h.title} type="button" onClick={() => add(h)}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-pc-border px-3 text-[15px] active:bg-[var(--pc-hover-strong)]">
              {h.title}
            </button>
          ))}
        </div>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void stagePhotos(e.target.files)} />
      <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={e => void stagePhotos(e.target.files)} />
      {staged.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto px-1 pt-1.5" aria-label="Photos to send">
          {staged.map(ph => (
            <div key={ph.ref} className="relative shrink-0">
              <img src={`data:image/jpeg;base64,${ph.data}`} alt="Photo to send" className="h-16 w-16 rounded-[12px] object-cover" />
              <button type="button" onClick={() => setStaged(prev => prev.filter(x => x.ref !== ph.ref))}
                className="absolute -right-3.5 -top-3.5 flex h-10 w-10 items-center justify-center" aria-label="Remove photo">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pc-text text-pc-base shadow"><X size={13} strokeWidth={3} /></span>
              </button>
            </div>
          ))}
          <p className="self-center pl-1 text-[13px] leading-snug text-pc-text-muted">Add a note if you like, then send.</p>
        </div>
      )}
      <SpeechStatus speech={speech} />
      {speech.error && <p className="mb-1.5 px-2 text-[13px] text-red-500" role="alert">{speech.error}</p>}
      <form onSubmit={e => { e.preventDefault(); add(); }} className="flex items-end gap-2">
        <div className="relative shrink-0">
          <button type="button" disabled={busy} onClick={() => setPhotoMenu(m => !m)} aria-expanded={photoMenu}
            className="press mb-[4px] flex h-12 w-12 items-center justify-center rounded-full bg-pc-surface text-pc-text-secondary disabled:opacity-50" aria-label="Photo of a label, a shelf or a receipt">
            <Camera size={24} />
          </button>
          {photoMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPhotoMenu(false)} />
              <div className="absolute bottom-[58px] left-0 z-30 w-56 overflow-hidden rounded-[12px] border border-pc-border bg-pc-elevated shadow-xl" role="menu">
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
        <div className={`relative flex min-w-0 flex-1 items-end rounded-[20px] border bg-pc-surface pl-4 pr-1.5 ${speech.listening ? 'border-[rgba(var(--pc-accent-rgb),0.8)]' : 'border-transparent'}`}>
          <textarea ref={input} value={text} rows={2} onChange={e => setText(e.target.value)} enterKeyHint="send" autoComplete="off"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }}
            readOnly={speech.state === 'writing'}
            placeholder={speechPlaceholder(speech, staged.length ? 'What about the photo? (optional)' : 'Say or type: add, change, remove…')} aria-label="Instruction for the assistant"
            className="min-h-[56px] min-w-0 flex-1 resize-none border-0 bg-transparent py-[9px] text-[16px] leading-[22px] shadow-none outline-none focus:outline-none focus-visible:outline-none placeholder:text-pc-text-muted" />
          <FieldControls speech={speech} hasText={!!text.trim()} onClear={() => { speech.cancel(); setText(''); input.current?.focus(); }} />
        </div>
        <div className="mb-[2px] shrink-0"><PrimaryButton speech={speech} canSend={!!text.trim() || staged.length > 0} onSend={() => add()} size={56} /></div>
      </form>
    </div>
  );
}

function ItemSheet({ item, stores, today, onClose, apply, product, onProduct }: {
  item: Item; stores: Store[]; today: string; onClose: () => void; apply: ReturnType<typeof useShop>['apply'];
  product?: Product; onProduct: (id: string) => void;
}) {
  useBusy('item-edit', true);   // an update never reloads over unsaved edits
  const [title, setTitle] = useState(item.title);
  const [qty, setQty] = useState(item.qty ?? '');
  const [tags, setTags] = useState<string[]>(item.tags);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [isReturn, setIsReturn] = useState(item.kind === 'return');
  const [due, setDue] = useState(item.due_date ?? '');
  const [priv, setPriv] = useState(item.scope === 'private');
  const toggle = (t: string) => setTags(ts => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]));
  const others = tags.filter(t => !stores.some(s => s.tag === t));
  const chosen = tags.filter(t => stores.some(s => s.tag === t));
  const [picking, setPicking] = useState(false);

  const save = () => {
    const kind = isReturn ? 'return' : 'buy';
    if (title !== item.title || qty !== (item.qty ?? '') || notes !== (item.notes ?? '') || due !== (item.due_date ?? '') || kind !== item.kind
      || tags.join(',') !== item.tags.join(',')) {
      apply({ op: 'edit', id: item.id, title, qty, notes, tags, due_date: isReturn ? due : '', kind });
    }
    if (priv !== (item.scope === 'private')) apply({ op: 'scope', id: item.id, scope: priv ? 'private' : 'shared' });
    onClose();
  };
  const field = 'w-full rounded-[12px] border-0 bg-pc-surface px-3.5 py-2.5 text-[16px] outline-none focus:outline-none focus-visible:outline-none';

  return (
    <Sheet label={item.title} onClose={save} className="max-h-[90dvh] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 md:max-w-lg">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={onClose} className="press h-10 px-1 text-[16px] text-pc-text-muted">Cancel</button>
          <span className="text-[15px] font-semibold">{isReturn ? 'To return' : 'To buy'}</span>
          <button type="button" onClick={save} className="press h-10 px-1 text-[16px] font-semibold text-[var(--pc-accent-ink)]">Done</button>
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} className={`${field} text-[17px] font-semibold`} aria-label="Name" />
        <div className="mt-2 flex gap-2">
          <input value={qty} onChange={e => setQty(e.target.value)} placeholder="Quantity" className={`${field} w-32`} aria-label="Quantity" />
          {item.status !== 'open' && item.bought_on && (
            <span className="flex items-center text-[13px] text-pc-text-muted">{item.status === 'returned' ? 'Returned' : 'Bought'} {item.bought_on === today ? 'today' : fmtDay(item.bought_on)}{item.bought_by ? ` by ${item.bought_by}` : ''}</span>
          )}
        </div>

        <p className="mb-1.5 mt-4 px-1 text-[13px] text-pc-text-muted">{isReturn ? "Where to return it" : "Where to get it"} <span className="text-pc-text-faint">(none = anywhere)</span></p>
        <div className="flex flex-wrap gap-2">
          {chosen.map(t => (
            <button key={t} type="button" onClick={() => toggle(t)} aria-label={`Remove ${stores.find(s => s.tag === t)?.name ?? t}`}
              className="press inline-flex h-8 items-center gap-1 rounded-full bg-pc-accent pl-3.5 pr-2.5 text-[15px] text-[var(--pc-on-accent)]">
              {stores.find(s => s.tag === t)?.name ?? t}<X size={14} aria-hidden />
            </button>
          ))}
          <button type="button" onClick={() => setPicking(true)} aria-haspopup="dialog"
            className="press inline-flex h-8 items-center gap-1 rounded-full bg-pc-surface pl-2.5 pr-3.5 text-[15px] text-[var(--pc-accent-ink)]">
            <Plus size={15} aria-hidden />{chosen.length ? 'Another shop' : 'Choose a shop'}
          </button>
          {others.map(t => (
            <button key={t} type="button" onClick={() => toggle(t)} aria-label={`Remove tag ${t}`} className="press inline-flex h-8 items-center gap-1 rounded-full bg-pc-surface pl-3.5 pr-2.5 text-[15px] text-pc-text-secondary">#{t}<X size={14} aria-hidden /></button>
          ))}
        </div>

        {picking && (
          <ShopPicker stores={stores.filter(s => !chosen.includes(s.tag))} current={null} z={50}
            onPick={tag => { if (tag) setTags(ts => [...ts, tag]); setPicking(false); }}
            onCreate={name => { apply({ op: 'shop', name }); const t = newStore(name).tag; setTags(ts => (ts.includes(t) ? ts : [...ts, t])); setPicking(false); }}
            onClose={() => setPicking(false)} />
        )}

        <div className="mt-4 divide-y divide-[var(--pc-separator)] rounded-[12px] bg-pc-surface">
          <Toggle label="Just me" hint="Only you will see it" on={priv} onChange={setPriv} />
          <Toggle label="To return" hint="Something to take back to a shop" on={isReturn} onChange={setIsReturn} />
          {isReturn && (
            <label className="flex items-center justify-between gap-3 px-4 py-2.5 text-[16px]">
              Last day
              <input type="date" value={due} min={today || undefined} onChange={e => setDue(e.target.value)} className="rounded-[8px] bg-pc-elevated px-2 py-1 text-[15px] outline-none" />
            </label>
          )}
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (brand, size…)" rows={2} className={`${field} mt-3 resize-none`} aria-label="Notes" />
        {product && (
          <button type="button" onClick={() => onProduct(product.id)} className="mt-3 flex w-full items-center gap-3 rounded-[12px] bg-pc-surface px-3 py-2.5 text-left">
            {product.photos[0] ? <img src={photoUrl(product.photos[0])} alt="" className="h-11 w-11 rounded-[8px] object-cover" /> : <Package size={22} className="text-pc-text-faint" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{product.name}</span>
              <span className="flex items-center gap-1.5 text-[13px] text-pc-text-muted"><NovaBadge nova={product.health?.nova} small />{product.brand}</span>
            </span>
            <ChevronRight size={17} className="text-pc-text-faint" />
          </button>
        )}
        {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="mt-2 block truncate px-1 text-[15px] text-[var(--pc-accent-ink)]">{item.link}</a>}

        {item.status === 'open' ? (
          <button type="button" onClick={() => { apply({ op: 'drop', id: item.id }); onClose(); }} className="mt-5 h-12 w-full rounded-[12px] bg-pc-surface text-[16px] font-medium text-red-500">
            Remove from the list
          </button>
        ) : (
          <button type="button" onClick={() => { apply({ op: 'untick', id: item.id }); onClose(); }} className="mt-5 h-12 w-full rounded-[12px] bg-pc-surface text-[16px] font-medium text-[var(--pc-accent-ink)]">
            Put back on the list
          </button>
        )}
        <p className="mt-3 text-center text-[12px] text-pc-text-faint">Added by {item.added_by ?? 'someone'}{item.created ? ` · ${fmtDay(item.created.slice(0, 10))}` : ''}</p>
    </Sheet>
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
