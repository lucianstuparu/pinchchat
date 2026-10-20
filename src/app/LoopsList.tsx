import { ChevronRight, Users } from 'lucide-react';
import { ago, type Loop } from './api';

/** The Open loops band (app v2 §6): one line per unfinished exploration, "continue" drops it into the chat. */
export function LoopsList({ loops, today, onContinue, onOpen }: { loops: Loop[]; today: string; onContinue: (l: Loop) => void; onOpen: (l: Loop) => void }) {
  if (loops.length === 0) return <p className="px-4 py-3 text-[14px] text-pc-text-muted">No open loops. Say "keep this open" in the chat to start one.</p>;
  return (
    <div className="px-4 divide-y divide-[var(--pc-separator)]">
      {loops.slice(0, 8).map(l => (
        <div key={l.id} className="flex items-center gap-2 py-2">
          <button type="button" onClick={() => onContinue(l)} className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] leading-snug text-pc-text-primary">{l.title}</span>
              {l.scope === 'shared' && <Users size={12} className="shrink-0 text-pc-text-faint" aria-label="shared" />}
              <span className="ml-auto shrink-0 text-[11px] text-pc-text-faint">{ago(l.last_touched, today)}</span>
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-pc-text-muted">
              {l.next_step ? <>next: {l.next_step}</> : l.state}
            </span>
          </button>
          <button type="button" onClick={() => onOpen(l)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-pc-text-faint hover:bg-[var(--pc-hover)]" aria-label={`Open "${l.title}"`}>
            <ChevronRight size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
