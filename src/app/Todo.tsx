/**
 * To do, full screen (ai.manager oc-app-design.md): built on Lucian's life-manager artifact.
 * A short number in the colour of the task's topic, the title with the key person or place in bold,
 * due chips and topic pills; one highlighted "Now" box (due within 3 days, or dragged in by hand; red when
 * anything is late), then ★ Priority, then the areas, each with a dot and a count. Every task shows once.
 * Hold a row and drag it into the box, out of it, or up and down to reorder (ui/dragOrder.ts).
 *
 * On the phone it slides in from the left over the chat (swipe right on the chat); a swipe left,
 * Chat or the phone's Back closes it. On a laptop the same panel is the side column.
 */
import { SpeechStatus } from './SpeechStatus';
import { useDelayedFlag, useNow } from '../ui/progress';
import { useBusy, useDraft } from '../ui/draft';
import { Segmented } from '../ui/Controls';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Building2, Check, ChevronRight, Clock, FileText, Flag, HeartPulse, House, MapPin, Pin, RefreshCw, Repeat, Search, Sparkles, Star, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { formatAmount, type Loop, type NowItem } from './api';
import { useDragDrop, useLift } from '../ui/dragOrder';
import { DragGhost, DropLine } from '../ui/DragParts';
import { BOX, BOX_GLOW, BOX_INK, DROP_OUTLINE, moveFor, type Move } from '../ui/dragRules';
import { LoopsList } from './LoopsList';
import { FieldControls, PrimaryButton } from './MicButton';
import { speechPlaceholder, useSpeech } from './speech';
import { TOPIC_COLORS, dueChip, groupTodo, matches, railOf, titleRuns, type DueKind } from './todoRules';
import type { OutgoingAttachment } from '../mobile/attachments';

type Mode = 'light' | 'dark';
export type TodoTab = 'todo' | 'progress';

/** A title with its **bold** runs. */
export function Title({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{titleRuns(text).map((r, i) => (r.bold ? <b key={i} className="font-semibold">{r.text}</b> : <span key={i}>{r.text}</span>))}</span>;
}

const DUE_STYLE: Record<Mode, Record<DueKind, CSSProperties>> = {
  light: {
    overdue: { background: '#f9d3d3', color: '#a5241f', boxShadow: 'inset 0 0 0 1px rgba(192,57,49,0.45)' },
    today: { background: '#fde7cf', color: '#9a5b00' },
    soon: { background: '#eef4fb', color: '#2c5b8f' },
    later: { background: '#eef1f5', color: '#5b6478' },
  },
  dark: {
    overdue: { background: 'rgba(226,75,74,0.22)', color: '#ff9b98', boxShadow: 'inset 0 0 0 1px rgba(226,75,74,0.5)' },
    today: { background: 'rgba(245,166,35,0.2)', color: '#f5c46b' },
    soon: { background: 'rgba(55,138,221,0.2)', color: '#8cc0f5' },
    later: { background: 'rgba(255,255,255,0.08)', color: '#a1a1aa' },
  },
};

export function DueChip({ item, today, mode }: { item: Pick<NowItem, 'due_date' | 'scheduled'>; today: string; mode: Mode }) {
  const d = dueChip(item, today);
  if (!d) return null;
  return (
    <span className={`inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-[8px] px-2 text-[12px] tabular-nums ${d.kind === 'overdue' ? 'font-bold' : 'font-semibold'}`} style={DUE_STYLE[mode][d.kind]}>
      {d.kind === 'overdue' && <Flag size={11} strokeWidth={2.75} fill="currentColor" className="mr-1 shrink-0" aria-hidden />}{d.text}
    </span>
  );
}

/** Topic icons: in a row the topic is a tinted icon, only dates stay as words (Lucian, 2026-10-28). */
const TOPIC_ICONS: Record<string, LucideIcon> = { Admin: FileText, Money: Wallet, Health: HeartPulse, People: Users, Errands: MapPin, Home: House, Business: Building2 };

export function TopicPill({ topic, mode }: { topic: string; mode: Mode }) {
  const c = TOPIC_COLORS[topic];
  const Icon = TOPIC_ICONS[topic];
  if (!c || !Icon) return null;
  return (
    <span role="img" aria-label={topic} title={topic} className="inline-flex h-[22px] w-[26px] items-center justify-center rounded-[8px]"
      style={mode === 'dark' ? { background: `${c.rail}33`, color: c.inkDark } : { background: c.bg, color: c.ink }}>
      <Icon size={14} strokeWidth={2.25} aria-hidden />
    </span>
  );
}

// ---- one row
interface RowProps {
  item: NowItem; today: string; mode: Mode;
  onDone: (i: NowItem) => void; onStar: (i: NowItem) => void; onOpen: (i: NowItem) => void;
  /** Long press lifts the row to drag it (into or out of the box, or to a new place). */
  onLift?: (i: NowItem, x: number, y: number) => void; lifted?: boolean;
}
function Row({ item, today, mode, onDone, onStar, onOpen, onLift, lifted }: RowProps) {
  const [ticked, setTicked] = useState(false);
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const hold = useLift(onLift ? (x, y) => onLift(item, x, y) : undefined);
  const starred = item.priority === 'P1';
  const amount = formatAmount(item.amount, item.currency);
  const tick = () => {
    if (ticked) return;
    setTicked(true); navigator.vibrate?.(10);
    window.setTimeout(() => onDone(item), 380);   // the check shows before the row goes
  };
  return (
    <div data-row={item.id} className={`relative select-none overflow-hidden rounded-[12px] ${lifted ? 'opacity-30' : ''}`} {...hold.mouse}
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null }; hold.touchStart(e.touches[0].clientX, e.touches[0].clientY); }}
      onTouchMove={e => {
        hold.touchMove(e.touches[0].clientX, e.touches[0].clientY);
        const t = touch.current; if (!t || hold.lifted()) return;
        const mx = e.touches[0].clientX - t.x, my = e.touches[0].clientY - t.y;
        if (t.horizontal === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) t.horizontal = Math.abs(mx) > Math.abs(my) && mx > 0;
        if (t.horizontal) { e.stopPropagation(); setDx(Math.max(0, Math.min(120, mx))); }
      }}
      onTouchEnd={e => { hold.touchEnd(e); if (touch.current?.horizontal) e.stopPropagation(); if (dx >= 90) tick(); setDx(0); touch.current = null; }}
      style={{ touchAction: 'pan-y' }}>
      {dx > 0 && (
        <div className={`absolute inset-y-0 left-0 flex items-center gap-1.5 pl-4 text-[15px] font-semibold text-white ${dx >= 90 ? 'bg-[#1d9e75]' : 'bg-[#1d9e75]/60'}`} style={{ width: dx }} aria-hidden>
          <Check size={18} strokeWidth={3} /> {dx >= 90 ? 'Done' : ''}
        </div>
      )}
      <div className={`flex items-start gap-1 py-1.5 pr-2 ${dx ? '' : 'transition-transform'} ${ticked ? 'opacity-50' : ''}`}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        <button type="button" onClick={tick} className="press flex h-10 w-10 shrink-0 items-center justify-center"
          aria-label={`Done: ${item.title.replace(/\*\*/g, '')}`}>
          <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-[8px] border-2 transition-colors ${
            ticked ? 'border-[#1d9e75] bg-[#1d9e75] text-white' : 'border-pc-border-strong bg-pc-elevated'}`}>
            {ticked && <Check size={14} strokeWidth={3.5} />}
          </span>
        </button>
        <button type="button" onClick={() => onStar(item)} className={`press flex h-10 w-10 shrink-0 items-center justify-center ${starred ? 'text-[#f5a623]' : 'text-pc-text-faint/60'}`}
          aria-label={starred ? 'Remove from priority' : 'Make it a priority'} aria-pressed={starred}>
          <Star size={20} strokeWidth={2} fill={starred ? 'currentColor' : 'none'} />
        </button>
        <span className="w-[30px] shrink-0 pr-1 pt-[9px] text-right text-[17px] font-bold leading-[22px] tracking-tight tabular-nums"
          style={{ color: ticked ? undefined : railOf(item) }} aria-label={item.n ? `number ${item.n}` : undefined}>
          {item.n ?? ''}
        </span>
        <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 py-[9px] text-left">
          <Title text={item.title} className={`block text-[16px] leading-[22px] ${ticked ? 'text-pc-text-muted line-through' : 'text-pc-text-primary'}`} />
          {(dueChip(item, today) || item.topics?.length || amount || item.repeat || item.focus) && (
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {item.focus && <Pin size={14} className="text-[#d48a12]" fill="currentColor" aria-label="Put in Now" />}
              <DueChip item={item} today={today} mode={mode} />
              {item.repeat && <span className="inline-flex h-[22px] items-center gap-1 text-[12px] font-medium text-pc-text-muted"><Repeat size={12} aria-hidden />{item.repeat}</span>}
              {item.topics?.map(t => <TopicPill key={t} topic={t} mode={mode} />)}
              {amount && <span className="text-[13px] font-medium tabular-nums text-pc-text-secondary">{amount}</span>}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}


function GroupHead({ dot, mark, label, count, color }: { dot?: string; mark?: ReactNode; label: string; count: number; color?: string }) {
  return (
    <h3 className="flex items-center gap-2 px-2 pb-0.5 pt-1 text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: color ?? 'var(--pc-text-secondary)' }}>
      {dot && <span className="h-[9px] w-[9px] rounded-full" style={{ background: dot }} aria-hidden />}
      {mark}
      {label}
      <span className="font-medium text-pc-text-faint">{count}</span>
    </h3>
  );
}

function TodoList({ items, today, mode, filter, onDone, onStar, onOpen, onMove }: {
  items: NowItem[]; today: string; mode: Mode; filter: 'priority' | 'deadlines' | null; onMove?: (m: Move<NowItem>) => void;
} & Omit<RowProps, 'item' | 'today' | 'mode'>) {
  const shown = filter === 'priority' ? items.filter(i => i.priority === 'P1') : filter === 'deadlines' ? items.filter(i => i.due_date || i.scheduled) : items;
  const g = groupTodo(shown, today);
  const zones: Record<string, NowItem[]> = { [BOX]: g.due, priority: g.priority, waiting: g.waiting, ...Object.fromEntries(g.areas.map(a => [a.area.id, a.items])) };
  const { drag, lift } = useDragDrop<NowItem>((item, from, over) => {
    const m = moveFor(item, from, over, z => (zones[z] ?? []).map(i => i.id));
    if (m) onMove?.(m);
  });
  const rows = (zone: string, list: NowItem[]) => (
    <>
      {list.map(i => (
        <div key={i.id}>
          <DropLine show={drag?.over?.zone === zone && drag.over.before === i.id} />
          <Row item={i} today={today} mode={mode} onDone={onDone} onStar={onStar} onOpen={onOpen}
            onLift={onMove ? (it, x, y) => lift(it, zone, x, y) : undefined} lifted={drag?.item.id === i.id} />
        </div>
      ))}
      <DropLine show={drag?.over?.zone === zone && drag.over.before === null && drag.item.id !== list[list.length - 1]?.id} />
    </>
  );
  const outline = (zone: string) => (drag && drag.from === zone && drag.over?.zone === zone ? DROP_OUTLINE : undefined);
  const red = g.due.some(i => dueChip(i, today)?.kind === 'overdue');
  return (
    <div className="space-y-5">
      {(g.due.length > 0 || drag) && (
        <section data-zone={BOX} className="rounded-[20px] px-1.5 pb-1.5 pt-2.5" style={{ ...BOX_GLOW[mode], ...(drag?.over?.zone === BOX ? DROP_OUTLINE : null) }}>
          <GroupHead mark={<Flag size={13} strokeWidth={2.75} fill="currentColor" aria-hidden />} label="Now" count={g.due.length} color={red ? '#dc4c4c' : BOX_INK} />
          {rows(BOX, g.due)}
          {g.due.length === 0 && <p className="px-3 py-6 text-center text-[15px] font-medium" style={{ color: BOX_INK }}>Drop here what you do now</p>}
        </section>
      )}
      {g.priority.length > 0 && (
        <section data-zone="priority" className="rounded-[16px] px-1.5" style={outline('priority')}>
          <GroupHead mark={<Star size={13} strokeWidth={2.5} fill="currentColor" aria-hidden />} label="Priority" count={g.priority.length} />
          {rows('priority', g.priority)}
        </section>
      )}
      {g.areas.map(({ area, items: list }) => (
        <section key={area.id} data-zone={area.id} className="rounded-[16px] px-1.5" style={outline(area.id)}>
          <GroupHead dot={area.dot} label={area.label} count={list.length} />
          {rows(area.id, list)}
        </section>
      ))}
      {g.waiting.length > 0 && (
        <section data-zone="waiting" className="rounded-[16px] px-1.5 opacity-80" style={outline('waiting')}>
          <GroupHead dot="var(--pc-text-faint)" label="Waiting on others" count={g.waiting.length} />
          {rows('waiting', g.waiting)}
        </section>
      )}
      {shown.length === 0 && (
        <p className="px-4 py-10 text-center text-[15px] text-pc-text-muted">{filter === 'priority' ? 'No priorities. Tap the star on a task to make it one.' : 'Nothing with a date.'}</p>
      )}
      {drag && (
        <DragGhost x={drag.x} y={drag.y}>
          <span className="mr-1.5 font-bold tabular-nums" style={{ color: railOf(drag.item) }}>{drag.item.n}</span>
          <Title text={drag.item.title} className="text-pc-text-primary" />
        </DragGhost>
      )}
    </div>
  );
}

// ---- adding a task: the same box and mic as the chat
function AddTask({ onAdd, transcribe, reply, onDismissReply }: {
  onAdd: (text: string) => void; transcribe: (a: OutgoingAttachment) => Promise<string>;
  reply: { text: string | null; asked: string; since: number } | null; onDismissReply: () => void;
}) {
  const now = useNow(!!reply && !reply.text);
  const [text, setText] = useDraft('task');
  const speech = useSpeech(text, setText, transcribe);
  useBusy('task', !!text.trim() || speech.listening || speech.state === 'writing');
  const add = () => {
    if (!text.trim()) return;
    speech.cancel(); onAdd(text.trim()); setText('');
  };
  return (
    <div>
      <p className="mb-1.5 ml-1 text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--pc-accent-ink)]">New task</p>
      <div className="flex items-end gap-2">
        <div className="relative flex min-w-0 flex-1 items-end overflow-hidden rounded-[12px] border border-[rgba(var(--pc-accent-rgb),0.32)] bg-[rgba(var(--pc-accent-rgb),0.04)] pl-4 pr-1.5 focus-within:border-pc-accent focus-within:bg-pc-elevated">
          <span className="absolute inset-y-0 left-0 w-1 bg-pc-accent" aria-hidden />
          <textarea value={text} rows={2} onChange={e => setText(e.target.value)} enterKeyHint="send" autoComplete="off"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }}
            readOnly={speech.state === 'writing'} aria-label="New task"
            placeholder={speechPlaceholder(speech, 'Say or type it, in any words')}
            className="min-h-[56px] min-w-0 flex-1 resize-none border-0 bg-transparent py-[9px] text-[16px] leading-[22px] shadow-none outline-none focus:outline-none focus-visible:outline-none placeholder:text-pc-text-muted" />
          <FieldControls speech={speech} hasText={!!text.trim()} onClear={() => { speech.cancel(); setText(''); }} />
        </div>
        <PrimaryButton speech={speech} canSend={!!text.trim()} onSend={add} size={56} />
      </div>
      <div className="mt-1.5"><SpeechStatus speech={speech} /></div>
      {speech.error && <p className="mt-1.5 px-1 text-[13px] text-red-500" role="alert">{speech.error}</p>}
      {reply && (
        <div className="mt-2 flex items-start gap-2 rounded-[12px] bg-pc-surface px-3 py-2" aria-live="polite">
          <Sparkles size={15} className={`mt-0.5 shrink-0 text-[var(--pc-accent-ink)] ${reply.text ? '' : 'animate-pulse'}`} />
          <div className="min-w-0 flex-1 text-[15px] leading-snug">
            <p className="truncate text-pc-text-muted">“{reply.asked}”</p>
            <p className="whitespace-pre-wrap text-pc-text">{reply.text ? <Title text={reply.text.replace(/\s*⟨[^⟩]+⟩/g, '')} /> : `Adding it · ${Math.max(0, Math.floor((now - reply.since) / 1000))} s`}</p>
            {!reply.text && <div className="mt-1.5 h-1 overflow-hidden rounded-[2px] bg-[var(--pc-separator)]" aria-hidden><div className="progress-indeterminate h-full w-1/3 rounded-[2px] bg-pc-accent" /></div>}
          </div>
          {reply.text && <button type="button" onClick={onDismissReply} className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted" aria-label="Dismiss"><X size={14} /></button>}
        </div>
      )}
    </div>
  );
}

// ---- the panel
export interface TodoPanelProps {
  mode: Mode;
  tab: TodoTab; onTab: (t: TodoTab) => void;
  items: NowItem[]; loops: Loop[]; today: string;
  loaded: boolean; expired: boolean; refreshing: boolean; onRefresh: () => void;
  onDone: (i: NowItem) => void; onStar: (i: NowItem) => void; onOpen: (id: string) => void;
  /** A drag: into or out of the box, or a new order. */
  onMove?: (m: Move<NowItem>) => void;
  onContinue: (l: Loop) => void;
  onAdd: (text: string) => void; transcribe: (a: OutgoingAttachment) => Promise<string>;
  reply: { text: string | null; asked: string; since: number } | null; onDismissReply: () => void;
  /** Phone: close back to the chat. Absent on a laptop (the panel is a column). */
  onClose?: () => void;
  /** The undo bar, when this panel is the surface on top. */
  footer?: ReactNode;
}

export function TodoPanel(p: TodoPanelProps) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'priority' | 'deadlines' | null>(null);
  const [showPutOff, setShowPutOff] = useState(false);
  const spinning = useDelayedFlag(p.refreshing);
  // Put off ("Remind in 3 days") stays out of the way until its day; a search still finds it.
  const putOff = p.items.filter(i => i.hidden);
  const visible = showPutOff ? p.items : p.items.filter(i => !i.hidden);
  const items = q.trim() ? p.items.filter(i => matches(i, q)) : visible;
  const chip = (on: boolean) => `inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium ${on ? 'border-pc-text bg-pc-text text-pc-base' : 'border-pc-border-strong text-pc-text-secondary'}`;
  return (
    <div className="flex h-full flex-col bg-pc-elevated">
      <header className={`shrink-0 bg-pc-elevated ${p.onClose ? 'pt-[env(safe-area-inset-top)]' : ''}`}>
        {p.onClose && (
          <div className="flex h-[52px] items-center gap-1 pl-4 pr-1">
            <h2 className="min-w-0 flex-1 text-[28px] font-bold tracking-tight">{p.tab === 'todo' ? 'To do' : 'In progress'}</h2>
            <button type="button" onClick={p.onRefresh} className="flex h-10 w-10 items-center justify-center rounded-full text-pc-text-muted active:bg-[var(--pc-hover-strong)]" aria-label="Refresh">
              <RefreshCw size={18} className={spinning ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={p.onClose} className="flex h-10 items-center gap-0.5 rounded-full px-2 text-[16px] font-medium text-[var(--pc-accent-ink)] active:opacity-60" aria-label="Back to the chat">
              Chat <ChevronRight size={20} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 pb-2 pt-1">
          <Segmented<TodoTab> value={p.tab} onChange={p.onTab} label="Lists"
            options={[{ value: 'todo', label: 'To do', count: p.items.filter(i => !i.hidden).length }, { value: 'progress', label: 'In progress', count: p.loops.length }]} />
          {!p.onClose && (
            <button type="button" onClick={p.onRefresh} className="press flex h-10 w-10 items-center justify-center rounded-full text-pc-text-muted active:bg-[var(--pc-hover-strong)]" aria-label="Refresh">
              <RefreshCw size={16} className={spinning ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {p.expired ? (
          <p className="px-2 py-6 text-[15px] text-pc-text-muted">Signed out of the lists. <a href="/" className="text-[var(--pc-accent-ink)]">Sign in again</a></p>
        ) : p.tab === 'progress' ? (
          <LoopsList loops={p.loops} today={p.today} onContinue={p.onContinue} onOpen={l => p.onOpen(l.id)} />
        ) : (
          <div className="space-y-4 pt-1">
            <label className="flex h-10 items-center gap-2 rounded-[12px] bg-pc-surface px-3">
              <Search size={17} className="shrink-0 text-pc-text-muted" />
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search tasks, people, numbers" enterKeyHint="search"
                className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none focus:outline-none focus-visible:outline-none placeholder:text-pc-text-muted [&::-webkit-search-cancel-button]:hidden" />
              {q && <button type="button" onClick={() => setQ('')} className="flex h-5 w-5 items-center justify-center rounded-full bg-pc-text-faint text-pc-surface" aria-label="Clear search"><X size={11} strokeWidth={3} /></button>}
            </label>
            {!q && <AddTask onAdd={p.onAdd} transcribe={p.transcribe} reply={p.reply} onDismissReply={p.onDismissReply} />}
            {p.items.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="mr-0.5 text-[12px] font-bold uppercase tracking-[0.06em] text-pc-text-faint">Show</span>
                <button type="button" className={chip(filter === 'priority')} aria-pressed={filter === 'priority'} onClick={() => setFilter(f => (f === 'priority' ? null : 'priority'))}><Star size={13} strokeWidth={2.5} fill="currentColor" className="mr-1" aria-hidden />Priority</button>
                <button type="button" className={chip(filter === 'deadlines')} aria-pressed={filter === 'deadlines'} onClick={() => setFilter(f => (f === 'deadlines' ? null : 'deadlines'))}>Deadlines</button>
              </div>
            )}
            {!p.loaded ? <p className="px-2 py-6 text-[15px] text-pc-text-muted">Loading…</p>
              : p.items.length === 0 ? (
                <div className="flex flex-col items-center px-8 py-10 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.12)] text-[var(--pc-accent-ink)]"><Check size={24} /></span>
                  <p className="text-[16px] font-semibold">All clear</p>
                  <p className="mt-1 text-[15px] text-pc-text-muted">Nothing needs you right now.</p>
                </div>
              ) : items.length === 0 && q.trim() ? <p className="px-2 py-8 text-center text-[15px] text-pc-text-muted">Nothing matches “{q.trim()}”</p>
              : items.length === 0 ? <p className="px-2 py-8 text-center text-[15px] text-pc-text-muted">All clear for now: everything left is put off until later.</p>
              : <TodoList items={items} today={p.today} mode={p.mode} filter={filter} onDone={p.onDone} onStar={p.onStar} onOpen={i => p.onOpen(i.id)} onMove={p.onMove} />}
            {putOff.length > 0 && !q.trim() && (
              <button type="button" onClick={() => setShowPutOff(v => !v)} className="press flex h-10 w-full items-center gap-2 px-2 text-left text-[15px] text-pc-text-muted" aria-expanded={showPutOff}>
                <Clock size={16} aria-hidden /> {putOff.length} put off until later · <span className="font-medium text-[var(--pc-accent-ink)]">{showPutOff ? 'Hide' : 'Show'}</span>
              </button>
            )}
            {p.items.length > 0 && <p className="px-2 text-[12px] text-pc-text-faint">Swipe a task right to finish it. Hold one and drag it: into the box to put it in Now, out to take it out, up or down to reorder. Say “22 done” in the chat to finish one by number.</p>}
          </div>
        )}
      </div>
      {p.footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">{p.footer}</div>}
    </div>
  );
}
