import { useEffect, useState } from 'react';
import { Ban, CalendarClock, Check, Clock, ListChecks, MessageSquare, Receipt, Repeat, ShoppingCart, Undo2, X } from 'lucide-react';
import { act, fetchSheet, formatAmount, formatDay, type ItemAction, type Sheet } from './api';

/**
 * The item sheet (app v2 §2): what an item is, where it came from, its history, and the actions.
 * Opens from a Now row, a chip in the chat, or a loop.
 */
interface Props {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  /** Put text into the composer (ask about it, continue a loop, schedule). */
  onAsk: (text: string, send?: boolean) => void;
}

const CLOSED = ['paid', 'done', 'cancelled', 'closed'];
const KIND_ICON: Record<string, typeof Receipt> = { bill: Receipt, deadline: CalendarClock, subscription: Repeat, contract: Receipt, task: ListChecks, buy: ShoppingCart, loop: MessageSquare };

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
  const Icon = KIND_ICON[kind] ?? ListChecks;
  const str = (k: string) => (it && typeof it[k] === 'string' ? (it[k] as string) : undefined);
  const num = (k: string) => (it && typeof it[k] === 'number' ? (it[k] as number) : undefined);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={it?.title ?? 'Item'}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-pc-elevated px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl md:max-w-lg md:rounded-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-pc-border md:hidden" />
        {!it && !error && <p className="py-6 text-center text-sm text-pc-text-muted">Loading…</p>}
        {error && <p className="py-2 text-sm text-red-500">{error}</p>}
        {it && (
          <>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--pc-hover-strong)] text-pc-text-secondary"><Icon size={18} /></span>
              <div className="min-w-0 flex-1">
                <h2 className={`text-[17px] font-semibold leading-snug ${closed ? 'line-through text-pc-text-muted' : 'text-pc-text-primary'}`}>{it.title}</h2>
                <p className="mt-0.5 text-[12px] text-pc-text-muted">
                  {[kind, str('priority'), it.scope === 'shared' ? 'shared' : null, str('domain'), it.status].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Close"><X size={18} /></button>
            </div>

            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
              {num('amount') != null && <><dt className="text-pc-text-muted">Amount</dt><dd className="tabular-nums">{formatAmount(num('amount'), str('currency'))}</dd></>}
              {str('due_date') && <><dt className="text-pc-text-muted">Due</dt><dd>{formatDay(str('due_date')!)}</dd></>}
              {str('scheduled') && <><dt className="text-pc-text-muted">Scheduled</dt><dd>{str('scheduled')!.replace('T', ' ')}</dd></>}
              {str('remind_on') && !closed && <><dt className="text-pc-text-muted">Next nudge</dt><dd>{formatDay(str('remind_on')!)}</dd></>}
              {str('payee') && <><dt className="text-pc-text-muted">Payee</dt><dd>{str('payee')}</dd></>}
              {str('consequence') && <><dt className="text-pc-text-muted">If missed</dt><dd>{str('consequence')}</dd></>}
              {str('state') && <><dt className="text-pc-text-muted">State</dt><dd>{str('state')}</dd></>}
              {str('next_step') && <><dt className="text-pc-text-muted">Next step</dt><dd>{str('next_step')}</dd></>}
              {str('outcome') && <><dt className="text-pc-text-muted">Outcome</dt><dd>{str('outcome')}</dd></>}
            </dl>
            {str('notes') && <p className="mt-2 whitespace-pre-wrap text-[13px] text-pc-text-secondary">{str('notes')}</p>}

            {sheet?.origin && (
              <div className="mt-3 rounded-xl bg-[var(--pc-hover)] px-3 py-2 text-[13px]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted">From</p>
                {sheet.origin.kind === 'message'
                  ? <p className="mt-0.5 whitespace-pre-wrap">{sheet.origin.text}<span className="block text-[11px] text-pc-text-faint">{sheet.origin.type} · {sheet.origin.ts?.slice(0, 10)}</span></p>
                  : <p className="mt-0.5 text-pc-text-secondary">an email (ask Admin to open it)</p>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {closed ? (
                <button type="button" disabled={busy} onClick={() => void run('reopen')} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-pc-border px-4 text-[14px] disabled:opacity-60"><Undo2 size={15} /> Reopen</button>
              ) : (
                <>
                  <button type="button" disabled={busy} onClick={() => void run('done')} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-pc-accent px-4 text-[14px] font-semibold text-white disabled:opacity-60">
                    <Check size={16} /> {kind === 'bill' ? 'Paid' : kind === 'loop' ? 'Close' : 'Done'}
                  </button>
                  {kind !== 'loop' && (
                    <button type="button" disabled={busy} onClick={() => void run('snooze')} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-pc-border px-4 text-[14px] disabled:opacity-60"><Clock size={15} /> Snooze 3 d</button>
                  )}
                  {kind === 'loop'
                    ? <button type="button" onClick={() => { onAsk(`Continue: ${it.title} ⟨${id}⟩`, true); onClose(); }} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-pc-border px-4 text-[14px]"><MessageSquare size={15} /> Continue</button>
                    : <button type="button" onClick={() => { onAsk(`About ⟨${id}⟩: `); onClose(); }} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-pc-border px-4 text-[14px]"><MessageSquare size={15} /> Ask about it</button>}
                  {it.store === 'tasks' && !str('scheduled') && (
                    <button type="button" onClick={() => { onAsk(`Schedule ⟨${id}⟩ for `); onClose(); }} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-pc-border px-4 text-[14px]"><CalendarClock size={15} /> Schedule</button>
                  )}
                  {it.store === 'admin' && (
                    <button type="button" disabled={busy} onClick={() => void run('to-task')} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-pc-border px-4 text-[14px] disabled:opacity-60"><ListChecks size={15} /> Make it a task</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => void run('drop')} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] text-pc-text-muted disabled:opacity-60"><Ban size={15} /> Drop</button>
                </>
              )}
            </div>
            {!closed && it.store !== 'loops' && (
              <div className="mt-3 flex items-center gap-1 text-[12px] text-pc-text-muted">
                Priority
                {(['P1', 'P2', 'P3', 'P4'] as const).map(p => (
                  <button key={p} type="button" disabled={busy} onClick={() => void run('priority', { priority: p })}
                    className={`h-7 rounded-full px-2.5 ${str('priority') === p || (!str('priority') && p === 'P3') ? 'bg-pc-accent text-white' : 'border border-pc-border'}`}>{p}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
