/**
 * Shopping (shop.stuparu.eu; ai.manager shopping-app.md, Phase A): one list for the household,
 * filtered by the shop you are in. Items carry tags, not lists; shared with the family unless
 * marked "just me"; returns pinned on top while there are any. Works offline (see useShop).
 * Same look and pieces as the oc desk: themes, Settings sheet, speak to type.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, ChevronRight, CloudOff, Lock, Mic, RefreshCw, Search, ShoppingBasket, Sparkles, Square, Undo2, X } from 'lucide-react';
import { getLook, lookVars, setLook, useMode, useThemeChrome, type Look } from '../app/themes';
import { SettingsSheet } from '../app/SettingsSheet';
import { canDictate, dictate, getDictationLang, type Dictation } from '../app/voice';
import { whoami } from '../app/api';
import { clearShareParam, pendingShareId, takeSharedContent } from '../share/shareInbox';
import { atStore, fold, newItemId, storeTagsOf, suggest, type Item, type Known, type Op, type Store } from './logic';
import { useShop } from './useShop';

const STORE_KEY = 'shop:store';
const readStore = () => { try { return localStorage.getItem(STORE_KEY) || null; } catch { return null; } };
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const daysTo = (d: string, today: string) => Math.round((Date.parse(d) - Date.parse(today || new Date().toISOString().slice(0, 10))) / 86_400_000);

export default function ShopApp() {
  const [look, setLookState] = useState<Look>(getLook);
  const mode = useMode(look.appearance);
  useThemeChrome(mode);
  useEffect(() => { document.title = 'Shopping'; }, []);
  return (
    <div style={lookVars(mode, look.accent)} className="h-dvh bg-pc-base text-pc-text antialiased">
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

  const tick = (i: Item) => apply(i.status === 'open' ? { op: 'tick', id: i.id, store: store ?? undefined } : { op: 'untick', id: i.id });

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
              <button type="button" onClick={() => setSearch(null)} className="px-2 text-[16px] text-pc-accent">Cancel</button>
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
              <button type="button" onClick={() => setSearch('')} className={iconBtn} aria-label="Search"><Search size={21} /></button>
              <button type="button" onClick={() => setSettings(true)} className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pc-accent text-[15px] font-semibold text-white active:opacity-80" aria-label="Settings">
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
            {q.length > 0 && found.length === 0 && <p className="px-8 py-12 text-center text-[15px] text-pc-text-muted">Nothing matches “{search?.trim()}”</p>}
            {found.length > 0 && <Rows items={found} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} />}
          </div>
        ) : (
          <>
            {returns.length > 0 && (
              <section className="mx-3 mt-3 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <h2 className="flex items-center gap-1.5 px-4 pb-0.5 pt-2.5 text-[13px] font-semibold text-amber-700 dark:text-amber-400"><Undo2 size={14} /> To return · {returns.length}</h2>
                <Rows items={returns} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} tinted />
              </section>
            )}

            {toBuy.length === 0 && returns.length === 0 && (
              <div className="flex flex-col items-center px-10 py-16 text-center">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.12)] text-pc-accent"><ShoppingBasket size={26} /></span>
                <p className="text-[17px] font-semibold">{store ? `Nothing to get at ${storeName(store)}` : 'The list is empty'}</p>
                <p className="mt-1 text-[15px] text-pc-text-muted">Type or say it below, the way you would say it: “we need oat milk and two kefirs from Lidl”. The assistant sorts it.</p>
              </div>
            )}

            {forThisShop.length > 0 && (
              <section className="pt-1">
                {store && anywhere.length > 0 && <h2 className="px-4 pb-0.5 pt-3 text-[13px] font-semibold text-pc-text-muted">At {storeName(store)}</h2>}
                <Rows items={forThisShop} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} hideStore={store} />
              </section>
            )}
            {anywhere.length > 0 && (
              <section>
                <h2 className="px-4 pb-0.5 pt-4 text-[13px] font-semibold text-pc-text-muted">Anywhere</h2>
                <Rows items={anywhere} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} />
              </section>
            )}

            {bought.length > 0 && (
              <section className="mt-3">
                <button type="button" onClick={() => setShowBought(b => !b)} className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[13px] font-semibold text-pc-text-muted" aria-expanded={showBought}>
                  {showBought ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Bought lately · {bought.length}
                </button>
                {showBought && <Rows items={bought} stores={stores} storeName={storeName} onTick={tick} onOpen={setEditing} today={snap.today} />}
              </section>
            )}
          </>
        )}
      </main>

      {search === null && (
        <AddBar key={prefill ?? ''} prefill={prefill} store={store} stores={stores} storeName={storeName} known={snap.known} items={snap.items}
          onAdd={(op) => { apply(op); setPrefill(null); }} />
      )}

      {editing && (() => {
        const item = snap.items.find(i => i.id === editing);
        return item ? <ItemSheet item={item} stores={stores} today={snap.today} onClose={() => setEditing(null)} apply={apply} /> : null;
      })()}
      {settings && (
        <SettingsSheet person={person || null} mode={mode} look={look} onLook={onLook} onLogout={() => { window.location.href = '/cdn-cgi/access/logout'; }} onClose={() => setSettings(false)} />
      )}
    </div>
  );
}

function Chip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button type="button" role="tab" aria-selected={on} onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors ${on ? 'bg-pc-accent text-white' : 'bg-pc-surface text-pc-text-secondary active:bg-[var(--pc-hover-strong)]'}`}>
      {label}{n > 0 && <span className={on ? 'text-white/80' : 'text-pc-text-muted'}>{n}</span>}
    </button>
  );
}

function Rows({ items, stores, storeName, onTick, onOpen, today, hideStore, tinted }: {
  items: Item[]; stores: Store[]; storeName: (t: string) => string; onTick: (i: Item) => void; onOpen: (id: string) => void; today: string; hideStore?: string | null; tinted?: boolean;
}) {
  return (
    <div className="divide-y divide-[var(--pc-separator)]">
      {items.map(i => <Row key={i.id} item={i} stores={stores} storeName={storeName} onTick={onTick} onOpen={onOpen} today={today} hideStore={hideStore} tinted={tinted} />)}
    </div>
  );
}

function Row({ item, stores, storeName, onTick, onOpen, today, hideStore, tinted }: {
  item: Item; stores: Store[]; storeName: (t: string) => string; onTick: (i: Item) => void; onOpen: (id: string) => void; today: string; hideStore?: string | null; tinted?: boolean;
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
          done || flash ? 'border-pc-accent bg-pc-accent text-white' : 'border-pc-text-faint'}`}>
          {(done || flash) && <Check size={15} strokeWidth={3} />}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[17px] leading-snug ${done || flash ? 'text-pc-text-muted line-through' : 'text-pc-text-primary'}`}>{item.title}</span>
          {item.sorting && (
            <span className="mt-0.5 flex items-center gap-1 text-[13px] leading-tight text-pc-accent">
              <Sparkles size={12} className="animate-pulse" /> The assistant is sorting this…
            </span>
          )}
          {!item.sorting && (sub.length > 0 || item.scope === 'private' || due !== null) && (
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] leading-tight text-pc-text-muted">
              {due !== null && !done && <span className={due <= 2 ? 'font-medium text-red-500' : 'text-amber-700 dark:text-amber-400'}>{due < 0 ? 'Overdue' : due === 0 ? 'Last day' : `by ${fmtDay(item.due_date!)}`}</span>}
              {sub.length > 0 && <span className="truncate">{sub.join(' · ')}</span>}
              {item.scope === 'private' && <span className="inline-flex shrink-0 items-center gap-0.5"><Lock size={11} /> just me</span>}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

function AddBar({ prefill, store, stores, storeName, known, items, onAdd }: {
  prefill: string | null; store: string | null; stores: Store[]; storeName: (t: string) => string; known: Known[]; items: Item[];
  onAdd: (op: Op) => void;
}) {
  const [text, setText] = useState(prefill ?? '');
  const [listening, setListening] = useState(false);
  const dict = useRef<Dictation | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hints = suggest(text, known, items);
  const tagsFor = (own: string[]) => (own.some(t => stores.some(s => s.tag === t)) || !store ? own : [...own, store]);

  /** A suggestion is added as it is; anything typed or said goes to the assistant to sort. */
  const add = (picked?: Known) => {
    if (listening) { dict.current?.stop(); setListening(false); }
    if (picked) {
      onAdd({ op: 'add', id: newItemId(), title: picked.title, tags: tagsFor(picked.tags.filter(t => stores.some(s => s.tag === t))) });
    } else {
      if (!text.trim()) return;
      onAdd({ op: 'add', id: newItemId(), title: text.trim(), tags: store ? [store] : [], smart: true, store: store ?? undefined });
    }
    setText('');
    input.current?.focus();
  };
  const toggleMic = () => {
    if (listening) { dict.current?.stop(); dict.current = null; setListening(false); return; }
    const base = text ? text.replace(/\s*$/, ' ') : '';
    const d = dictate(getDictationLang(), (t) => setText(base + t), () => { dict.current = null; setListening(false); });
    if (d) { dict.current = d; setListening(true); }
  };
  useEffect(() => () => dict.current?.stop(), []);

  return (
    <div className="shrink-0 border-t border-pc-border bg-pc-base px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
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
      <form onSubmit={e => { e.preventDefault(); add(); }} className="flex items-center gap-1.5">
        <div className={`flex h-11 min-w-0 flex-1 items-center rounded-[22px] border bg-pc-surface pl-4 pr-1 ${listening ? 'border-[rgba(var(--pc-accent-rgb),0.6)]' : 'border-transparent'}`}>
          <input ref={input} value={text} onChange={e => setText(e.target.value)} enterKeyHint="done" autoComplete="off"
            placeholder={listening ? 'Listening…' : store ? `Add for ${storeName(store)}, or say it` : 'Add something, or say it'} aria-label="New item"
            className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none focus:outline-none focus-visible:outline-none placeholder:text-pc-text-muted" />
          {text && !listening && (
            <button type="button" onClick={() => { setText(''); input.current?.focus(); }} className="flex h-9 w-8 items-center justify-center" aria-label="Clear">
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-pc-text-faint text-pc-surface"><X size={12} strokeWidth={3} /></span>
            </button>
          )}
          {canDictate() && (
            <button type="button" onClick={toggleMic} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${listening ? 'text-red-500' : 'text-pc-text-muted'}`} aria-label={listening ? 'Stop dictation' : 'Speak to type'}>
              {listening ? <Square size={14} fill="currentColor" /> : <Mic size={20} />}
            </button>
          )}
        </div>
        <button type="submit" disabled={!text.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pc-accent text-white transition-transform active:scale-95 disabled:opacity-40" aria-label="Add">
          <ArrowUp size={21} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}

function ItemSheet({ item, stores, today, onClose, apply }: {
  item: Item; stores: Store[]; today: string; onClose: () => void; apply: ReturnType<typeof useShop>['apply'];
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
          <button type="button" onClick={save} className="text-[16px] font-semibold text-pc-accent">Done</button>
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
              className={`h-8 rounded-full px-3.5 text-[14px] ${tags.includes(s.tag) ? 'bg-pc-accent text-white' : 'bg-pc-surface text-pc-text-secondary'}`}>{s.name}</button>
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
        {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="mt-2 block truncate px-1 text-[14px] text-pc-accent">{item.link}</a>}

        {item.status === 'open' ? (
          <button type="button" onClick={() => { apply({ op: 'drop', id: item.id }); onClose(); }} className="mt-5 h-12 w-full rounded-2xl bg-pc-surface text-[16px] font-medium text-red-500">
            Remove from the list
          </button>
        ) : (
          <button type="button" onClick={() => { apply({ op: 'untick', id: item.id }); onClose(); }} className="mt-5 h-12 w-full rounded-2xl bg-pc-surface text-[16px] font-medium text-pc-accent">
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
