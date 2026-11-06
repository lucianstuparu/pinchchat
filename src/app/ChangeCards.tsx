/**
 * The change card (my.design v2/oc-v2-brief.md §6.2): the answer to anything the coach changed, instead of prose that repeats
 * the person. Number and short title, one line of what changed, Undo, Show on Today. Tapping the card opens the thing (Lucian 2026-11-06).
 * A message that only mentions an item
 * keeps the plain chip: a card is for a change, judged from the item's own dates against the message's time.
 */
import { useEffect, useState } from 'react';
import { ObjectFace } from '../kit2/ObjectFace';
import { Glance } from './Glance';
import { REALMS, realmName } from '../realms';
import { act, fetchStates, type NowItem } from './api';
import { ItemChips } from './ItemChips';
import { changedBy, isClosedState, whatChanged, type ClaudeNote, type ItemState } from './todayRules';

const UNDO_FOR = 10 * 60_000;

export function ChangeCard({ title, keyWords, n, face, line, onOpen, onUndo, onShow, undone }: {
  title: string; keyWords?: string; n?: number; face?: NowItem['face']; line: string;
  onOpen?: () => void; onUndo?: () => void; onShow?: () => void; undone?: boolean;
}) {
  const body = (
    <>
      {face && <ObjectFace face={face} size={28} />}
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-tight">{n != null ? `${n} · ` : ''}<Glance text={title} keyWords={keyWords} /></span>
        <span className="block truncate text-[13px] leading-tight text-pc-text-secondary">{undone ? 'Undone' : line}</span>
      </span>
    </>
  );
  return (
    <div className="mt-1 min-w-[240px] overflow-hidden rounded-[12px] border border-pc-border bg-pc-elevated">
      {onOpen
        ? <button type="button" onClick={onOpen} className="press flex min-h-10 w-full items-center gap-2.5 px-3 py-2.5 text-left">{body}</button>
        : <div className="flex items-center gap-2.5 px-3 py-2.5">{body}</div>}
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

/** A note from another session: its card, with the whole text behind "Show all". The item comes from its marker or its number. */
export function NoteCard({ note, itemId, findByNumber, onOpen, onShow, refresh }: { note: ClaudeNote; itemId?: string; findByNumber: (n: number) => string | undefined; onOpen: (id: string) => void; onShow: (id: string) => void; refresh?: () => void }) {
  const id = itemId ?? (note.n != null ? findByNumber(note.n) : undefined);
  const [state, setState] = useState<ItemState | null>(null);
  const [all, setAll] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchStates([id]).then(r => { if (alive) setState(r.items[id] ?? null); }).catch(() => undefined);
    return () => { alive = false; };
  }, [id]);
  const title = state?.glance_title ?? state?.title?.replace(/\*\*/g, '');
  const n = state?.n ?? note.n;
  const more = note.text.replace(/\*\*/g, '').trim().length > note.line.length;
  return (
    <div className="min-w-0 flex-1">
      <ChangeCard n={n} face={state?.face} title={title ?? note.line} keyWords={state?.glance_key} line={title ? note.line : ''}
        onOpen={id && state ? () => onOpen(id) : undefined}
        onShow={id && state && !isClosedState(state.status) ? () => onShow(id) : undefined} />
      {/* Which realm? One tap (review 01: Other is emptied by asking in the chat). */}
      {note.asksRealm && id && (placed
        ? <p className="px-1 pt-1 text-[13px] font-semibold text-[#0e7c5f]">{realmName(placed)}</p>
        : <div className="flex flex-wrap gap-1.5 pt-1.5" role="group" aria-label="Which realm">
            {REALMS.map(r => <button key={r.id} type="button" onClick={() => { void act(id, 'edit', { realm_id: r.id }).then(() => { setPlaced(r.id); refresh?.(); }).catch(() => undefined); }} className="press min-h-10 rounded-full bg-[var(--pc-hover-strong)] px-3 text-[14px] font-semibold">{r.name}</button>)}
          </div>)}
      {more && !note.asksRealm && (
        <button type="button" onClick={() => setAll(a => !a)} aria-expanded={all} className="press min-h-10 px-1 text-[15px] font-semibold text-[var(--pc-accent-ink)]">{all ? 'Show less' : 'Show all'}</button>
      )}
      {all && <p className="whitespace-pre-wrap px-1 pb-1 text-[15px] leading-snug">{note.text.replace(/\*\*/g, '').replace(/⟨[^⟩]*⟩/g, '')}</p>}
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
          <ChangeCard key={i.id} n={s.n} face={s.face} title={s.glance_title ?? (s.title ?? i.label).replace(/\*\*/g, '')} keyWords={s.glance_key} line={whatChanged(s, ts, today)} undone={undone[i.id]}
            onOpen={() => onOpen(i.id)}
            onUndo={canUndo ? () => { void act(i.id, 'undo').then(() => { setUndone(u => ({ ...u, [i.id]: true })); refresh(); }).catch(() => undefined); } : undefined}
            onShow={open ? () => onShow(i.id) : undefined} />
        );
      })}
      {chips.length > 0 && <ItemChips items={chips} onOpen={onOpen} />}
    </>
  );
}
