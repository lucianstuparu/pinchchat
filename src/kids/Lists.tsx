/**
 * The kids lists (ai.manager kids-app.md): Săptămâna (today to the end of next week, one section per
 * day), Activități (by child), Idei (by tag, loved first), Planuri (each with its steps). Rows follow
 * oc's task row (my.design patterns/task-row.md): a tick for what can be done, else the time; the
 * number; the title with the key word bold; one line of details; the children as coloured initials.
 */
import { useState, type ReactNode } from 'react';
import { CalendarCheck, Check, Heart, Plus } from 'lucide-react';
import { DueChip, Title } from '../app/Todo';
import type { Child, KidItem } from './api';
import {
  RSVP_LABEL, TYPE_LABEL, WHO_LABEL, activitiesByChild, childTone, childrenOf, dayTitle, ideaTags, ideas, isOpen, plans, shortDate,
  slotText, week, type WeekLine,
} from './rules';

type Mode = 'light' | 'dark';

/** The children an item is for: a small disc with each one's initial, in their colour. */
export function ChildDots({ item, kids, size = 22 }: { item: Pick<KidItem, 'child'>; kids: Child[]; size?: number }) {
  const who = childrenOf(item, kids);
  if (!who.length) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={who.map(c => c.name).join(' și ')}>
      {who.map(c => (
        <span key={c.id} className="flex items-center justify-center rounded-full font-bold text-white"
          style={{ width: size, height: size, fontSize: size * 0.5, background: childTone(c.id, kids).fill }}>{c.name[0]}</span>
      ))}
    </span>
  );
}

export function GroupHead({ label, count, accent }: { label: string; count?: number; accent?: boolean }) {
  return (
    <h3 className={`flex items-center gap-2 px-2 pb-0.5 pt-1 text-[12px] font-bold uppercase tracking-[0.06em] ${accent ? 'text-[var(--pc-accent-ink)]' : 'text-pc-text-secondary'}`}>
      <span className="min-w-0 truncate">{label}</span>
      {count != null && <span className="font-medium text-pc-text-faint">{count}</span>}
    </h3>
  );
}

function Empty({ title, line, onAdd }: { title: string; line: string; onAdd: () => void }) {
  return (
    <div className="px-8 py-14 text-center">
      <p className="text-[17px] font-semibold">{title}</p>
      <p className="mt-1 text-[15px] text-pc-text-muted">{line}</p>
      <button type="button" onClick={onAdd} className="press mx-auto mt-4 flex h-10 items-center gap-1.5 rounded-full bg-pc-surface px-4 text-[15px] font-semibold text-[var(--pc-accent-ink)]">
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

interface RowProps { item: KidItem; kids: Child[]; mode: Mode; today: string; onOpen: (i: KidItem) => void; onDone?: (i: KidItem) => void;
  /** The time column instead of the tick (a session, an event). */
  time?: string; end?: string; until?: string; meta?: ReactNode; showDue?: boolean }

export function KidRow({ item, kids, mode, today, onOpen, onDone, time, end, until, meta, showDue }: RowProps) {
  const [ticked, setTicked] = useState(false);
  const done = !isOpen(item) || ticked;
  const tick = () => {
    if (done || !onDone) return;
    setTicked(true); navigator.vibrate?.(10);
    window.setTimeout(() => onDone(item), 380);   // the check shows before the row goes
  };
  const line = meta ?? details(item);
  const canTick = !!onDone && (item.kind === 'task' || item.kind === 'plan');
  return (
    <div className="flex items-start gap-1 rounded-[12px] py-1.5 pr-2">
      {canTick ? (
        <button type="button" onClick={tick} disabled={!isOpen(item)} className="press flex h-10 w-10 shrink-0 items-center justify-center" aria-label={`Făcut: ${item.title.replace(/\*\*/g, '')}`}>
          <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-[8px] border-2 transition-colors ${done ? 'border-[#1d9e75] bg-[#1d9e75] text-white' : 'border-pc-border-strong bg-pc-elevated'}`}>
            {done && <Check size={14} strokeWidth={3.5} />}
          </span>
        </button>
      ) : time === undefined && item.kind !== 'event' ? <span className="w-3 shrink-0" /> : (
        <span className="w-[52px] shrink-0 pl-2 pt-[9px] text-[15px] font-semibold leading-[22px] tabular-nums">{time ?? (item.kind === 'event' ? 'Toată ziua' : '')}
          {time && end && <span className="block text-[12px] font-medium leading-tight text-pc-text-muted">{end}</span>}
        </span>
      )}
      <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-start gap-2 py-[9px] text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            {item.n != null && <span className="shrink-0 text-[15px] font-bold tabular-nums text-pc-text-muted">{item.n}</span>}
            <Title text={item.title} className={`min-w-0 text-[16px] leading-[22px] ${done ? 'text-pc-text-muted line-through' : 'text-pc-text-primary'}`} />
          </span>
          {(line || (showDue && item.due_date) || until || item.calendar?.length) && (
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] leading-tight text-pc-text-muted">
              {showDue && <DueChip item={item} today={today} mode={mode} />}
              {until && <span>până pe {shortDate(until)}</span>}
              {line && <span className="min-w-0">{line}</span>}
              {!!item.calendar?.length && <CalendarCheck size={14} className="shrink-0 text-[var(--pc-accent-ink)]" aria-label="În calendar" />}
            </span>
          )}
        </span>
        <ChildDots item={item} kids={kids} />
      </button>
    </div>
  );
}

type ListProps = { items: KidItem[]; kids: Child[]; today: string; mode: Mode; onOpen: (i: KidItem) => void; onDone: (i: KidItem) => void; onAdd: () => void };

// ---- Săptămâna
export function WeekView({ items, kids, today, mode, onOpen, onDone, onAdd }: ListProps) {
  const w = week(items, today);
  const row = (l: WeekLine) => (
    <KidRow key={l.key} item={l.item} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={l.what === 'task' || l.what === 'plan' ? onDone : undefined}
      time={l.time} end={l.end} until={l.until} meta={l.what === 'plan' ? 'Termenul planului' : undefined} />
  );
  if (!w.overdue.length && !w.days.length && !w.undated.length) {
    return <Empty title="Săptămână liberă" line="Nimic de azi până duminica viitoare. Spune în chat o activitate, o invitație sau ce trebuie făcut." onAdd={onAdd} />;
  }
  return (
    <div className="space-y-4">
      {w.overdue.length > 0 && (
        <section className="rounded-[20px] bg-[rgba(var(--pc-accent-rgb),0.08)] p-1 ring-1 ring-[rgba(var(--pc-accent-rgb),0.25)]">
          <GroupHead label="Întârziate" count={w.overdue.length} accent />
          {w.overdue.map(i => <KidRow key={i.id} item={i} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={onDone} showDue />)}
        </section>
      )}
      {w.days.map(d => (
        <section key={d.date}>
          <GroupHead label={dayTitle(d.date, today)} accent={d.date === today} />
          {d.lines.map(row)}
        </section>
      ))}
      {!w.days.length && <p className="px-3 text-[15px] text-pc-text-muted">Săptămână liberă · nimic de azi până duminica viitoare.</p>}
      {w.undated.length > 0 && (
        <section>
          <GroupHead label="De făcut, fără dată" count={w.undated.length} />
          {w.undated.map(i => <KidRow key={i.id} item={i} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={onDone} />)}
        </section>
      )}
    </div>
  );
}

// ---- Activități
export function ActivitiesView({ items, kids, today, mode, onOpen, onDone, onAdd }: ListProps) {
  const groups = activitiesByChild(items, kids);
  if (!groups.length) return <Empty title="Nicio activitate încă" line="Spune în chat: „Lia are înot miercurea la 14, la piscina din Ferney, până în iunie”." onAdd={onAdd} />;
  return (
    <div className="space-y-4">
      {groups.map(g => (
        <section key={g.key}>
          <GroupHead label={g.label} count={g.items.length} />
          {g.items.map(i => (
            <KidRow key={i.id} item={i} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={onDone} 
              meta={[(i.schedule ?? []).map(slotText).join(', '), i.place, i.who ? WHO_LABEL[i.who] : ''].filter(Boolean).join(' · ') || 'Fără orar încă'} />
          ))}
        </section>
      ))}
    </div>
  );
}

// ---- Idei
export function IdeasView({ items, kids, today, mode, onOpen, onDone, onAdd }: ListProps) {
  const [tag, setTag] = useState<string | null>(null);
  const tags = ideaTags(items);
  const list = ideas(items, tag && tags.includes(tag) ? tag : null);
  if (!items.some(i => i.kind === 'idea' && isOpen(i))) return <Empty title="Nicio idee încă" line="Spune în chat o idee de activitate sau de bricolaj, cu ce trebuie pentru ea." onAdd={onAdd} />;
  return (
    <div>
      {tags.length > 0 && (
        <div className="-mx-2 mb-2 flex gap-2 overflow-x-auto px-3 pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label="Etichete">
          {[null, ...tags].map(t => (
            <button key={t ?? 'all'} type="button" role="tab" aria-selected={tag === t} onClick={() => setTag(t)}
              className={`press h-9 shrink-0 rounded-full px-3.5 text-[15px] ${tag === t ? 'bg-pc-accent font-semibold text-[var(--pc-on-accent)]' : 'bg-pc-surface text-pc-text-secondary'}`}>
              {t ?? 'Toate'}
            </button>
          ))}
        </div>
      )}
      {list.map(i => (
        <KidRow key={i.id} item={i} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={onDone} 
          meta={<>{i.loved && <Heart size={13} className="mr-1 inline text-[#c2477f]" fill="currentColor" aria-label="Le-a plăcut" />}{[i.tried ? 'încercată' : '', (i.tags ?? []).join(', ')].filter(Boolean).join(' · ')}</>} />
      ))}
    </div>
  );
}

// ---- Planuri
export function PlansView({ items, kids, today, mode, onOpen, onDone, onAdd }: ListProps) {
  const list = plans(items);
  if (!list.length) return <Empty title="Niciun plan încă" line="Un plan mai mare, cu pași: petrecerea Carlei, vacanța, înscrierile de anul viitor." onAdd={onAdd} />;
  return (
    <div className="space-y-4">
      {list.map(({ plan, steps, done }) => (
        <section key={plan.id}>
          <KidRow item={plan} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={onDone} showDue
            meta={steps.length ? `${done} din ${steps.length} pași` : 'Fără pași încă'} />
          {steps.length > 0 && (
            <div className="ml-10 h-1 overflow-hidden rounded-full bg-pc-surface" aria-hidden>
              <div className="h-full rounded-full bg-pc-accent" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
            </div>
          )}
          <div className="ml-6">
            {steps.filter(isOpen).map(s => <KidRow key={s.id} item={s} kids={kids} mode={mode} today={today} onOpen={onOpen} onDone={onDone} showDue />)}
          </div>
        </section>
      ))}
    </div>
  );
}
