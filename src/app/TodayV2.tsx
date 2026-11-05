/**
 * Today, oc v2 (my.design v2/oc-v2-brief.md §6.1; state table in ai.manager oc-app-design.md): crucial, the tiles, Passing by.
 * No data fetching: the desk passes it in, so the harness (tools/harness/today.html) shows the same screen with sample data.
 * Late is ink with a flag, never red. Tiles keep their place: they are laid out by index, so nothing moves when one opens.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Ban, Check, Clock, Flag, LayoutGrid, MoreHorizontal, PanelTop } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { ObjectFace } from '../kit2/ObjectFace';
import { formatAmount, formatDay, type NowItem, type TodayData } from './api';
import { columnsFor, whenOf } from './todayRules';

function Meta({ item, today }: { item: NowItem; today: string }) {
  const when = whenOf(item, today);
  if (!when) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] leading-tight ${when.tone === 'late' ? 'font-semibold text-pc-text' : when.tone === 'today' ? 'font-semibold text-[var(--pc-today)]' : 'text-pc-text-muted'}`}>
      {when.tone === 'late' && <Flag size={12} strokeWidth={2.5} aria-hidden />}{when.text}
    </span>
  );
}

function Tick({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onDone(); }} aria-label={`Done: ${title}`}
      className="press -m-[9px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
      <span className="block h-[22px] w-[22px] rounded-full border-2 border-pc-text-faint" />
    </button>
  );
}

interface Handlers {
  onDone: (i: NowItem) => void;
  onOpen: (i: NowItem) => void;
  onMenu: (i: NowItem) => void;
}

/** A long press opens the menu (0.4 s, a short vibration where the phone has it); moving the finger cancels it. */
function useHold(onHold: () => void) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const stop = () => { if (timer.current !== null) window.clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  return {
    held,
    bind: {
      onPointerDown: () => { held.current = false; stop(); timer.current = window.setTimeout(() => { held.current = true; navigator.vibrate?.(15); onHold(); }, 400); },
      onPointerMove: (e: React.PointerEvent) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 4) stop(); },
      onPointerUp: stop, onPointerCancel: stop, onPointerLeave: stop,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}

function MoreButton({ item, onMenu }: { item: NowItem; onMenu: (i: NowItem) => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onMenu(item); }} aria-label={`More: ${item.glance_title ?? item.title}`}
      className="press -my-2.5 -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted">
      <MoreHorizontal size={18} aria-hidden />
    </button>
  );
}

export function Tile({ item, today, onDone, onOpen, onMenu }: { item: NowItem; today: string } & Handlers) {
  const title = item.glance_title ?? item.title;
  const hold = useHold(() => onMenu(item));
  return (
    <div {...hold.bind} onClick={() => { if (!hold.held.current) onOpen(item); }} role="group" aria-label={title}
      className="cursor-pointer select-none rounded-[16px] bg-pc-elevated px-3 pb-2.5 pt-3 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.05)]">
      <div className="flex items-start gap-2.5">
        <Tick title={title} onDone={() => onDone(item)} />
        <p className="min-w-0 flex-1 break-words text-[15px] font-bold leading-[1.25]">{title}</p>
        {item.face && <ObjectFace face={item.face} size={32} />}
      </div>
      <div className="mt-1.5 flex min-h-5 items-center justify-between pl-8">
        <Meta item={item} today={today} />
        <span className="ml-auto"><MoreButton item={item} onMenu={onMenu} /></span>
      </div>
    </div>
  );
}

function CrucialTile({ item, today, large, short, onDone, onOpen, onMenu }: { item: NowItem; today: string; large: boolean; short: boolean } & Handlers) {
  const title = item.glance_title ?? item.title;
  const hold = useHold(() => onMenu(item));
  return (
    <div {...hold.bind} onClick={() => { if (!hold.held.current) onOpen(item); }} role="group" aria-label={title}
      className={`flex cursor-pointer select-none items-center gap-3 rounded-[16px] px-4 ${short ? 'py-1.5' : 'py-3'}`} style={{ background: 'var(--pc-accent-tint)' }}>
      <Tick title={title} onDone={() => onDone(item)} />
      <div className="min-w-0 flex-1">
        <p className={`font-extrabold leading-[1.2] ${large ? 'break-words text-[17px]' : short ? 'truncate text-[15px]' : 'break-words text-[15px]'}`}>{title}</p>
        <div className="mt-1 flex min-h-5 items-center"><Meta item={item} today={today} /></div>
      </div>
      {item.face && <ObjectFace face={item.face} size={large ? 64 : short ? 32 : 44} glow={large} />}
      <MoreButton item={item} onMenu={onMenu} />
    </div>
  );
}

const Heading = ({ children }: { children: ReactNode }) => <h2 className="px-1 pb-2 text-[13px] font-bold uppercase tracking-wide text-pc-text-muted">{children}</h2>;

function PassingPill({ item, today, onOpen }: { item: NowItem; today: string; onOpen: (i: NowItem) => void }) {
  const amount = formatAmount(item.amount, item.currency);
  const when = !item.due_date ? 'this month' : item.due_date === today ? 'today' : formatDay(item.due_date);
  return (
    <button type="button" onClick={() => onOpen(item)}
      className="press flex h-12 max-w-[220px] shrink-0 items-center gap-2 rounded-full bg-[var(--pc-hover-strong)] py-1 pl-1.5 pr-4 text-left">
      {item.face && <ObjectFace face={item.face} size={36} />}
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight">{item.face?.name || (item.glance_title ?? item.title)}{amount ? ` ${amount}` : ''}</span>
        <span className="block truncate text-[12px] leading-tight text-pc-text-secondary">{when} · automatic</span>
      </span>
    </button>
  );
}

const PILLS = 4;

export interface TodayProps extends Handlers {
  data: TodayData | null;
  mode: 'light' | 'dark';
  expired?: boolean;
  /** The grid button, "+n" and "n more": the whole list (Everything, once it exists). */
  onEverything: () => void;
  onSettings: () => void;
  initial?: string;
  notice?: ReactNode;
}

export function TodayV2({ data, mode, expired, onEverything, onSettings, initial, notice, onDone, onOpen, onMenu }: TodayProps) {
  const handlers = { onDone, onOpen, onMenu };
  const box = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(2);
  // Short screens (320×480, a phone on its side): the band stays compact, so the list keeps some room (height budget, 03).
  const [short, setShort] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => { setCols(el.clientWidth >= 560 ? 3 : 2); setShort(el.clientHeight < 560); };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const today = data?.today ?? '';
  return (
    <div ref={box} className="h-full overflow-y-auto overscroll-contain" style={{ background: mode === 'dark' ? 'var(--pc-bg-base)' : 'var(--pc-bg-surface)' }}>
      <header className="flex items-center gap-1 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onEverything} aria-label="Everything" className="press flex h-10 w-10 items-center justify-center rounded-full"><LayoutGrid size={22} aria-hidden /></button>
        <h1 className="min-w-0 flex-1 truncate pl-1 text-[22px] font-bold">Today</h1>
        <span className="shrink-0 pr-1 text-[13px] text-pc-text-muted">{date}</span>
        <button type="button" onClick={onSettings} aria-label="Settings" className="press flex h-10 w-10 items-center justify-center rounded-full">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--pc-hover-strong)] text-[13px] font-semibold">{initial ?? <PanelTop size={15} aria-hidden />}</span>
        </button>
      </header>
      {notice}
      <div className="space-y-5 px-3 pb-4 pt-2">
        {!data ? (
          expired ? <p className="px-1 py-8 text-center text-[15px] text-pc-text-muted">Signed out of the lists. Open the app again to sign in.</p> : (
            <section aria-label="Loading" aria-busy className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-[84px] animate-pulse rounded-[16px] bg-pc-elevated" />)}
            </section>
          )
        ) : <>
          {data.crucial.length > 0 && (
            <section aria-label="Crucial">
              <h2 className="flex items-center gap-1.5 px-1 pb-2 text-[13px] font-bold uppercase tracking-wide text-[var(--pc-accent-ink)]"><Flag size={13} strokeWidth={2.5} aria-hidden /> Crucial</h2>
              <div className="space-y-2">{data.crucial.map((it, i) => <CrucialTile key={it.id} item={it} today={today} large={i === 0 && !short} short={short} {...handlers} />)}</div>
            </section>
          )}
          <section aria-label="To do">
            <Heading>To do</Heading>
            {data.todo.length === 0
              ? <p className="px-1 py-4 text-[15px] text-pc-text-muted">{data.crucial.length ? 'Nothing else for today.' : 'Nothing needs you today.'}</p>
              : <div className="flex items-start gap-2">{columnsFor(data.todo, cols).map((col, c) => (
                  <div key={c} className="min-w-0 flex-1 space-y-2">{col.map(it => <Tile key={it.id} item={it} today={today} {...handlers} />)}</div>
                ))}</div>}
            {data.later_count > 0 && (
              <button type="button" onClick={onEverything} className="press mt-1 flex h-10 items-center px-1 text-[13px] font-medium text-pc-text-muted">{data.later_count} more in the list</button>
            )}
          </section>
          {data.passing_by.length > 0 && (
            <section aria-label="Passing by">
              <Heading>Passing by</Heading>
              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                {data.passing_by.slice(0, PILLS).map(it => <PassingPill key={it.id} item={it} today={today} onOpen={onOpen} />)}
                {data.passing_by.length > PILLS && (
                  <button type="button" onClick={onEverything} aria-label={`${data.passing_by.length - PILLS} more passing by`}
                    className="press flex h-12 shrink-0 items-center rounded-full bg-[var(--pc-hover-strong)] px-4 text-[13px] font-semibold">+{data.passing_by.length - PILLS}</button>
                )}
              </div>
            </section>
          )}
        </>}
      </div>
    </div>
  );
}

/** The tile's menu (§6.3, drag comes later): every entry offers Undo in the desk. Two crucial already: which one goes? */
export function TileMenu({ item, position, count, isCrucial, crucial, onClose, onCrucial, onMove, onLater, onOpen, onDrop }: {
  item: NowItem; position: number; count: number; isCrucial: boolean; crucial: NowItem[];
  onClose: () => void;
  /** Rejects with "two already" when the two places are taken. */
  onCrucial: (on: boolean, replace?: string) => Promise<void>;
  onMove: (to: number) => void; onLater: () => void; onOpen: () => void; onDrop: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const title = item.glance_title ?? item.title;
  const row = 'press flex h-12 w-full items-center gap-3 px-1 text-left text-[16px]';
  const make = (replace?: string) => {
    onCrucial(true, replace).then(onClose).catch((e: unknown) => { if (e instanceof Error && e.message === 'two already') setAsking(true); else onClose(); });
  };
  return (
    <Sheet label={title} onClose={onClose} className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:max-w-sm">
      <p className="truncate px-1 pb-2 pt-1 text-[13px] text-pc-text-muted">{item.n != null ? `${item.n} · ` : ''}{title}</p>
      {asking ? (
        <div role="group" aria-label="Which one does it replace?">
          <p className="px-1 pb-2 text-[16px] font-semibold">Which one does it replace?</p>
          {crucial.map(c => (
            <button key={c.id} type="button" onClick={() => make(c.id)} className={row}>
              {c.face && <ObjectFace face={c.face} size={32} />}<span className="min-w-0 flex-1 truncate">{c.glance_title ?? c.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[var(--pc-separator)]">
          {!isCrucial && position > 0 && <button type="button" onClick={() => { onMove(position - 1); onClose(); }} className={row}><ArrowUp size={20} aria-hidden /> Move up</button>}
          {!isCrucial && position < count - 1 && <button type="button" onClick={() => { onMove(position + 1); onClose(); }} className={row}><ArrowDown size={20} aria-hidden /> Move down</button>}
          {isCrucial
            ? <button type="button" onClick={() => { void onCrucial(false).finally(onClose); }} className={row}><Flag size={20} aria-hidden /> Not crucial</button>
            : <button type="button" onClick={() => make()} className={`${row} font-semibold text-[var(--pc-accent-ink)]`}><Flag size={20} aria-hidden /> Make crucial</button>}
          <button type="button" onClick={() => { onLater(); onClose(); }} className={row}><Clock size={20} aria-hidden /> Later…</button>
          <button type="button" onClick={() => { onOpen(); onClose(); }} className={row}><Check size={20} aria-hidden /> Open</button>
          <button type="button" onClick={() => { onDrop(); onClose(); }} className={`${row} text-pc-text-muted`}><Ban size={20} aria-hidden /> Not needed</button>
        </div>
      )}
    </Sheet>
  );
}
