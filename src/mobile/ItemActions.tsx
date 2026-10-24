import { useEffect, useState } from 'react';
import { Ban, CalendarClock, Check, CheckCircle2, CircleDot, Clock, ListChecks, Receipt, Repeat, ShoppingCart, Undo2, Users, X } from 'lucide-react';
import {
  actOnItem, fetchItemStates, formatAmount, formatDay, isClosed, urgency,
  type ItemAction, type ItemState, type MessageItem,
} from './messageItems';

/** The status line of an open card: what to know at a glance, in a colour that says how urgent. */
function dueLine(s: ItemState | undefined, today: string): { text: string; tone: string } {
  switch (urgency(s, today)) {
    case 'overdue': return { text: `Overdue · was due ${formatDay(s!.due_date!)}`, tone: 'text-red-600' };
    case 'today': return { text: 'Due today', tone: 'text-amber-600' };
    case 'soon': return { text: `Due ${formatDay(s!.due_date!)}`, tone: 'text-amber-600' };
    case 'later': return { text: `Due ${formatDay(s!.due_date!)}`, tone: 'text-pc-text-muted' };
    default: return { text: s?.kind === 'buy' ? 'Shopping' : 'No date', tone: 'text-pc-text-muted' };
  }
}

const closedWord = (status: string) => (status === 'paid' ? 'Paid' : status === 'cancelled' ? 'Dropped' : 'Done');

/** One icon per kind of item, so a glance tells a bill from a task from a shopping item. */
const KIND_ICONS = { bill: Receipt, deadline: CalendarClock, subscription: Repeat, contract: Receipt, task: ListChecks, buy: ShoppingCart } as const;
const kindIcon = (kind?: string) => KIND_ICONS[kind as keyof typeof KIND_ICONS] ?? CircleDot;

/** One card per register item named in a message: read at a glance, one tap to act. */
export function ItemActions({ items }: { items: MessageItem[] }) {
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [today, setToday] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snoozedNow, setSnoozedNow] = useState<Set<string>>(new Set()); // snoozed by a tap here
  const ids = items.map(i => i.id).join(',');

  useEffect(() => {
    let alive = true;
    fetchItemStates(ids.split(','))
      .then(r => { if (alive) { setStates(r.items); setToday(r.today); } })
      .catch(() => { /* offline or not signed in: the buttons still try, and say if it fails */ });
    return () => { alive = false; };
  }, [ids]);

  const act = async (id: string, action: ItemAction) => {
    setBusy(id); setError(null);
    try {
      const r = await actOnItem(id, action);
      setStates(s => ({ ...s, [id]: { ...s[id], status: r.status, remind_on: r.remind_on } }));
      setSnoozedNow(prev => { const n = new Set(prev); if (action === 'snooze') n.add(id); else n.delete(id); return n; });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change it');
    } finally {
      setBusy(null);
    }
  };

  // Overdue first, then by due date; items without a date last.
  const order = [...items].sort((a, b) => (states[a.id]?.due_date ?? '9999').localeCompare(states[b.id]?.due_date ?? '9999'));

  return (
    <div className="mt-2 -mx-1.5 space-y-2" aria-label="Items">
      {order.map(item => {
        const s = states[item.id];
        const title = s?.title || item.label || item.id;
        const amount = formatAmount(s?.amount, s?.currency);
        const isBusy = busy === item.id;

        if (isClosed(s)) {
          return (
            <div key={item.id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-pc-text-muted bg-[var(--pc-hover)]">
              {s!.status === 'cancelled'
                ? <Ban size={15} className="shrink-0 text-pc-text-faint" />
                : <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />}
              <span className="min-w-0 flex-1 truncate line-through">{title}</span>
              <span className="shrink-0">{closedWord(s!.status)}</span>
              <button type="button" disabled={isBusy} onClick={() => void act(item.id, 'reopen')}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--pc-hover-strong)] disabled:opacity-50" aria-label="Undo">
                <Undo2 size={15} />
              </button>
            </div>
          );
        }

        const due = dueLine(s, today);
        const u = urgency(s, today);
        const edge = u === 'overdue' ? 'border-l-red-500' : u === 'today' || u === 'soon' ? 'border-l-amber-500' : 'border-l-transparent';
        const snoozed = snoozedNow.has(item.id) && !!s?.remind_on;
        const Kind = kindIcon(s?.kind);
        const tint = u === 'overdue' ? 'bg-red-100 text-red-600' : u === 'today' || u === 'soon' ? 'bg-amber-100 text-amber-700' : 'bg-[var(--pc-hover-strong)] text-pc-text-secondary';

        return (
          <div key={item.id} className={`rounded-xl border border-pc-border border-l-[3px] ${edge} bg-pc-elevated px-3 py-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.04)]`}>
            <div className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide ${due.tone}`}>
              <span>{due.text}{snoozed && <span className="text-pc-text-muted"> · snoozed to {formatDay(s!.remind_on!)}</span>}</span>
              {s?.scope === 'shared' && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--pc-hover-strong)] px-1.5 py-0.5 normal-case tracking-normal text-pc-text-muted">
                  <Users size={11} /> shared
                </span>
              )}
            </div>
            <div className="mt-1 flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`} aria-hidden>
                <Kind size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-snug text-pc-text-primary">{title}</div>
                {s?.payee && s.payee !== title && <div className="truncate text-[12px] text-pc-text-muted">{s.payee}</div>}
              </div>
              {amount && <div className="shrink-0 text-[17px] font-semibold tabular-nums leading-snug">{amount}</div>}
            </div>
            <div className="mt-2.5 flex items-center gap-1">
              <button type="button" disabled={isBusy} onClick={() => void act(item.id, 'done')}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-pc-accent text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-60">
                <Check size={16} /> {s?.kind === 'bill' ? 'Paid' : 'Done'}
              </button>
              <button type="button" disabled={isBusy} onClick={() => void act(item.id, 'snooze')}
                className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[13px] text-pc-text-secondary hover:bg-[var(--pc-hover)] disabled:opacity-60">
                <Clock size={14} /> Snooze
              </button>
              <button type="button" disabled={isBusy} onClick={() => void act(item.id, 'drop')}
                className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[13px] text-pc-text-muted hover:bg-[var(--pc-hover)] disabled:opacity-60">
                <X size={14} /> Drop
              </button>
            </div>
          </div>
        );
      })}
      {error && <p className="px-1 text-[12px] text-red-500">{error}</p>}
    </div>
  );
}
