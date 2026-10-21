import { useRef, useState } from 'react';
import { ChevronRight, Circle, Clock, Users } from 'lucide-react';
import { domainEmoji, formatAmount, formatDay, type NowItem, type Section } from './api';

/**
 * The Now band (app v2 §2): a flat, Todoist-like list of what needs the person, ranked.
 * Circle = done, swipe right = snooze 3 days, chevron = the sheet. Colour only on the date and P1.
 */
interface Props {
  items: NowItem[];
  today: string;
  expanded: boolean;
  onExpand: (v: boolean) => void;
  onDone: (item: NowItem) => void;
  onSnooze: (item: NowItem) => void;
  onOpen: (item: NowItem) => void;
  busy: string | null;
}

const LIMIT = 5;
const SECTION_LABEL: Record<Section, string> = { overdue: 'Overdue', today: 'Today', week: 'This week', waiting: 'Waiting', later: 'Later' };
const SECTION_ORDER: Section[] = ['overdue', 'today', 'week', 'waiting', 'later'];

function dateChip(item: NowItem, today: string) {
  const due = item.due_date || item.scheduled?.slice(0, 10);
  if (item.section === 'waiting') return { text: 'waiting', cls: 'text-pc-text-muted' };
  if (!due) return null;
  if (item.section === 'overdue') return { text: formatDay(due), cls: 'text-red-600 font-medium' };
  if (item.section === 'today') return { text: 'Today', cls: 'text-amber-700 font-medium' };
  if (due === nextDay(today)) return { text: 'Tomorrow', cls: 'text-amber-700' };
  return { text: formatDay(due), cls: 'text-pc-text-muted' };
}
const nextDay = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);

function Row({ item, today, onDone, onSnooze, onOpen, busy }: { item: NowItem; today: string } & Pick<Props, 'onDone' | 'onSnooze' | 'onOpen' | 'busy'>) {
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const chip = dateChip(item, today);
  const amount = formatAmount(item.amount, item.currency);
  const isBusy = busy === item.id;
  return (
    <div
      className="relative"
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null }; }}
      onTouchMove={e => {
        const t = touch.current; if (!t) return;
        const ddx = e.touches[0].clientX - t.x, ddy = e.touches[0].clientY - t.y;
        if (t.horizontal === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) t.horizontal = Math.abs(ddx) > Math.abs(ddy);
        if (t.horizontal) setDx(Math.max(0, Math.min(96, ddx)));
      }}
      onTouchEnd={() => { if (dx >= 72) onSnooze(item); setDx(0); touch.current = null; }}
      style={{ touchAction: 'pan-y' }}
    >
      {dx > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-[12px] text-pc-text-muted" aria-hidden>
          <Clock size={14} className="mr-1" /> {dx >= 72 ? 'Snooze 3 days' : ''}
        </div>
      )}
      <div
        className={`flex items-center gap-2.5 bg-pc-base py-2 ${dx ? '' : 'transition-transform'}`}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
      >
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onDone(item)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${item.priority === 'P1' ? 'text-red-500' : 'text-pc-text-faint'} hover:text-pc-accent`}
          aria-label={`Mark "${item.title}" ${item.kind === 'bill' ? 'paid' : 'done'}`}
        >
          <Circle size={20} strokeWidth={item.priority === 'P1' ? 2.5 : 1.75} />
        </button>
        <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] leading-snug text-pc-text-primary">{domainEmoji(item.domain) && <span className="mr-1.5" aria-hidden>{domainEmoji(item.domain)}</span>}{item.title}</span>
            {(chip || item.scope === 'shared' || item.consequence) && (
              <span className="mt-0.5 flex items-center gap-2 text-[12px] leading-tight">
                {chip && <span className={chip.cls}>{chip.text}</span>}
                {item.consequence && <span className="truncate text-pc-text-muted">{item.consequence}</span>}
                {item.scope === 'shared' && <Users size={12} className="shrink-0 text-pc-text-faint" aria-label="shared" />}
              </span>
            )}
          </span>
          {amount && <span className="shrink-0 text-[15px] tabular-nums text-pc-text-secondary">{amount}</span>}
          <ChevronRight size={16} className="shrink-0 text-pc-text-faint" />
        </button>
      </div>
    </div>
  );
}

export function NowList({ items, today, expanded, onExpand, onDone, onSnooze, onOpen, busy }: Props) {
  if (items.length === 0) {
    return <p className="px-4 py-3 text-[14px] text-pc-text-muted">Nothing needs you right now.</p>;
  }
  if (!expanded) {
    const top = items.slice(0, LIMIT);
    const rest = items.length - top.length;
    return (
      <div className="px-4 divide-y divide-[var(--pc-separator)]">
        {top.map(i => <Row key={i.id} item={i} today={today} onDone={onDone} onSnooze={onSnooze} onOpen={onOpen} busy={busy} />)}
        {rest > 0 && (
          <button type="button" onClick={() => onExpand(true)} className="w-full py-2 text-left text-[13px] text-pc-accent">
            {rest} more
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="px-4">
      {SECTION_ORDER.map(sec => {
        const group = items.filter(i => i.section === sec);
        if (group.length === 0) return null;
        return (
          <div key={sec} className="pb-2">
            <h3 className="pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted">{SECTION_LABEL[sec]} · {group.length}</h3>
            <div className="divide-y divide-[var(--pc-separator)]">
              {group.map(i => <Row key={i.id} item={i} today={today} onDone={onDone} onSnooze={onSnooze} onOpen={onOpen} busy={busy} />)}
            </div>
          </div>
        );
      })}
      <button type="button" onClick={() => onExpand(false)} className="w-full py-2 text-left text-[13px] text-pc-accent">Show less</button>
    </div>
  );
}
