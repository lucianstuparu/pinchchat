import { useEffect, useState } from 'react';
import { CalendarClock, Check, ListChecks, MessageSquare, Receipt, Repeat, ShoppingCart } from 'lucide-react';
import { domainEmoji, fetchStates, type NowItem } from './api';

/** Items a chat message names, as small chips that open the sheet (app v2: no cards in messages). */
const ICON: Record<string, typeof Receipt> = { bill: Receipt, deadline: CalendarClock, subscription: Repeat, contract: Receipt, task: ListChecks, buy: ShoppingCart, loop: MessageSquare };
const CLOSED = ['paid', 'done', 'cancelled', 'closed'];

export function ItemChips({ items, onOpen }: { items: Array<{ id: string; label: string }>; onOpen: (id: string) => void }) {
  const [states, setStates] = useState<Record<string, Partial<NowItem>>>({});
  const ids = items.map(i => i.id).join(',');
  useEffect(() => {
    let alive = true;
    fetchStates(ids.split(',')).then(r => { if (alive) setStates(r.items); }).catch(() => { /* chips still open the sheet */ });
    return () => { alive = false; };
  }, [ids]);
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map(i => {
        const s = states[i.id];
        const kind = s?.kind ?? (i.id.startsWith('lp-') ? 'loop' : 'task');
        const Icon = ICON[kind] ?? ListChecks;
        const closed = !!s && CLOSED.includes(s.status ?? '');
        return (
          <button key={i.id} type="button" onClick={() => onOpen(i.id)}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-pc-border bg-pc-elevated px-2.5 py-1 text-[13px] ${closed ? 'text-pc-text-muted line-through' : ''}`}>
            {closed ? <Check size={13} className="shrink-0 text-emerald-600" /> : <Icon size={13} className="shrink-0 text-pc-accent" />}
            <span className="truncate">{domainEmoji(s?.domain) ? `${domainEmoji(s?.domain)} ` : ''}{s?.title ?? i.label ?? i.id}</span>
          </button>
        );
      })}
    </div>
  );
}
