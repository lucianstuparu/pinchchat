/**
 * Things we own (Lucian, 2026-10-24: "an agent daily scanning my email to see what I bought online
 * … for each item to know when it was bought"): the third tab of the home screen, beside At home and
 * Products. What was bought that stays, by kind (the list's colours), newest first: when, where, the
 * price, the last day to send it back and the warranty; a tap shows the order and opens its mail.
 * Filled each morning by the Shopper from the order mails, or by telling the assistant.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Mail, PackageCheck, Search, Undo2 } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { HomeTabs, type HomeTab } from './Products';
import { GROUPS, GROUP_NAMES, groupColours, groupOf } from './groups';
import { fold } from './logic';
import { daysUntil } from './pantry';
import { mailLink, money, type OwnedEntry, type OwnedOp } from './owned';

const fmtDay = (d: string, year = true) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });

export function OwnedSheet({ owned, today, mode, onOp, onTab, counts, onClose, footer }: {
  owned: OwnedEntry[]; today: string; mode: 'light' | 'dark'; onOp: (op: OwnedOp) => void;
  onTab: (t: HomeTab) => void; counts: Record<HomeTab, number>; onClose: () => void;
  /** The undo bar, at the foot of the sheet. */
  footer?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const words = fold(q).split(/\s+/).filter(Boolean);
  const match = (e: OwnedEntry) => { const hay = fold([e.title, e.shop, e.order, e.notes].join(' ')); return words.every(w => hay.includes(w)); };
  const kept = owned.filter(e => e.status === 'owned' && match(e)).sort((a, b) => (b.bought_on ?? '').localeCompare(a.bought_on ?? ''));
  const closed = owned.filter(e => e.status !== 'owned').sort((a, b) => (b.closed_on ?? '').localeCompare(a.closed_on ?? ''));
  const kindOf = (e: OwnedEntry) => groupOf({ title: e.title, tags: [], group: e.group });

  return (
    <Sheet label="Things we own" onClose={onClose} className="flex h-[88dvh] flex-col md:h-[80dvh] md:max-w-lg">
      <div className="flex shrink-0 items-center gap-3 px-4 pb-1 pt-2">
        <HomeTabs tab="owned" onTab={onTab} counts={counts} />
        <CloseButton onClick={onClose} />
      </div>
      <p className="shrink-0 px-4 pb-2 text-[13px] text-pc-text-muted">What we bought that stays, newest first. Found in your order emails every morning.</p>
      <div className="mx-4 mb-2 flex h-9 shrink-0 items-center gap-2 rounded-[12px] bg-pc-surface px-2.5">
        <Search size={16} className="shrink-0 text-pc-text-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search: name, shop, order" aria-label="Search things we own" type="search"
          className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none placeholder:text-pc-text-muted [&::-webkit-search-cancel-button]:hidden" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {owned.filter(e => e.status === 'owned').length === 0 && (
          <div className="px-10 py-12 text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.18)] text-[var(--pc-accent-ink)]"><PackageCheck size={26} /></span>
            <p className="text-[17px] font-semibold">Nothing here yet</p>
            <p className="mt-1 text-[15px] text-pc-text-muted">Every morning the assistant reads your order emails and adds what you bought, with the date, the shop and the price.</p>
          </div>
        )}
        {q && kept.length === 0 && owned.some(e => e.status === 'owned') && <p className="px-8 py-10 text-center text-[15px] text-pc-text-muted">Nothing matches “{q.trim()}”</p>}
        {GROUPS.map(g => {
          const rows = kept.filter(e => kindOf(e) === g);
          if (rows.length === 0) return null;
          const c = groupColours(g, mode);
          return (
            <section key={g} className="mx-3 mb-2 overflow-hidden rounded-[12px] border" style={{ background: c.card, borderColor: c.border }}>
              <h3 className="flex items-baseline justify-between px-3 pb-0.5 pt-2.5 text-[15px] font-semibold" style={{ color: c.ink }}>{GROUP_NAMES[g]}<span className="text-[13px] font-medium">{rows.length}</span></h3>
              {rows.map(e => {
                const ret = e.return_by ? daysUntil(e.return_by, today) : null;
                const warranty = e.warranty_until && e.warranty_until >= today ? e.warranty_until : null;
                const open = openId === e.id;
                return (
                  <div key={e.id} className="border-t first:border-t-0" style={{ borderColor: c.border }}>
                    <button type="button" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open} className="w-full px-3 py-2.5 text-left">
                      <span className="block text-[16px] leading-[21px] text-pc-text-primary">{e.title}{e.qty && e.qty !== '1' ? <span className="text-pc-text-muted"> ×{e.qty}</span> : null}</span>
                      <span className="mt-0.5 block text-[13px] leading-tight" style={{ color: c.ink }}>
                        {[e.bought_on ? fmtDay(e.bought_on) : '', e.shop, money(e.price, e.currency)].filter(Boolean).join(' · ')}
                      </span>
                      {(ret !== null && ret >= 0) || warranty ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {ret !== null && ret >= 0 && <span className={`rounded-[8px] px-1.5 py-px text-[12px] font-semibold ${ret <= 3 ? 'bg-red-500 text-white' : 'bg-white/70 text-amber-800 dark:bg-black/30 dark:text-amber-300'}`}>Return by {fmtDay(e.return_by!, e.return_by!.slice(0, 4) !== today.slice(0, 4))}</span>}
                          {warranty && <span className="rounded-[8px] bg-white/70 px-1.5 py-px text-[12px] font-medium text-pc-text-secondary dark:bg-black/30">Warranty to {fmtDay(warranty)}</span>}
                        </span>
                      ) : null}
                    </button>
                    {open && (
                      <div className="px-3 pb-3">
                        {(e.order || e.notes) && <p className="mb-2 text-[13px] text-pc-text-secondary">{[e.order ? `Order ${e.order}` : '', e.notes].filter(Boolean).join(' · ')}</p>}
                        <div className="flex flex-wrap gap-2">
                          {e.mail && (
                            <a href={mailLink(e.mail)} target="_blank" rel="noreferrer" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-white/70 px-3.5 text-[15px] font-medium dark:bg-black/30" style={{ color: c.ink }}>
                              <Mail size={16} aria-hidden /> Open the email
                            </a>
                          )}
                          <button type="button" onClick={() => { onOp({ op: 'owned-close', id: e.id, how: 'returned' }); setOpenId(null); }} className="press inline-flex h-10 items-center rounded-full bg-white/70 px-3.5 text-[15px] font-medium text-pc-text dark:bg-black/30">Sent back</button>
                          <button type="button" onClick={() => { onOp({ op: 'owned-close', id: e.id, how: 'gone' }); setOpenId(null); }} className="press inline-flex h-10 items-center rounded-full bg-white/70 px-3.5 text-[15px] font-medium text-pc-text dark:bg-black/30">No longer ours</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
        {closed.length > 0 && (
          <section className="mt-1">
            <button type="button" onClick={() => setShowClosed(s => !s)} className="flex h-10 w-full items-center gap-1.5 px-4 text-left text-[13px] font-semibold text-pc-text-muted" aria-expanded={showClosed}>
              {showClosed ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Sent back or gone lately · {closed.length}
            </button>
            {showClosed && closed.map(e => (
              <div key={e.id} className="flex items-center gap-2 py-1.5 pl-4 pr-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] text-pc-text-muted line-through">{e.title}</span>
                  <span className="text-[13px] text-pc-text-muted">{e.status === 'returned' ? 'Sent back' : 'No longer ours'}{e.closed_on ? ` · ${fmtDay(e.closed_on, false)}` : ''}</span>
                </span>
                <button type="button" onClick={() => onOp({ op: 'owned-reopen', id: e.id })} className="press inline-flex h-10 items-center gap-1 rounded-full bg-pc-surface px-3 text-[15px] font-medium" aria-label={`Put ${e.title} back`}>
                  <Undo2 size={15} /> Put back
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
      {footer}
    </Sheet>
  );
}
