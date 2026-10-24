/**
 * The pantry screen (Shopping Phase D): what is at home, grouped by when it expires. "Used" and
 * "Thrown away" close an entry; a tap changes the date, the place or the quantity. The field at the
 * bottom tells the assistant ("the chicken expires Friday", "finished the kefir"), offline queued.
 */
import { SpeechStatus } from '../app/SpeechStatus';
import { useBusy, useDraft } from '../ui/draft';
import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, Refrigerator, Trash2, Undo2 } from 'lucide-react';
import { WHERE, expiryLabel, groupOf, type PantryEntry, type PantryGroup, type PantryOp, type Where } from './pantry';
import { plainReply, type Ask } from './logic';
import { HomeTabs, type HomeTab } from './Products';
import { WhereIcon } from './WhereIcon';
import { transcribeShop } from './useShop';
import { CloseButton, Sheet } from '../ui/Sheet';
import { FieldControls, PrimaryButton } from '../app/MicButton';
import { speechPlaceholder, useSpeech } from '../app/speech';

const GROUPS: Array<[PantryGroup, string, string]> = [
  ['expired', 'Expired', 'text-red-500'], ['week', 'This week', 'text-[var(--pc-accent-ink)]'],
  ['later', 'Later', 'text-pc-text-muted'], ['nodate', 'No date', 'text-pc-text-muted'],
];

export function PantrySheet({ pantry, today, onOp, onAsk, onClose, lastAsk, onTab, counts, footer }: {
  pantry: PantryEntry[]; today: string; onOp: (op: PantryOp) => void; onAsk: (text: string) => void; onClose: () => void; lastAsk?: Ask;
  /** The other tab of the same screen: the catalogue. */
  onTab: (t: HomeTab) => void; counts: Record<HomeTab, number>;
  /** The undo bar, at the foot of the sheet. */
  footer?: ReactNode;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [text, setText] = useDraft('home');
  // The same input bar as the list: type or say it; the mic writes, Send sends.
  const speech = useSpeech(text, setText, transcribeShop);
  useBusy('home', !!text.trim() || speech.listening || speech.state === 'writing');
  const ask = () => { if (!text.trim()) return; speech.cancel(); onAsk(text.trim()); setText(''); };
  const open = pantry.filter(e => e.status === 'open').sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const closed = pantry.filter(e => e.status !== 'open').sort((a, b) => (b.closed_on || '').localeCompare(a.closed_on || ''));
  const entry = editing ? pantry.find(e => e.id === editing) : undefined;

  return (
    <>
      <Sheet label="At home and products" onClose={onClose} className="flex h-[88dvh] flex-col md:h-[80dvh]">
        <div className="flex shrink-0 items-center gap-3 px-4 pb-1 pt-2">
          <HomeTabs tab="home" onTab={onTab} counts={counts} />
          <CloseButton onClick={onClose} />
        </div>
        <p className="shrink-0 px-4 pb-1 text-[13px] text-pc-text-muted">What is at home{open.length === 0 ? '' : ', soonest to expire first'}</p>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {open.length === 0 && (
            <div className="px-10 py-12 text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.18)] text-[var(--pc-accent-ink)]"><Refrigerator size={26} /></span>
              <p className="text-[17px] font-semibold">Nothing in the inventory yet</p>
              <p className="mt-1 text-[15px] text-pc-text-muted">Tick a fresh item as bought and add it from there, or say “the chicken expires Friday” below. You get a reminder a week and a day before.</p>
            </div>
          )}
          {GROUPS.map(([g, label, cls]) => {
            const rows = open.filter(e => groupOf(e, today) === g);
            if (rows.length === 0) return null;
            return (
              <section key={g}>
                <h3 className={`px-4 pb-0.5 pt-3 text-[15px] font-semibold ${cls}`}>{label}</h3>
                <div className="divide-y divide-[var(--pc-separator)]">
                  {rows.map(e => (
                    <div key={e.id} className="flex items-center gap-2 py-2 pl-4 pr-2">
                      <WhereIcon where={e.where} size={20} className="shrink-0 text-pc-text-muted" />
                      <button type="button" onClick={() => setEditing(e.id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[16px]">{e.title}{e.qty ? <span className="text-pc-text-muted"> ×{e.qty}</span> : null}</span>
                        <span className={`text-[13px] ${g === 'expired' ? 'text-red-500' : g === 'week' ? 'text-[var(--pc-accent-ink)]' : 'text-pc-text-muted'}`}>{expiryLabel(e, today)}</span>
                      </button>
                      <button type="button" onClick={() => onOp({ op: 'pantry-close', id: e.id, how: 'used' })} className="press inline-flex h-10 items-center gap-1 rounded-full bg-pc-surface px-3 text-[15px] font-medium" aria-label={`${e.title} used`}>
                        <Check size={15} className="text-emerald-600" /> Used
                      </button>
                      <button type="button" onClick={() => onOp({ op: 'pantry-close', id: e.id, how: 'wasted' })} className="press flex h-10 w-10 items-center justify-center rounded-full bg-pc-surface text-pc-text-muted" aria-label={`${e.title} thrown away`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          {closed.length > 0 && (
            <section className="mt-2">
              <button type="button" onClick={() => setShowClosed(s => !s)} className="flex h-10 w-full items-center gap-1.5 px-4 text-left text-[13px] font-semibold text-pc-text-muted" aria-expanded={showClosed}>
                {showClosed ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Finished lately · {closed.length}
              </button>
              {showClosed && closed.map(e => (
                <div key={e.id} className="flex items-center gap-2 py-1.5 pl-4 pr-2 text-pc-text-muted">
                  <span className="min-w-0 flex-1 truncate text-[15px] line-through">{e.title}</span>
                  <span className="text-[12px]">{e.status === 'wasted' ? 'thrown away' : 'used'}{e.closed_by ? ` · ${e.closed_by}` : ''}</span>
                  <button type="button" onClick={() => onOp({ op: 'pantry-reopen', id: e.id })} className="press flex h-10 w-10 items-center justify-center rounded-full" aria-label={`Put ${e.title} back`}><Undo2 size={15} /></button>
                </div>
              ))}
            </section>
          )}
        </div>

        {lastAsk && (
          <p className="mx-3 mb-1 shrink-0 rounded-[12px] bg-pc-surface px-3 py-2 text-[13px] leading-snug">
            {lastAsk.status === 'working' || lastAsk.status === 'queued' ? <span className="animate-pulse text-pc-text-muted">Working on “{lastAsk.text.replace('[Pantry] ', '')}”…</span> : plainReply(lastAsk.reply)}
          </p>
        )}
        {footer}
        <SpeechStatus speech={speech} />
        {speech.error && <p className="mx-4 mb-1 shrink-0 text-[13px] text-red-500" role="alert">{speech.error}</p>}
        <form onSubmit={ev => { ev.preventDefault(); ask(); }} className="flex shrink-0 items-end gap-2 border-t border-pc-border px-2 pb-2 pt-2">
          <div className={`flex min-w-0 flex-1 items-end rounded-[20px] border bg-pc-surface pl-4 pr-1.5 ${speech.listening ? 'border-[rgba(var(--pc-accent-rgb),0.8)]' : 'border-transparent'}`}>
            <textarea value={text} rows={1} onChange={ev => setText(ev.target.value)} enterKeyHint="send" readOnly={speech.state === 'writing'}
              onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ask(); } }}
              placeholder={speechPlaceholder(speech, '“The chicken expires Friday”')} aria-label="Tell the assistant about what is at home"
              className="min-h-[48px] min-w-0 flex-1 resize-none border-0 bg-transparent py-[13px] text-[16px] leading-[22px] shadow-none outline-none focus:outline-none focus-visible:outline-none placeholder:text-pc-text-muted" />
            <FieldControls speech={speech} hasText={!!text.trim()} onClear={() => { speech.cancel(); setText(''); }} />
          </div>
          <PrimaryButton speech={speech} canSend={!!text.trim()} onSend={ask} size={56} />
        </form>
      </Sheet>
      {entry && <PantryEdit entry={entry} onOp={onOp} onClose={() => setEditing(null)} />}
    </>
  );
}

function PantryEdit({ entry, onOp, onClose }: { entry: PantryEntry; onOp: (op: PantryOp) => void; onClose: () => void }) {
  useBusy('home-edit', true);   // an update never reloads over unsaved edits
  const [title, setTitle] = useState(entry.title);
  const [qty, setQty] = useState(entry.qty ?? '');
  const [where, setWhere] = useState<Where>(entry.where ?? 'fridge');
  const [due, setDue] = useState(entry.due_date ?? '');
  const save = () => {
    if (title !== entry.title || qty !== (entry.qty ?? '') || where !== (entry.where ?? 'fridge') || due !== (entry.due_date ?? '')) {
      onOp({ op: 'pantry-edit', id: entry.id, title, qty, where, expires: due });
    }
    onClose();
  };
  const field = 'w-full rounded-[12px] border-0 bg-pc-surface px-3.5 py-2.5 text-[16px] outline-none';
  return (
    <Sheet label={entry.title} onClose={save} z={50} className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 md:max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={onClose} className="press h-10 px-1 text-[16px] text-pc-text-muted">Cancel</button>
          <span className="text-[15px] font-semibold">At home</span>
          <button type="button" onClick={save} className="press h-10 px-1 text-[16px] font-semibold text-[var(--pc-accent-ink)]">Done</button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} className={`${field} text-[17px] font-semibold`} aria-label="Name" />
        <div className="mt-2 flex gap-2">
          <input value={qty} onChange={e => setQty(e.target.value)} placeholder="Quantity" className={`${field} w-32`} aria-label="Quantity" />
          <label className="flex flex-1 items-center justify-between gap-2 rounded-[12px] bg-pc-surface px-3.5 text-[15px]">
            Expires
            <input type="date" value={due} onChange={e => setDue(e.target.value)} className="bg-transparent text-[15px] outline-none" />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1 rounded-[12px] bg-pc-surface p-[3px]" role="radiogroup" aria-label="Where">
          {WHERE.map(w => (
            <button key={w.key} type="button" role="radio" aria-checked={where === w.key} onClick={() => setWhere(w.key)}
              className={`flex flex-col items-center gap-1 rounded-[8px] py-2 text-[12px] ${where === w.key ? 'bg-pc-elevated text-pc-text shadow-sm' : 'text-pc-text-muted'}`}>
              <WhereIcon where={w.key} size={20} />{w.label}
            </button>
          ))}
        </div>
        {entry.guessed && <p className="mt-2 px-1 text-[12px] text-pc-text-muted">The date was guessed from the usual shelf life; set the real one if the package says otherwise.</p>}
    </Sheet>
  );
}
