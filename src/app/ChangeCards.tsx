/**
 * The change card (my.design v2/oc-v2-brief.md §6.2): the answer to anything the coach changed, instead of prose that repeats
 * the person. Number and short title, one line of what changed, Undo, Show on Today. A message that only mentions an item
 * keeps the plain chip: a card is for a change, judged from the item's own dates against the message's time.
 */
import { useEffect, useState } from 'react';
import { ObjectFace } from '../kit2/ObjectFace';
import { act, fetchStates, type NowItem } from './api';
import { ItemChips } from './ItemChips';
import { changedBy, isClosedState, whatChanged, type ItemState } from './todayRules';

const UNDO_FOR = 10 * 60_000;

export function ChangeCard({ title, n, face, line, onUndo, onShow, undone }: {
  title: string; n?: number; face?: NowItem['face']; line: string;
  onUndo?: () => void; onShow?: () => void; undone?: boolean;
}) {
  return (
    <div className="mt-1 min-w-[240px] overflow-hidden rounded-[12px] border border-pc-border bg-pc-elevated">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {face && <ObjectFace face={face} size={28} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{n != null ? `${n} · ` : ''}{title}</p>
          <p className="truncate text-[13px] leading-tight text-pc-text-secondary">{undone ? 'Undone' : line}</p>
        </div>
      </div>
      {(onUndo || onShow) && !undone && (
        <div className="flex border-t border-pc-border">
          {onUndo && <button type="button" onClick={onUndo} className="press h-10 flex-1 text-[14px] font-bold text-[var(--pc-accent-ink)]">Undo</button>}
          {onUndo && onShow && <span className="w-px bg-pc-border" aria-hidden />}
          {onShow && <button type="button" onClick={onShow} className="press h-10 flex-1 text-[14px] font-bold">Show on Today</button>}
        </div>
      )}
    </div>
  );
}

/** Cards for what the message changed, chips for what it only mentions. `onCards` tells the bubble to drop its prose. */
export function ChangeCards({ items, ts, onOpen, onShow, onCards, refresh }: {
  items: Array<{ id: string; label: string }>; ts: number;
  onOpen: (id: string) => void; onShow: (id: string) => void; onCards?: () => void; refresh: () => void;
}) {
  const [states, setStates] = useState<Record<string, ItemState> | null>(null);
  const [today, setToday] = useState('');
  const [undone, setUndone] = useState<Record<string, boolean>>({});
  const ids = items.map(i => i.id).join(',');
  useEffect(() => {
    let alive = true;
    fetchStates(ids.split(',')).then(r => {
      if (!alive) return;
      setStates(r.items); setToday(r.today);
      if (ids.split(',').some(id => changedBy(r.items[id], ts))) onCards?.();
    }).catch(() => { if (alive) setStates({}); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, ts]);
  if (!states) return null;
  const cards = items.filter(i => changedBy(states[i.id], ts));
  const chips = items.filter(i => !cards.includes(i));
  // Undo only just after, and only for the latest message about it: later it could undo something else.
  const canUndo = Date.now() - ts < UNDO_FOR;
  return (
    <>
      {cards.map(i => {
        const s = states[i.id];
        const open = !isClosedState(s.status);
        return (
          <ChangeCard key={i.id} n={s.n} face={s.face} title={s.glance_title ?? (s.title ?? i.label).replace(/\*\*/g, '')} line={whatChanged(s, ts, today)} undone={undone[i.id]}
            onUndo={canUndo ? () => { void act(i.id, 'undo').then(() => { setUndone(u => ({ ...u, [i.id]: true })); refresh(); }).catch(() => undefined); } : undefined}
            onShow={open ? () => onShow(i.id) : undefined} />
        );
      })}
      {chips.length > 0 && <ItemChips items={chips} onOpen={onOpen} />}
    </>
  );
}
