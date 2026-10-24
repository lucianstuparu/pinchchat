/**
 * The pieces of the search screen shared by oc and Casa Artlia: a titled group of rows, a text with
 * its matched words marked, a found message from earlier in the conversation, and the last row
 * that hands the question to the assistant.
 */
import type { ReactNode } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { L } from './lang';
import type { Part } from './searchText';

export function SearchGroup({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="flex items-baseline gap-2 px-2 pb-1 text-[13px] font-semibold text-pc-text-muted">{title}{note && <span className="font-normal">{note}</span>}</h3>
      <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-surface">{children}</div>
    </section>
  );
}

export function Marked({ parts, className = '' }: { parts: Part[]; className?: string }) {
  return (
    <span className={className}>
      {parts.map((p, i) => (p.hit
        ? <mark key={i} className="rounded bg-[rgba(var(--pc-accent-rgb),0.25)] px-0.5 text-pc-text-primary">{p.text}</mark>
        : <span key={i}>{p.text}</span>))}
    </span>
  );
}

/** A row: what it is (title), where it matched (excerpt), and a small line under it. */
export function SearchRow({ title, excerpt, meta, icon, onOpen, byMeaning }: {
  title: ReactNode; excerpt?: ReactNode; meta?: ReactNode; icon?: ReactNode; onOpen: () => void;
  /** Found by meaning only: said in words, so a row without the typed words is not a puzzle. */
  byMeaning?: boolean;
}) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
      {icon && <span className="mt-0.5 shrink-0 text-pc-text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{title}</span>
        {excerpt && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-pc-text-secondary">{excerpt}</span>}
        {(meta || byMeaning) && (
          <span className="mt-0.5 flex items-center gap-1 text-[12px] text-pc-text-muted">
            {byMeaning && <><Sparkles size={12} className="shrink-0" /> {L('Similar meaning')}{meta ? ' · ' : ''}</>}
            {meta}
          </span>
        )}
      </span>
    </button>
  );
}

/** The last row: ask the assistant, who can also search by meaning and read the documents. */
export function AskRow({ query, onAsk }: { query: string; onAsk: () => void }) {
  return (
    <button type="button" onClick={onAsk} className="press mb-4 flex min-h-12 w-full items-center gap-3 rounded-[12px] bg-[rgba(var(--pc-accent-rgb),0.10)] px-4 py-2.5 text-left">
      <MessageSquare size={18} className="shrink-0 text-[var(--pc-accent-ink)]" />
      <span className="min-w-0 flex-1 text-[15px]">
        <span className="font-semibold text-[var(--pc-accent-ink)]">{L('Ask the assistant')}</span>
        <span className="block truncate text-[13px] text-pc-text-muted">“{query}”</span>
      </span>
    </button>
  );
}

/** "Searching further…" while the server and the gateway answer (only after a short wait). */
export function SearchingLine({ show }: { show: boolean }) {
  return show ? <p className="px-2 pb-3 text-[13px] text-pc-text-muted" role="status">{L('Searching further…')}</p> : null;
}
