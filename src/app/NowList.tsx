import { useRef, useState } from 'react';
import { Check, ChevronRight, Clock, Users } from 'lucide-react';
import { domainEmoji, formatAmount, whenLabel, type NowItem, type Section } from './api';

/**
 * "To do" (app v2 §2): what needs the person, ranked and grouped by when. Tap the circle to tick
 * it off, swipe right to put it off 3 days, tap the row for details.
 */
interface Props {
  items: NowItem[];
  today: string;
  onDone: (item: NowItem) => void;
  onSnooze: (item: NowItem) => void;
  onOpen: (item: NowItem) => void;
  busy: string | null;
}

const SECTION_LABEL: Record<Section, string> = { overdue: 'Overdue', today: 'Today', week: 'This week', waiting: 'Waiting on others', later: 'Later' };
const SECTION_COLOR: Record<Section, string> = { overdue: 'text-red-500', today: 'text-pc-accent', week: 'text-pc-text', waiting: 'text-pc-text-muted', later: 'text-pc-text-muted' };
const SECTION_ORDER: Section[] = ['overdue', 'today', 'week', 'waiting', 'later'];


function Row({ item, today, onDone, onSnooze, onOpen, busy }: { item: NowItem; today: string } & Omit<Props, 'items' | 'today'>) {
  const [dx, setDx] = useState(0);
  const [ticked, setTicked] = useState(false);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const when = whenLabel(item, today);
  const amount = formatAmount(item.amount, item.currency);
  const urgent = item.priority === 'P1';
  const tick = () => {
    if (ticked || busy === item.id) return;
    setTicked(true);
    window.setTimeout(() => onDone(item), 380);   // let the check show before the row goes
  };
  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null }; }}
      onTouchMove={e => {
        const t = touch.current; if (!t) return;
        const ddx = e.touches[0].clientX - t.x, ddy = e.touches[0].clientY - t.y;
        if (t.horizontal === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) t.horizontal = Math.abs(ddx) > Math.abs(ddy);
        if (t.horizontal) setDx(Math.max(0, Math.min(110, ddx)));
      }}
      onTouchEnd={() => { if (dx >= 80) onSnooze(item); setDx(0); touch.current = null; }}
      style={{ touchAction: 'pan-y' }}
    >
      {dx > 0 && (
        <div className={`absolute inset-y-0 left-0 flex items-center gap-1.5 pl-4 text-[13px] font-medium text-white ${dx >= 80 ? 'bg-amber-500' : 'bg-amber-400/70'}`} style={{ width: dx }} aria-hidden>
          <Clock size={16} /> {dx >= 80 ? '3 days' : ''}
        </div>
      )}
      <div className={`flex items-center gap-1 bg-pc-elevated py-2 pr-1 ${dx ? '' : 'transition-transform'} ${ticked ? 'opacity-60' : ''}`}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        <button type="button" onClick={tick} disabled={busy === item.id}
          className="flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`Mark “${item.title}” ${item.kind === 'bill' ? 'paid' : 'done'}`}>
          <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.75px] transition-colors ${
            ticked ? 'border-pc-accent bg-pc-accent text-white' : urgent ? 'border-red-500' : 'border-pc-text-faint'}`}>
            {ticked && <Check size={14} strokeWidth={3} />}
          </span>
        </button>
        <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[16px] leading-snug ${ticked ? 'line-through text-pc-text-muted' : 'text-pc-text-primary'}`}>
              {item.title}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-tight text-pc-text-muted">
              {domainEmoji(item.domain) && <span aria-hidden className="text-[12px]">{domainEmoji(item.domain)}</span>}
              {when && <span className={`shrink-0 ${when.cls}`}>{when.text}</span>}
              {item.consequence && <span className="min-w-0 truncate">{when ? '· ' : ''}{item.consequence}</span>}
              {item.scope === 'shared' && <Users size={12} className="shrink-0" aria-label="shared" />}
            </span>
          </span>
          {amount && <span className="shrink-0 text-[15px] tabular-nums text-pc-text-secondary">{amount}</span>}
          <ChevronRight size={17} className="shrink-0 text-pc-text-faint" />
        </button>
      </div>
    </div>
  );
}

export function NowList({ items, today, onDone, onSnooze, onOpen, busy }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-8 py-12 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.12)] text-pc-accent"><Check size={24} /></span>
        <p className="text-[16px] font-semibold">All clear</p>
        <p className="mt-1 text-[14px] text-pc-text-muted">Nothing needs you right now.</p>
      </div>
    );
  }
  return (
    <div>
      {SECTION_ORDER.map(sec => {
        const group = items.filter(i => i.section === sec);
        if (group.length === 0) return null;
        return (
          <section key={sec} className="pb-2">
            <h3 className={`px-4 pt-3 pb-0.5 text-[15px] font-semibold ${SECTION_COLOR[sec]}`}>{SECTION_LABEL[sec]}</h3>
            <div className="divide-y divide-[var(--pc-separator)]">
              {group.map(i => <Row key={i.id} item={i} today={today} onDone={onDone} onSnooze={onSnooze} onOpen={onOpen} busy={busy} />)}
            </div>
          </section>
        );
      })}
      <p className="px-4 pb-4 pt-2 text-[12px] text-pc-text-faint">Swipe right on a row to put it off 3 days.</p>
    </div>
  );
}
