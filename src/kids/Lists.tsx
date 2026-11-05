/**
 * The kids lists (ai.manager kids-app.md): Săptămâna (the next thing on a tint, then today to the end
 * of next week, one section per day), Activități (by child) and Idei (by tag, loved first) in two
 * columns, Planuri (each saying its next step). Tiles on a grey ground, each with a drawing of the
 * thing (KidObject, my.design decisions 2026-11-05). KidRow stays for the steps in a plan's sheet.
 */
import { useState, type ReactNode } from 'react';
import { CalendarCheck, Check, ChevronRight, Heart, Plus } from 'lucide-react';
import { DueChip, Title } from '../app/Todo';
import type { Child, KidItem } from './api';
import { KidObject } from './KidObject';
import {
  RSVP_LABEL, TYPE_LABEL, WHO_LABEL, activitiesByChild, childTone, childrenOf, dayTitle, ideaTags, ideas, isOpen, planLine, plans, shortDate, shortTitle,
  slotText, topOf, week, type WeekLine,
} from './rules';

type Mode = 'light' | 'dark';

/** The children an item is for: each one's name, in their colour. */
export function ChildNames({ item, kids, mode }: { item: Pick<KidItem, 'child'>; kids: Child[]; mode: Mode }) {
  const who = childrenOf(item, kids);
  if (!who.length) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {who.map(c => {
        const t = childTone(c.id, kids);
        return (
          <span key={c.id} className="inline-flex h-5 items-center rounded-full px-2 text-[12px] font-semibold"
            style={mode === 'dark' ? { background: `${t.fill}4d`, color: t.inkDark } : { background: `${t.fill}24`, color: t.ink }}>{c.name}</span>
        );
      })}
    </span>
  );
}

export function GroupHead({ label, count, accent }: { label: string; count?: number; accent?: boolean }) {
  return (
    <h3 className={`flex items-center gap-2 px-2 pb-1.5 pt-1 text-[12px] font-bold uppercase tracking-[0.06em] ${accent ? 'text-[var(--pc-accent-ink)]' : 'text-pc-text-secondary'}`}>
      <span className="min-w-0 truncate">{label}</span>
      {count != null && <span className="font-medium text-pc-text-muted">{count}</span>}
    </h3>
  );
}

function Empty({ title, line, onAdd }: { title: string; line: string; onAdd: () => void }) {
  return (
    <div className="px-8 py-14 text-center">
      <p className="text-[17px] font-semibold">{title}</p>
      <p className="mt-1 text-[15px] text-pc-text-muted">{line}</p>
      <button type="button" onClick={onAdd} className="press mx-auto mt-4 flex h-10 items-center gap-1.5 rounded-full bg-pc-elevated px-4 text-[15px] font-semibold text-[var(--pc-accent-ink)]">
        <Plus size={18} /> Adaugă
      </button>
    </div>
  );
}

/** One line of details: place, who takes them, what to bring, the RSVP; as plain words. */
function details(i: KidItem): string {
  return [
    i.kind === 'event' && i.type && i.type !== 'other' ? TYPE_LABEL[i.type] : '',
    i.place ?? '',
    i.who ? WHO_LABEL[i.who] : '',
    i.bring ? `de luat: ${i.bring}` : '',
    i.rsvp ? RSVP_LABEL[i.rsvp] : '',
  ].filter(Boolean).join(' · ');
}

/** The tick: a moment of check before the item goes. */
function Tick({ item, onDone }: { item: KidItem; onDone: (i: KidItem) => void }) {
  const [ticked, setTicked] = useState(false);
  const done = !isOpen(item) || ticked;
  const tick = () => {
    if (done) return;
    setTicked(true); navigator.vibrate?.(10);
    window.setTimeout(() => onDone(item), 380);   // the check shows before the item goes
  };
  return (
    <button type="button" onClick={tick} disabled={!isOpen(item)} className="press flex h-10 w-10 shrink-0 items-center justify-center" aria-label={`Făcut: ${item.title.replace(/\*\*/g, '')}`}>
      <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-[8px] border-2 transition-colors ${done ? 'border-[#1d9e75] bg-[#1d9e75] text-white' : 'border-pc-border-strong bg-pc-elevated'}`}>
        {done && <Check size={14} strokeWidth={3.5} />}
      </span>
    </button>
  );
}

const canTick = (i: KidItem) => i.kind === 'task' || i.kind === 'plan';
/** Tiles rest on the grey ground with a soft contact shadow, and no border. */
const TILE = 'rounded-[12px] bg-pc-elevated shadow-[0_1px_2px_rgba(0,0,0,0.07),0_2px_8px_rgba(0,0,0,0.05)]';

/** The number, then the words: the number is how the chat refers to an item. */
const metaWithNumber = (i: KidItem, words: string) => [i.n != null ? String(i.n) : '', words].filter(Boolean).join(' · ');

interface RowProps { item: KidItem; kids: Child[]; mode: Mode; today: string; onOpen: (i: KidItem) => void; onDone?: (i: KidItem) => void; showDue?: boolean }

/** A plain row, for the steps inside a plan's sheet. */
export function KidRow({ item, kids, mode, today, onOpen, onDone, showDue }: RowProps) {
  const line = details(item);
  return (
    <div className="flex items-start gap-1 rounded-[12px] py-1.5 pr-2">
      {onDone && canTick(item) ? <Tick item={item} onDone={onDone} /> : <span className="w-3 shrink-0" />}
      <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-start gap-2 py-[9px] text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            {item.n != null && <span className="shrink-0 text-[15px] font-bold tabular-nums text-pc-text-muted">{item.n}</span>}
            <Title text={item.title} className={`min-w-0 text-[16px] leading-[22px] ${isOpen(item) ? 'text-pc-text-primary' : 'text-pc-text-muted line-through'}`} />
          </span>
          {(line || (showDue && item.due_date)) && (
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] leading-tight text-pc-text-muted">
              {showDue && <DueChip item={item} today={today} mode={mode} />}
              {line && <span className="min-w-0">{line}</span>}
            </span>
          )}
        </span>
        <ChildNames item={item} kids={kids} mode={mode} />
      </button>
    </div>
  );
}

/** A wide tile: the drawing, the title, its details, the tick on the right. */
function WideTile({ item, kids, mode, today, onOpen, onDone, title, meta, showDue, children }: RowProps & { title?: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`${TILE} ${isOpen(item) ? '' : 'opacity-60'}`}>
      <div className="flex items-center">
        <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-2 text-left">
          <KidObject item={item} size={44} />
          <span className="min-w-0 flex-1">
            <Title text={title ?? shortTitle(item)} className={`block text-[16px] font-medium leading-[21px] ${isOpen(item) ? '' : 'line-through'}`} />
            {meta && <span className="mt-0.5 block text-[13px] leading-[18px] text-pc-text-muted">{meta}</span>}
            <span className="mt-1 flex flex-wrap items-center gap-1 empty:hidden">
              {showDue && <DueChip item={item} today={today} mode={mode} />}
              <ChildNames item={item} kids={kids} mode={mode} />
              {!!item.calendar?.length && <CalendarCheck size={14} className="text-[var(--pc-accent-ink)]" aria-label="În calendar" />}
            </span>
          </span>
        </button>
        {onDone && canTick(item) && <span className="pr-1"><Tick item={item} onDone={onDone} /></span>}
      </div>
      {children}
    </div>
  );
}

/** A square-ish tile, for the two columns. */
function SmallTile({ item, onOpen, meta, names }: { item: KidItem; onOpen: (i: KidItem) => void; meta: ReactNode; names?: ReactNode }) {
  return (
    <button type="button" onClick={() => onOpen(item)} className={`${TILE} press flex min-w-0 flex-col items-start p-3 text-left`}>
      <span className="flex w-full items-start justify-between">
        <KidObject item={item} size={48} />
        {!!item.calendar?.length && <CalendarCheck size={14} className="text-[var(--pc-accent-ink)]" aria-label="În calendar" />}
      </span>
      <Title text={shortTitle(item)} className="mt-2 block w-full text-[15px] font-medium leading-[20px] [overflow-wrap:anywhere]" />
      <span className="mt-0.5 block w-full text-[13px] leading-[18px] text-pc-text-muted [overflow-wrap:anywhere]">{meta}</span>
      {names && <span className="mt-1.5">{names}</span>}
    </button>
  );
}

const withTime = (i: KidItem, time?: string, end?: string) => (time ? `${shortTitle(i)}, ${time}${end ? `–${end}` : ''}` : shortTitle(i));

/**
 * What comes first, on the accent tint with its drawing: in the list (tap for the sheet, tick if it can
 * be done) and small above the chat (tap for the list). Text stays dark: no grey on a colour.
 */
export function NextBand({ items, kids, today, mode, onOpen, onDone, small }: { items: KidItem[]; kids: Child[]; today: string; mode: Mode; onOpen: (i: KidItem) => void; onDone?: (i: KidItem) => void; small?: boolean }) {
  const { top, day, overdue, more } = topOf(items, today);
  if (!top) return null;
  const when = overdue > 0 ? `Întârziat${overdue > 1 ? `, încă ${overdue - 1}` : ''}` : day ? dayTitle(day, today).split(' · ')[0] : '';
  const line = small
    ? [when, more > 0 ? `încă ${more}` : ''].filter(Boolean).join(' · ')
    : [when, metaWithNumber(top.item, details(top.item))].filter(Boolean).join(' · ');
  // A fresh tint of Kids' green: the accent at low alpha turns grey on the grey ground.
  const tint = { background: mode === 'dark' ? 'rgba(var(--pc-accent-rgb),0.28)' : '#d6f0e1' };
  return (
    <div className={`flex items-center rounded-[20px] ${small ? '' : 'mb-4'}`} style={tint}>
      <button type="button" onClick={() => onOpen(top.item)} aria-label={small ? 'Deschide lista' : undefined}
        className={`flex min-w-0 flex-1 items-center text-left ${small ? 'gap-3 py-2 pl-3 pr-2' : 'gap-3.5 py-4 pl-4 pr-2'}`}>
        <KidObject item={top.item} size={small ? 40 : 68} glow />
        <span className="min-w-0 flex-1">
          <Title text={withTime(top.item, top.time, small ? undefined : top.end)} className={`block font-semibold ${small ? 'truncate text-[16px] leading-[21px]' : 'text-[20px] leading-[25px]'}`} />
          {small ? (
            <span className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-[20px] text-pc-text-secondary">
              <ChildNames item={top.item} kids={kids} mode={mode} /><span className="min-w-0 truncate">{line}</span>
            </span>
          ) : (
            <>
              <span className="mt-0.5 block text-[14px] leading-[19px] text-pc-text-secondary">{line}</span>
              <span className="mt-1.5 flex empty:hidden"><ChildNames item={top.item} kids={kids} mode={mode} /></span>
            </>
          )}
        </span>
        {small && <ChevronRight size={18} className="shrink-0 text-pc-text-secondary" />}
      </button>
      {!small && onDone && canTick(top.item) && <span className="pr-2"><Tick key={top.key} item={top.item} onDone={onDone} /></span>}
    </div>
  );
}

type ListProps = { items: KidItem[]; kids: Child[]; today: string; mode: Mode; onOpen: (i: KidItem) => void; onDone: (i: KidItem) => void; onAdd: () => void };

// ---- Săptămâna
export function WeekView({ items, kids, today, mode, onOpen, onDone, onAdd }: ListProps) {
  const w = week(items, today);
  const { top } = topOf(items, today);
  // What is on the band is not shown again below it.
  const overdue = w.overdue.filter(i => i.id !== top?.key);
  const days = w.days.map(d => ({ ...d, lines: d.lines.filter(l => l.key !== top?.key) })).filter(d => d.lines.length > 0);
  const tile = (l: WeekLine) => (
    <WideTile key={l.key} item={l.item} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={l.what === 'task' || l.what === 'plan' ? onDone : undefined}
      title={withTime(l.item, l.time, l.end)}
      meta={metaWithNumber(l.item, [l.until ? `până pe ${shortDate(l.until)}` : '', l.what === 'plan' ? 'Termenul planului' : details(l.item)].filter(Boolean).join(' · '))} />
  );
  if (!w.overdue.length && !w.days.length && !w.undated.length) {
    return <Empty title="Săptămână liberă" line="Nimic de azi până duminica viitoare. Spune în chat o activitate, o invitație sau ce trebuie făcut." onAdd={onAdd} />;
  }
  return (
    <div>
      <NextBand items={items} kids={kids} today={today} mode={mode} onOpen={onOpen} onDone={onDone} />
      <div className="space-y-4">
        {overdue.length > 0 && (
          <section>
            <GroupHead label="Tot întârziate" count={overdue.length} accent />
            <div className="space-y-2">{overdue.map(i => <WideTile key={i.id} item={i} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={onDone} showDue meta={metaWithNumber(i, details(i))} />)}</div>
          </section>
        )}
        {days.map(d => (
          <section key={d.date}>
            <GroupHead label={dayTitle(d.date, today)} accent={d.date === today} />
            <div className="space-y-2">{d.lines.map(tile)}</div>
          </section>
        ))}
        {!w.days.length && <p className="px-3 text-[15px] text-pc-text-muted">Săptămână liberă · nimic de azi până duminica viitoare.</p>}
        {w.undated.length > 0 && (
          <section>
            <GroupHead label="De făcut, fără dată" count={w.undated.length} />
            <div className="space-y-2">{w.undated.map(i => <WideTile key={i.id} item={i} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={onDone} meta={metaWithNumber(i, details(i))} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}

// ---- Activități (the section already says whose: no name on the tile)
export function ActivitiesView({ items, kids, onOpen, onAdd }: ListProps) {
  const groups = activitiesByChild(items, kids);
  if (!groups.length) return <Empty title="Nicio activitate încă" line="Spune în chat: „Lia are înot miercurea la 14, până în iunie”." onAdd={onAdd} />;
  return (
    <div className="space-y-4">
      {groups.map(g => (
        <section key={g.key}>
          <GroupHead label={g.label} count={g.items.length} />
          <div className="grid grid-cols-2 gap-2">
            {g.items.map(i => (
              <SmallTile key={i.id} item={i} onOpen={onOpen}
                meta={metaWithNumber(i, [(i.schedule ?? []).map(slotText).join(', '), i.place, i.who ? WHO_LABEL[i.who] : ''].filter(Boolean).join(' · ') || 'Fără orar încă')} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---- Idei
export function IdeasView({ items, kids, mode, onOpen, onAdd }: ListProps) {
  const [tag, setTag] = useState<string | null>(null);
  const tags = ideaTags(items);
  const list = ideas(items, tag && tags.includes(tag) ? tag : null);
  if (!items.some(i => i.kind === 'idea' && isOpen(i))) return <Empty title="Nicio idee încă" line="Spune în chat o idee de activitate sau de bricolaj, cu ce trebuie pentru ea." onAdd={onAdd} />;
  return (
    <div>
      {tags.length > 0 && (
        <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label="Etichete">
          {[null, ...tags].map(t => (
            <button key={t ?? 'all'} type="button" role="tab" aria-selected={tag === t} onClick={() => setTag(t)}
              className={`press h-9 shrink-0 rounded-full px-3.5 text-[15px] ${tag === t ? 'bg-pc-accent font-semibold text-[var(--pc-on-accent)]' : 'bg-pc-elevated text-pc-text-secondary'}`}>
              {t ?? 'Toate'}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {list.map(i => (
          <SmallTile key={i.id} item={i} onOpen={onOpen} names={i.child ? <ChildNames item={i} kids={kids} mode={mode} /> : undefined}
            meta={<>{i.loved && <Heart size={13} className="mr-1 inline text-[#c2477f]" fill="currentColor" aria-label="Le-a plăcut" />}{metaWithNumber(i, [i.tried ? 'încercată' : '', (i.tags ?? []).join(', ')].filter(Boolean).join(' · '))}</>} />
        ))}
      </div>
    </div>
  );
}

// ---- Planuri: each says its next step, ticked right here; the rest are in its sheet
export function PlansView({ items, kids, today, mode, onOpen, onDone, onAdd }: ListProps) {
  const list = plans(items);
  if (!list.length) return <Empty title="Niciun plan încă" line="Un plan mai mare, cu pași: petrecerea Carlei, vacanța, înscrierile de anul viitor." onAdd={onAdd} />;
  return (
    <div className="space-y-2">
      {list.map(v => {
        const { next, line } = planLine(v);
        return (
          <WideTile key={v.plan.id} item={v.plan} kids={kids} mode={mode} today={today} onOpen={onOpen} showDue
            onDone={!next && isOpen(v.plan) ? onDone : undefined} meta={next ? undefined : metaWithNumber(v.plan, line)}>
            {next && (
              <div className="flex items-center border-t border-pc-border">
                <button type="button" onClick={() => onOpen(next)} className="min-w-0 flex-1 py-2 pl-3 pr-2 text-left">
                  <span className="block text-[12px] font-semibold text-[var(--pc-accent-ink)]">{line}</span>
                  <Title text={shortTitle(next)} className="block text-[15px] leading-[20px]" />
                  {next.due_date && <span className="mt-1 flex"><DueChip item={next} today={today} mode={mode} /></span>}
                </button>
                <span className="pr-1"><Tick key={next.id} item={next} onDone={onDone} /></span>
              </div>
            )}
          </WideTile>
        );
      })}
    </div>
  );
}
