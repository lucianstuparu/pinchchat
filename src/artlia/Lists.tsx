/**
 * The Casa Artlia lists (ai.manager casa-artlia-app.md): Acum (what needs attention, each item
 * once), Plan (the road to opening, one section per milestone) and Categorii (counts and progress;
 * a category opens its items by phase). Rows are oc's task row (my.design patterns/task-row.md):
 * tick, number in the category's colour, title with the key name bold, due chip and category pill.
 */
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, Flag, HelpCircle, Search, Star, X } from 'lucide-react';
import { DueChip, Title } from '../app/Todo';
import { dueChip } from '../app/todoRules';
import type { ArtItem, Category } from './api';
import { catStats, groupNow, isOpen, matchesArt, plan, sectionsOf, toneOf, toneStyle, type Tone } from './rules';

type Mode = 'light' | 'dark';

export function CatPill({ cat, cats, mode }: { cat: string; cats: Category[]; mode: Mode }) {
  const c = cats.find(x => x.id === cat);
  if (!c) return null;
  return <span className="inline-flex h-[22px] shrink-0 items-center rounded-[8px] px-2 text-[12px] font-semibold" style={toneStyle(toneOf(cat, cats), mode)}>{c.label}</span>;
}

interface RowProps { item: ArtItem; today: string; mode: Mode; cats: Category[]; showCat?: boolean; onDone: (i: ArtItem) => void; onOpen: (i: ArtItem) => void }

export function ArtRow({ item, today, mode, cats, showCat = true, onDone, onOpen }: RowProps) {
  const [ticked, setTicked] = useState(false);
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const done = !isOpen(item) || ticked;
  const tone = toneOf(item.cat, cats);
  const milestone = item.kind === 'milestone';
  const tick = () => {
    if (done) return;
    setTicked(true); navigator.vibrate?.(10);
    window.setTimeout(() => onDone(item), 380);   // the check shows before the row goes
  };
  const extra = item.kind === 'check' || item.status === 'check' ? 'De verificat' : item.kind === 'decision' ? 'De decis' : item.status === 'waiting' ? 'În așteptare' : null;
  return (
    <div className="relative overflow-hidden rounded-[12px]"
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null }; }}
      onTouchMove={e => {
        const t = touch.current; if (!t || done) return;
        const mx = e.touches[0].clientX - t.x, my = e.touches[0].clientY - t.y;
        if (t.horizontal === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) t.horizontal = Math.abs(mx) > Math.abs(my) && mx > 0;
        if (t.horizontal) { e.stopPropagation(); setDx(Math.max(0, Math.min(120, mx))); }
      }}
      onTouchEnd={e => { if (touch.current?.horizontal) e.stopPropagation(); if (dx >= 90) tick(); setDx(0); touch.current = null; }}
      style={{ touchAction: 'pan-y' }}>
      {dx > 0 && (
        <div className={`absolute inset-y-0 left-0 flex items-center gap-1.5 pl-4 text-[15px] font-semibold text-white ${dx >= 90 ? 'bg-[#1d9e75]' : 'bg-[#1d9e75]/60'}`} style={{ width: dx }} aria-hidden>
          <Check size={18} strokeWidth={3} /> {dx >= 90 ? 'Făcut' : ''}
        </div>
      )}
      <div className={`flex items-start gap-1 py-1.5 pr-2 ${dx ? '' : 'transition-transform'} ${ticked ? 'opacity-50' : ''}`}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        <button type="button" onClick={tick} disabled={!isOpen(item)} className="press flex h-10 w-10 shrink-0 items-center justify-center"
          aria-label={`Făcut: ${item.title.replace(/\*\*/g, '')}`}>
          {milestone ? (
            <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${done ? 'border-[#1d9e75] bg-[#1d9e75] text-white' : ''}`}
              style={done ? undefined : { borderColor: tone.rail, color: tone.rail }}>
              {done ? <Check size={14} strokeWidth={3.5} /> : <Flag size={11} strokeWidth={3} fill="currentColor" />}
            </span>
          ) : (
            <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-[8px] border-2 transition-colors ${
              done ? 'border-[#1d9e75] bg-[#1d9e75] text-white' : 'border-pc-border-strong bg-pc-elevated'}`}>
              {done && <Check size={14} strokeWidth={3.5} />}
            </span>
          )}
        </button>
        <span className="w-[30px] shrink-0 pr-1 pt-[9px] text-right text-[17px] font-bold leading-[22px] tracking-tight tabular-nums"
          style={{ color: done ? undefined : tone.rail }} aria-label={item.n ? `numărul ${item.n}` : undefined}>
          {item.n ?? ''}
        </span>
        <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 py-[9px] text-left">
          <Title text={item.title} className={`block text-[16px] leading-[22px] ${done ? 'text-pc-text-muted line-through' : milestone ? 'font-semibold text-pc-text-primary' : 'text-pc-text-primary'}`} />
          {(dueChip(item, today) || showCat || extra || item.priority === 'P1') && (
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <DueChip item={item} today={today} mode={mode} />
              {item.priority === 'P1' && <Star size={14} className="text-[#f5a623]" fill="currentColor" aria-label="Prioritar" />}
              {extra && <span className="inline-flex h-[22px] items-center gap-1 text-[12px] font-semibold text-pc-text-muted"><HelpCircle size={12} aria-hidden />{extra}</span>}
              {showCat && <CatPill cat={item.cat} cats={cats} mode={mode} />}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

const GLOW: Record<'red' | 'amber', Record<Mode, CSSProperties>> = {
  red: {
    light: { background: 'linear-gradient(180deg, rgba(220,76,76,0.09), rgba(220,76,76,0.02))', border: '1px solid rgba(220,76,76,0.30)', boxShadow: '0 0 0 1px rgba(220,76,76,0.12), 0 0 24px 2px rgba(220,76,76,0.20), 0 6px 20px rgba(220,76,76,0.14)' },
    dark: { background: 'rgba(220,76,76,0.10)', border: '1px solid rgba(220,76,76,0.40)', boxShadow: '0 0 22px rgba(220,76,76,0.22)' },
  },
  amber: {
    light: { background: 'linear-gradient(180deg, rgba(245,166,35,0.09), rgba(245,166,35,0.02))', border: '1px solid rgba(245,166,35,0.28)', boxShadow: '0 0 0 1px rgba(245,166,35,0.12), 0 0 24px 2px rgba(245,166,35,0.22), 0 6px 20px rgba(245,166,35,0.14)' },
    dark: { background: 'rgba(245,166,35,0.09)', border: '1px solid rgba(245,166,35,0.38)', boxShadow: '0 0 22px rgba(245,166,35,0.18)' },
  },
};

export function GroupHead({ mark, label, count, color, sub }: { mark?: ReactNode; label: string; count?: number; color?: string; sub?: string }) {
  return (
    <h3 className="flex items-center gap-2 px-2 pb-0.5 pt-1 text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: color ?? 'var(--pc-text-secondary)' }}>
      {mark}
      <span className="min-w-0 truncate">{label}</span>
      {count != null && <span className="font-medium text-pc-text-faint">{count}</span>}
      {sub && <span className="ml-auto shrink-0 font-medium normal-case tracking-normal text-pc-text-muted">{sub}</span>}
    </h3>
  );
}

type ListProps = { items: ArtItem[]; today: string; mode: Mode; cats: Category[]; onDone: (i: ArtItem) => void; onOpen: (i: ArtItem) => void };

// ---- Acum
export function NowView({ items, today, mode, cats, onDone, onOpen }: ListProps) {
  const g = groupNow(items, today);
  const rows = (list: ArtItem[]) => list.map(i => <ArtRow key={i.id} item={i} today={today} mode={mode} cats={cats} onDone={onDone} onOpen={onOpen} />);
  const empty = !g.overdue.length && !g.now.length && !g.week.length && !g.soon.length && !g.check.length && !g.priority.length;
  return (
    <div className="space-y-5">
      {(g.overdue.length > 0 || g.now.length > 0) && (
        <section className="rounded-[20px] px-1.5 pb-1.5 pt-2.5" style={GLOW[g.overdue.length ? 'red' : 'amber'][mode]}>
          {g.overdue.length > 0 && <GroupHead mark={<Flag size={13} strokeWidth={2.75} fill="currentColor" aria-hidden />} label="Întârziate" count={g.overdue.length} color="#dc4c4c" />}
          {rows(g.overdue)}
          {g.now.length > 0 && <GroupHead label="Azi, mâine, poimâine" count={g.now.length} color="#d48a12" />}
          {rows(g.now)}
        </section>
      )}
      {g.week.length > 0 && <section><GroupHead label="Săptămâna asta" count={g.week.length} />{rows(g.week)}</section>}
      {g.priority.length > 0 && <section><GroupHead mark={<Star size={13} strokeWidth={2.5} fill="currentColor" aria-hidden />} label="Prioritare" count={g.priority.length} />{rows(g.priority)}</section>}
      {g.soon.length > 0 && <section><GroupHead label="Următoarele 4 săptămâni" count={g.soon.length} />{rows(g.soon)}</section>}
      {g.check.length > 0 && <section><GroupHead mark={<HelpCircle size={13} strokeWidth={2.5} aria-hidden />} label="De verificat" count={g.check.length} />{rows(g.check)}</section>}
      {empty && <p className="px-2 py-10 text-center text-[15px] text-pc-text-muted">Nimic urgent acum. Restul e în Plan și în Categorii.</p>}
      {g.putOff > 0 && <p className="px-2 text-[13px] text-pc-text-muted">{g.putOff} amânat{g.putOff === 1 ? '' : 'e'} pentru mai târziu</p>}
    </div>
  );
}

// ---- Plan
const monthOf = (d?: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }) : '');

export function PlanView({ items, today, mode, cats, onDone, onOpen }: ListProps) {
  const sections = plan(items, today);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!sections.length) return <p className="px-2 py-10 text-center text-[15px] text-pc-text-muted">Nicio etapă încă. Cere-i asistentului să adauge drumul spre deschidere.</p>;
  return (
    <ol className="relative space-y-4 pl-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-[2px] before:rounded before:bg-[var(--pc-separator)]">
      {sections.map((s, idx) => {
        const key = s.milestone?.id ?? s.label;
        const many = s.items.length > 5;
        const expanded = open[key] ?? !s.past;
        const shown = expanded ? (many && !open[`${key}:all`] ? s.items.slice(0, 5) : s.items) : [];
        const done = s.milestone && !isOpen(s.milestone);
        return (
          <li key={key} className="relative">
            <span className={`absolute -left-4 top-[14px] h-4 w-4 rounded-full border-2 ${done ? 'border-[#1d9e75] bg-[#1d9e75]' : idx === 0 || !s.past ? 'border-pc-accent bg-pc-elevated' : 'border-pc-border-strong bg-pc-elevated'}`} aria-hidden />
            <button type="button" onClick={() => (s.milestone ? onOpen(s.milestone) : setOpen(o => ({ ...o, [key]: !expanded })))}
              className="press flex min-h-10 w-full items-center gap-2 rounded-[12px] px-2 text-left">
              <span className="min-w-0 flex-1">
                <Title text={s.label} className={`block text-[16px] font-semibold leading-[22px] ${done ? 'text-pc-text-muted line-through' : 'text-pc-text-primary'}`} />
                <span className="block text-[13px] text-pc-text-muted">
                  {[s.milestone?.due_date ? monthOf(s.milestone.due_date) : '', s.items.length ? `${s.items.length} de făcut` : 'nimic deschis'].filter(Boolean).join(' · ')}
                </span>
              </span>
              {s.milestone && <ChevronRight size={18} className="shrink-0 text-pc-text-faint" />}
            </button>
            {s.items.length > 0 && (
              <div className="mt-1">
                {shown.map(i => <ArtRow key={i.id} item={i} today={today} mode={mode} cats={cats} onDone={onDone} onOpen={onOpen} />)}
                {(!expanded || (many && !open[`${key}:all`])) && (
                  <button type="button" onClick={() => setOpen(o => ({ ...o, [key]: true, [`${key}:all`]: expanded ? true : o[`${key}:all`] }))}
                    className="press ml-[84px] flex min-h-10 items-center gap-1 text-[15px] font-semibold text-pc-accent">
                    <ChevronDown size={16} /> {expanded ? `Încă ${s.items.length - 5}` : `Arată ${s.items.length}`}
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---- Categorii
export function CatsView({ items, today, mode, cats, onPick }: { items: ArtItem[]; today: string; mode: Mode; cats: Category[]; onPick: (c: Category) => void }) {
  const stats = catStats(items, cats, today);
  return (
    <ul className="divide-y divide-[var(--pc-separator)] rounded-[12px] bg-pc-elevated ring-1 ring-[var(--pc-separator)]">
      {stats.map(s => {
        const tone: Tone = toneOf(s.cat.id, cats);
        const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
        return (
          <li key={s.cat.id}>
            <button type="button" onClick={() => onPick(s.cat)} className="press flex w-full items-center gap-3 px-3 py-2.5 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[17px] font-bold tabular-nums" style={toneStyle(tone, mode)} aria-label={`${s.open} deschise`}>{s.open || <Check size={18} strokeWidth={3} aria-hidden />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[16px] font-semibold">{s.cat.label}</span>
                  {s.overdue > 0 && <span className="shrink-0 text-[13px] font-semibold text-[#dc4c4c]">{s.overdue} întârziat{s.overdue === 1 ? '' : 'e'}</span>}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-[var(--pc-separator)]" aria-hidden><span className="block h-full rounded-[2px]" style={{ width: `${pct}%`, background: tone.rail }} /></span>
                  <span className="shrink-0 text-[12px] tabular-nums text-pc-text-muted">{s.total ? `${s.done} din ${s.total} gata` : 'nimic încă'}</span>
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-pc-text-faint" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CategoryView({ cat, items, today, mode, cats, onDone, onOpen }: ListProps & { cat: Category }) {
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const mine = items.filter(i => i.cat === cat.id && i.kind !== 'milestone' && matchesArt(i, q));
  const open = mine.filter(isOpen);
  const closed = mine.filter(i => !isOpen(i) && i.status !== 'cancelled');
  return (
    <div className="space-y-4">
      {cat.desc && <p className="px-2 text-[13px] text-pc-text-muted">{cat.desc}</p>}
      <div className="flex h-10 items-center gap-2 rounded-[12px] bg-pc-surface pl-3 pr-1">
        <Search size={17} className="shrink-0 text-pc-text-muted" aria-hidden />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Caută un cuvânt sau un număr" aria-label="Caută în categorie"
          className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none placeholder:text-pc-text-muted [&::-webkit-search-cancel-button]:hidden" />
        {q && <button type="button" onClick={() => setQ('')} className="press flex h-10 w-10 items-center justify-center" aria-label="Șterge căutarea"><X size={16} /></button>}
      </div>
      {sectionsOf(open).map(g => (
        <section key={g.key}>
          <GroupHead label={g.label} count={g.items.length} />
          {g.items.map(i => <ArtRow key={i.id} item={i} today={today} mode={mode} cats={cats} showCat={false} onDone={onDone} onOpen={onOpen} />)}
        </section>
      ))}
      {open.length === 0 && <p className="px-2 py-8 text-center text-[15px] text-pc-text-muted">{q ? `Nimic pentru „${q}”` : 'Nimic deschis aici.'}</p>}
      {closed.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone(s => !s)} className="press flex min-h-10 items-center gap-1 px-2 text-[15px] font-semibold text-pc-text-secondary" aria-expanded={showDone}>
            <ChevronDown size={16} className={showDone ? 'rotate-180' : ''} /> Făcute · {closed.length}
          </button>
          {showDone && closed.map(i => <ArtRow key={i.id} item={i} today={today} mode={mode} cats={cats} showCat={false} onDone={onDone} onOpen={onOpen} />)}
        </section>
      )}
    </div>
  );
}

