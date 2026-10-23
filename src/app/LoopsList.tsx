import { ArrowRight, MessagesSquare, Users } from 'lucide-react';
import { ago, type Loop } from './api';

/**
 * "In progress" (app v2 §6, stored as loops): things being thought through, with where they stand
 * and the next step. "Continue" picks the conversation up in the chat.
 */
export function LoopsList({ loops, today, onContinue, onOpen }: { loops: Loop[]; today: string; onContinue: (l: Loop) => void; onOpen: (l: Loop) => void }) {
  if (loops.length === 0) {
    return (
      <div className="flex flex-col items-center px-8 py-12 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(var(--pc-accent-rgb),0.12)] text-pc-accent"><MessagesSquare size={22} /></span>
        <p className="text-[16px] font-semibold">Nothing in progress</p>
        <p className="mt-1 text-[14px] text-pc-text-muted">Say “think through …” in the chat and it stays here until it is settled.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--pc-separator)]">
      {loops.map(l => (
        <div key={l.id} className="flex items-center gap-2 py-3 pl-4 pr-3">
          <button type="button" onClick={() => onOpen(l)} className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[16px] leading-snug text-pc-text-primary">{l.title}</span>
              {l.scope === 'shared' && <Users size={12} className="shrink-0 text-pc-text-faint" aria-label="shared" />}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-pc-text-muted">{l.next_step ? <>Next: {l.next_step}</> : l.state}</span>
            {l.last_touched && <span className="mt-0.5 block text-[12px] text-pc-text-faint">Last touched {ago(l.last_touched, today)}</span>}
          </button>
          <button type="button" onClick={() => onContinue(l)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[rgba(var(--pc-accent-rgb),0.12)] px-3 text-[14px] font-medium text-pc-accent active:opacity-70" aria-label={`Continue “${l.title}”`}>
            Continue <ArrowRight size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
