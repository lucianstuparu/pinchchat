import { useEffect, useState, type ReactNode } from 'react';
import { useBusy } from '../ui/draft';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Ban, CalendarClock, Check, Clock, ListChecks, MessageSquare, MessagesSquare, Pencil, Receipt, Repeat, ShoppingCart, Undo2 } from 'lucide-react';
import { act, fetchSheet, formatAmount, formatDay, type ItemAction, type Sheet as ItemData } from './api';
import { Title } from './Todo';
import { TOPIC_COLORS, railOf } from './todoRules';

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
  /** After a change: the parent offers Undo. */
  onActed?: (id: string, action: ItemAction, title: string) => void;
  /** The undo bar, shown at the foot of the sheet while it is open. */
  footer?: ReactNode;
}

const CLOSED = ['paid', 'done', 'cancelled', 'closed'];
const KIND: Record<string, { icon: typeof Receipt; label: string }> = {
  bill: { icon: Receipt, label: 'Bill' }, deadline: { icon: CalendarClock, label: 'Deadline' }, subscription: { icon: Repeat, label: 'Subscription' },
  contract: { icon: Receipt, label: 'Contract' }, task: { icon: ListChecks, label: 'Task' }, buy: { icon: ShoppingCart, label: 'Shopping' },
  loop: { icon: MessagesSquare, label: 'In progress' },
};
const STATUS: Record<string, string> = { todo: 'To do', open: 'Open', next: 'Next', waiting: 'Waiting', paid: 'Paid', done: 'Done', cancelled: 'Not needed', closed: 'Finished' };
const PRIORITY = [['P1', 'Urgent'], ['P2', 'High'], ['P3', 'Normal'], ['P4', 'Low']] as const;

export function ItemSheet({ id, onClose, onChanged, onAsk, onActed, footer }: Props) {
  const [sheet, setSheet] = useState<ItemData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Editing (oc-app-design.md §4): the title, the due date and the topics.
  const [edit, setEdit] = useState<{ title: string; due: string; topics: string[] } | null>(null);
  useBusy('item-edit', edit !== null);   // an update never reloads over unsaved edits

  const load = () => fetchSheet(id).then(s => { setSheet(s); setError(null); }).catch(e => setError(e.message));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: ItemAction, extra?: Record<string, unknown>) => {
    setBusy(true);
    try { await act(id, action, extra); await load(); onChanged(); if (sheet) onActed?.(id, action, sheet.item.title); }
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
  const topics = Array.isArray(it?.topics) ? (it.topics as string[]) : [];
  const startEdit = () => it && setEdit({ title: it.title, due: str('due_date') ?? '', topics });
  const saveEdit = async () => {
    if (!edit || !it) return;
    const extra: Record<string, unknown> = {};
    if (edit.title.trim() !== it.title) extra.title = edit.title.trim();
    if (edit.due !== (str('due_date') ?? '')) extra.due_date = edit.due;
    if (edit.topics.join(',') !== topics.join(',')) extra.topics = edit.topics;
    if (Object.keys(extra).length) await run('edit', extra);
    setEdit(null);
  };

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

  const secondary = 'flex flex-col items-center justify-center gap-1 rounded-[12px] bg-pc-surface py-3 text-[13px] text-pc-text active:bg-[var(--pc-hover-strong)] disabled:opacity-50';

  return (
    <Sheet label={it?.title ?? 'Item'} onClose={onClose} className="max-h-[88dvh] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 md:max-w-lg">
        <div className="flex justify-end">
          <CloseButton onClick={onClose} />
        </div>
        {!it && !error && <p className="py-10 text-center text-sm text-pc-text-muted">Loading…</p>}
        {error && <p className="py-2 text-sm text-red-500">{error}</p>}
        {it && (
          <>
            <div className="-mt-2 mb-4">
              <p className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-pc-accent">
                <K.icon size={14} /> {K.label}{str('domain') ? ` · ${str('domain')}` : ''}{it.scope === 'shared' ? ' · shared' : ''}
              </p>
              {edit ? (
                <div className="space-y-3">
                  <textarea value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} rows={2} aria-label="Title"
                    className="w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[17px] leading-snug outline-none focus:border-pc-accent" />
                  <p className="-mt-2 px-1 text-[12px] text-pc-text-muted">Put **two stars** around a name to make it bold.</p>
                  {!isTopic && (
                    <>
                      <label className="flex items-center justify-between gap-3 rounded-[12px] bg-pc-surface px-3 py-2 text-[15px]">
                        <span className="text-pc-text-muted">Due</span>
                        <span className="flex items-center gap-2">
                          <input type="date" value={edit.due} onChange={e => setEdit({ ...edit, due: e.target.value })} className="bg-transparent text-right outline-none" />
                          {edit.due && <button type="button" onClick={() => setEdit({ ...edit, due: '' })} className="text-[13px] text-[var(--pc-accent-ink)]">No date</button>}
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topics">
                        {Object.entries(TOPIC_COLORS).map(([t, c]) => {
                          const on = edit.topics.includes(t);
                          return (
                            <button key={t} type="button" aria-pressed={on}
                              onClick={() => setEdit({ ...edit, topics: on ? edit.topics.filter(x => x !== t) : [...edit.topics, t] })}
                              className="h-8 rounded-[8px] border px-3 text-[13px] font-semibold"
                              style={on ? { background: c.bg, color: c.ink, borderColor: c.rail } : { borderColor: 'var(--pc-border-strong)', color: 'var(--pc-text-muted)' }}>{t}</button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEdit(null)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px] font-medium">Cancel</button>
                    <button type="button" disabled={busy || !edit.title.trim()} onClick={() => void saveEdit()} className="press h-12 flex-1 rounded-[12px] bg-pc-accent text-[15px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">Save</button>
                  </div>
                </div>
              ) : (
                <h2 className={`pr-6 text-[22px] font-bold leading-tight ${closed ? 'text-pc-text-muted line-through' : 'text-pc-text-primary'}`}>
                  {typeof it.n === 'number' && <span className="mr-2 tabular-nums" style={{ color: closed ? undefined : railOf({ topics }) }}>{it.n}</span>}
                  <Title text={it.title} />
                </h2>
              )}
              {closed && <p className="mt-1 text-[14px] text-pc-text-muted">{STATUS[it.status] ?? it.status}</p>}
            </div>

            {rows.length > 0 && (
              <dl className="mb-3 divide-y divide-[var(--pc-separator)] rounded-[12px] bg-pc-surface px-4">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
                    <dt className="shrink-0 text-pc-text-muted">{k}</dt>
                    <dd className="min-w-0 text-right tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {str('notes') && <p className="mb-3 whitespace-pre-wrap rounded-[12px] bg-pc-surface px-4 py-3 text-[14px] text-pc-text-secondary">{str('notes')}</p>}

            {sheet?.origin && (
              <div className="mb-3 rounded-[12px] bg-pc-surface px-4 py-3 text-[14px]">
                <p className="mb-1 text-[12px] font-medium text-pc-text-muted">Came from</p>
                {sheet.origin.kind === 'message'
                  ? <p className="whitespace-pre-wrap">“{sheet.origin.text}”<span className="mt-1 block text-[12px] text-pc-text-faint">{sheet.origin.ts?.slice(0, 10)}</span></p>
                  : <p className="text-pc-text-secondary">An email. Ask about it to have it opened.</p>}
              </div>
            )}

            {closed ? (
              <button type="button" disabled={busy} onClick={() => void run('reopen')} className="press mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-surface text-[16px] font-semibold disabled:opacity-60">
                <Undo2 size={18} /> Reopen
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => void run('done')}
                  className="press mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-60">
                  <Check size={19} strokeWidth={2.5} /> {kind === 'bill' ? 'Mark as paid' : isTopic ? 'It’s settled' : 'Done'}
                </button>
                <div className="mt-2 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
                  {isTopic
                    ? <button type="button" onClick={() => { onAsk(`Continue: ${it.title} ⟨${id}⟩`, true); onClose(); }} className={secondary}><MessageSquare size={19} className="text-pc-accent" /> Continue</button>
                    : <button type="button" disabled={busy} onClick={() => void run('snooze')} className={secondary}><Clock size={19} className="text-pc-accent" /> Remind in 3 days</button>}
                  {!isTopic && <button type="button" onClick={() => { onAsk(`About ⟨${id}⟩: `); onClose(); }} className={secondary}><MessageSquare size={19} className="text-pc-accent" /> Ask</button>}
                  {it.store === 'tasks' && !str('scheduled') && (
                    <button type="button" onClick={() => { onAsk(`Schedule ⟨${id}⟩ for `); onClose(); }} className={secondary}><CalendarClock size={19} className="text-pc-accent" /> Schedule</button>
                  )}
                  {it.store === 'admin' && (
                    <button type="button" disabled={busy} onClick={() => void run('to-task')} className={secondary}><ListChecks size={19} className="text-pc-accent" /> Make a task</button>
                  )}
                  {!edit && <button type="button" onClick={startEdit} className={secondary}><Pencil size={19} className="text-[var(--pc-accent-ink)]" /> Edit</button>}
                  <button type="button" disabled={busy} onClick={() => void run('drop')} className={secondary}><Ban size={19} className="text-pc-text-muted" /> Not needed</button>
                </div>
                {!isTopic && (
                  <div className="mt-4">
                    <p className="mb-1.5 px-1 text-[13px] text-pc-text-muted">Priority</p>
                    <div className="grid grid-cols-4 gap-1 rounded-[12px] bg-pc-surface p-1">
                      {PRIORITY.map(([p, label]) => {
                        const on = str('priority') === p || (!str('priority') && p === 'P3');
                        return (
                          <button key={p} type="button" disabled={busy} onClick={() => void run('priority', { priority: p })}
                            className={`h-8 rounded-[8px] text-[13px] font-medium ${on ? `bg-pc-elevated shadow-sm ${p === 'P1' ? 'text-red-500' : 'text-pc-text'}` : 'text-pc-text-muted'}`}>{label}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      {footer && <div className="sticky bottom-0 -mx-4 bg-pc-elevated pt-1">{footer}</div>}
    </Sheet>
  );
}
