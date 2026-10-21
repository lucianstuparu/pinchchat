import { useEffect, useState } from 'react';
import { Ban, CalendarClock, Check, Clock, ListChecks, MessageSquare, MessagesSquare, Receipt, Repeat, ShoppingCart, Undo2, X } from 'lucide-react';
import { act, domainEmoji, fetchSheet, formatAmount, formatDay, type ItemAction, type Sheet } from './api';

/**
 * Details of one item (app v2 §2): what it is, where it came from, and what can be done with it.
 * Opens from a To do row, a chip in the chat, or an In progress topic.
 */
interface Props {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  /** Put text into the composer (ask about it, continue, schedule). */
  onAsk: (text: string, send?: boolean) => void;
}

const CLOSED = ['paid', 'done', 'cancelled', 'closed'];
const KIND: Record<string, { icon: typeof Receipt; label: string }> = {
  bill: { icon: Receipt, label: 'Bill' }, deadline: { icon: CalendarClock, label: 'Deadline' }, subscription: { icon: Repeat, label: 'Subscription' },
  contract: { icon: Receipt, label: 'Contract' }, task: { icon: ListChecks, label: 'Task' }, buy: { icon: ShoppingCart, label: 'Shopping' },
  loop: { icon: MessagesSquare, label: 'In progress' },
};
const STATUS: Record<string, string> = { todo: 'To do', open: 'Open', next: 'Next', waiting: 'Waiting', paid: 'Paid', done: 'Done', cancelled: 'Not needed', closed: 'Finished' };
const PRIORITY = [['P1', 'Urgent'], ['P2', 'High'], ['P3', 'Normal'], ['P4', 'Low']] as const;

export function ItemSheet({ id, onClose, onChanged, onAsk }: Props) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetchSheet(id).then(s => { setSheet(s); setError(null); }).catch(e => setError(e.message));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: ItemAction, extra?: Record<string, unknown>) => {
    setBusy(true);
    try { await act(id, action, extra); await load(); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const it = sheet?.item;
  const closed = !!it && CLOSED.includes(it.status);
  const kind = (it?.kind as string) || (it?.store === 'loops' ? 'loop' : 'task');
  const K = KIND[kind] ?? KIND.task;
  const str = (k: string) => (it && typeof it[k] === 'string' ? (it[k] as string) : undefined);
  const num = (k: string) => (it && typeof it[k] === 'number' ? (it[k] as number) : undefined);
  const isTopic = kind === 'loop';

  const rows: Array<[string, string]> = it ? ([
    ['Amount', num('amount') != null ? formatAmount(num('amount'), str('currency')) : ''],
    ['Due', str('due_date') ? formatDay(str('due_date')!) : ''],
    ['Scheduled', str('scheduled')?.replace('T', ' ') ?? ''],
    ['Reminder', str('remind_on') && !closed ? formatDay(str('remind_on')!) : ''],
    ['To', str('payee') ?? ''],
    ['If missed', str('consequence') ?? ''],
    ['Where it stands', str('state') ?? ''],
    ['Next step', str('next_step') ?? ''],
    ['Outcome', str('outcome') ?? ''],
  ] as Array<[string, string]>).filter(([, v]) => v) : [];

  const secondary = 'flex flex-col items-center justify-center gap-1 rounded-2xl bg-pc-surface py-3 text-[13px] text-pc-text active:bg-[var(--pc-hover-strong)] disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={it?.title ?? 'Item'}>
      <div className="absolute inset-0 bg-[var(--pc-scrim,rgba(0,0,0,0.3))]" onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[22px] bg-pc-elevated px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl md:max-w-lg md:rounded-[22px]">
        <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-pc-text-faint/50 md:hidden" />
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-pc-surface text-pc-text-muted" aria-label="Close"><X size={16} strokeWidth={2.5} /></button>
        </div>
        {!it && !error && <p className="py-10 text-center text-sm text-pc-text-muted">Loading…</p>}
        {error && <p className="py-2 text-sm text-red-500">{error}</p>}
        {it && (
          <>
            <div className="-mt-2 mb-4">
              <p className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-pc-accent">
                <K.icon size={14} /> {K.label}{domainEmoji(str('domain')) ? ` · ${domainEmoji(str('domain'))} ${str('domain')}` : ''}{it.scope === 'shared' ? ' · shared' : ''}
              </p>
              <h2 className={`pr-6 text-[22px] font-bold leading-tight ${closed ? 'text-pc-text-muted line-through' : 'text-pc-text-primary'}`}>{it.title}</h2>
              {closed && <p className="mt-1 text-[14px] text-pc-text-muted">{STATUS[it.status] ?? it.status}</p>}
            </div>

            {rows.length > 0 && (
              <dl className="mb-3 divide-y divide-[var(--pc-separator)] rounded-2xl bg-pc-surface px-4">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
                    <dt className="shrink-0 text-pc-text-muted">{k}</dt>
                    <dd className="min-w-0 text-right tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {str('notes') && <p className="mb-3 whitespace-pre-wrap rounded-2xl bg-pc-surface px-4 py-3 text-[14px] text-pc-text-secondary">{str('notes')}</p>}

            {sheet?.origin && (
              <div className="mb-3 rounded-2xl bg-pc-surface px-4 py-3 text-[14px]">
                <p className="mb-1 text-[12px] font-medium text-pc-text-muted">Came from</p>
                {sheet.origin.kind === 'message'
                  ? <p className="whitespace-pre-wrap">“{sheet.origin.text}”<span className="mt-1 block text-[12px] text-pc-text-faint">{sheet.origin.ts?.slice(0, 10)}</span></p>
                  : <p className="text-pc-text-secondary">An email. Ask about it to have it opened.</p>}
              </div>
            )}

            {closed ? (
              <button type="button" disabled={busy} onClick={() => void run('reopen')} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-pc-surface text-[16px] font-semibold disabled:opacity-60">
                <Undo2 size={18} /> Reopen
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => void run('done')}
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-pc-accent text-[16px] font-semibold text-white active:opacity-80 disabled:opacity-60">
                  <Check size={19} strokeWidth={2.5} /> {kind === 'bill' ? 'Mark as paid' : isTopic ? 'It’s settled' : 'Done'}
                </button>
                <div className="mt-2 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
                  {isTopic
                    ? <button type="button" onClick={() => { onAsk(`Continue: ${it.title} ⟨${id}⟩`, true); onClose(); }} className={secondary}><MessageSquare size={19} className="text-pc-accent" /> Continue</button>
                    : <button type="button" disabled={busy} onClick={() => void run('snooze')} className={secondary}><Clock size={19} className="text-pc-accent" /> In 3 days</button>}
                  {!isTopic && <button type="button" onClick={() => { onAsk(`About ⟨${id}⟩: `); onClose(); }} className={secondary}><MessageSquare size={19} className="text-pc-accent" /> Ask</button>}
                  {it.store === 'tasks' && !str('scheduled') && (
                    <button type="button" onClick={() => { onAsk(`Schedule ⟨${id}⟩ for `); onClose(); }} className={secondary}><CalendarClock size={19} className="text-pc-accent" /> Schedule</button>
                  )}
                  {it.store === 'admin' && (
                    <button type="button" disabled={busy} onClick={() => void run('to-task')} className={secondary}><ListChecks size={19} className="text-pc-accent" /> Make a task</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => void run('drop')} className={secondary}><Ban size={19} className="text-pc-text-muted" /> Not needed</button>
                </div>
                {!isTopic && (
                  <div className="mt-4">
                    <p className="mb-1.5 px-1 text-[13px] text-pc-text-muted">Priority</p>
                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-pc-surface p-1">
                      {PRIORITY.map(([p, label]) => {
                        const on = str('priority') === p || (!str('priority') && p === 'P3');
                        return (
                          <button key={p} type="button" disabled={busy} onClick={() => void run('priority', { priority: p })}
                            className={`h-8 rounded-lg text-[13px] font-medium ${on ? `bg-pc-elevated shadow-sm ${p === 'P1' ? 'text-red-500' : 'text-pc-text'}` : 'text-pc-text-muted'}`}>{label}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
