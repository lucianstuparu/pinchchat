/**
 * The list as cards, one per kind of thing, in two columns like Google Keep (three on a wide screen):
 * Groceries, House, Garden, Tech, Other, each in its own colour. A card lists what is still to get;
 * what was ticked today or yesterday folds under "+ N bought" at its foot, to untick a slip.
 * The columns are filled by size, the next card going under the shorter column; opening a card's
 * bought items never moves the other cards.
 */
import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { GROUPS, GROUP_NAMES, groupColours, groupOf, type Group } from './groups';
import { storeTagsOf, type Item, type Store } from './logic';
import { ShopLogos } from './ShopLogo';

function useColumns() {
  const q = '(min-width: 900px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide ? 3 : 2;
}

export function GroupCards({ items, ticked, stores, storeName, store, mode, onTick, onOpen }: {
  /** Open things to get, in the order to show (at this shop first). */
  items: Item[];
  /** Bought lately, shown folded in their card. */
  ticked: Item[];
  stores: Store[]; storeName: (t: string) => string; store: string | null; mode: 'light' | 'dark';
  onTick: (i: Item) => void; onOpen: (id: string) => void;
}) {
  const cols = useColumns();
  const [unfolded, setUnfolded] = useState<Set<Group>>(new Set());
  const cards = GROUPS.map(g => ({ g, open: items.filter(i => groupOf(i) === g), done: ticked.filter(i => groupOf(i) === g) }))
    .filter(c => c.open.length > 0);
  // Estimated heights (a row ~1.6 headers): stable, so unfolding a card never reshuffles the rest.
  const columns = Array.from({ length: cols }, () => ({ h: 0, cards: [] as typeof cards }));
  for (const c of cards) {
    const col = columns.reduce((a, b) => (b.h < a.h ? b : a));
    col.cards.push(c);
    col.h += 2 + c.open.reduce((n, i) => n + (i.title.length > 22 ? 2.2 : 1.6), 0) + (c.done.length ? 1 : 0);
  }
  const fold = (g: Group) => setUnfolded(s => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  return (
    <div className="flex items-start gap-2 px-2 pt-2">
      {columns.map((col, k) => (
        <div key={k} className="flex min-w-0 flex-1 flex-col gap-2">
          {col.cards.map(({ g, open, done }) => {
            const c = groupColours(g, mode);
            return (
              <section key={g} aria-label={GROUP_NAMES[g]} className="overflow-hidden rounded-[12px] border" style={{ background: c.card, borderColor: c.border }}>
                <h2 className="flex items-baseline justify-between gap-2 px-3 pb-0.5 pt-2.5 text-[15px] font-semibold" style={{ color: c.ink }}>
                  {GROUP_NAMES[g]}<span className="text-[13px] font-medium">{open.length}</span>
                </h2>
                <div className="pb-1">
                  {open.map(i => <CardRow key={i.id} item={i} ink={c.ink} card={c.card} stores={stores} storeName={storeName} hideStore={store} onTick={onTick} onOpen={onOpen} />)}
                </div>
                {done.length > 0 && (
                  <>
                    <button type="button" onClick={() => fold(g)} aria-expanded={unfolded.has(g)}
                      className="flex h-10 w-full items-center gap-1 px-3 text-left text-[13px] font-medium" style={{ color: c.ink }}>
                      {unfolded.has(g) ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}+ {done.length} bought
                    </button>
                    {unfolded.has(g) && (
                      <div className="pb-1">
                        {done.map(i => <CardRow key={i.id} item={i} ink={c.ink} card={c.card} stores={stores} storeName={storeName} hideStore={store} onTick={onTick} onOpen={onOpen} />)}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CardRow({ item, ink, card, stores, storeName, hideStore, onTick, onOpen }: {
  item: Item; ink: string; card: string; stores: Store[]; storeName: (t: string) => string; hideStore: string | null;
  onTick: (i: Item) => void; onOpen: (id: string) => void;
}) {
  const [flash, setFlash] = useState(false);
  const done = item.status !== 'open';
  const on = done || flash;
  const tap = () => {
    if (done) { onTick(item); return; }
    setFlash(true);
    window.setTimeout(() => { onTick(item); setFlash(false); }, 320);   // let the tick show first
  };
  const sub = item.qty ? [`×${item.qty}`] : [];
  const shops = storeTagsOf(item, stores).filter(t => t !== hideStore);
  return (
    <div className="flex items-start">
      <button type="button" onClick={tap} className="flex h-10 w-10 shrink-0 items-center justify-center"
        aria-label={done ? `Put “${item.title}” back on the list` : `Mark “${item.title}” bought`}>
        <span className="flex h-[19px] w-[19px] items-center justify-center rounded-[5px] border-[1.75px] transition-colors"
          style={{ borderColor: ink, background: on ? ink : 'transparent' }}>
          {on && <Check size={13} strokeWidth={3.25} style={{ color: card }} />}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 py-[9px] pr-3 text-left">
        <span className={`line-clamp-3 break-words text-[16px] leading-[21px] ${on ? 'line-through opacity-60' : 'text-pc-text-primary'}`}>{item.title}</span>
        {(sub.length > 0 || shops.length > 0 || item.scope === 'private') && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] leading-tight" style={{ color: ink }}>
            {item.scope === 'private' && <Lock size={10} aria-label="just me" className="shrink-0" />}
            {sub.length > 0 && <span className="truncate">{sub.join(' · ')}</span>}
            <ShopLogos tags={shops} storeName={storeName} size={18} />
          </span>
        )}
      </button>
    </div>
  );
}
