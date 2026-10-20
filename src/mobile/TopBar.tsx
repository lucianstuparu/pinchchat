import { useEffect, useRef, useState } from 'react';
import { Inbox, ListChecks, MoreVertical, Search, Wallet, X } from 'lucide-react';
import type { MessengerAgent } from './agents';

/**
 * One compact row: a segmented control with an icon per agent (the active tab is the title),
 * search, and the menu. Connection state takes a thin strip only when it is not "online".
 * In search mode the row becomes the search field.
 */
export interface MenuItem { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }

interface Props {
  agents: MessengerAgent[];
  active: MessengerAgent;
  onChoose: (a: MessengerAgent) => void;
  /** Agents whose tab may not be chosen right now (offline outbox only goes to the Inbox). */
  lockedTo?: MessengerAgent | null;
  unread: Set<string>;
  statusLine: string | null;
  menu: MenuItem[];
  search: string | null;
  onSearch: (q: string | null) => void;
  resultCount: number;
}

const ICONS = { inbox: Inbox, admin: Wallet, generalist: ListChecks } as const;

export function TopBar({ agents, active, onChoose, lockedTo, unread, statusLine, menu, search, onSearch, resultCount }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (search !== null) input.current?.focus(); }, [search]);

  return (
    <header className="shrink-0 bg-pc-surface border-b border-pc-border pt-[env(safe-area-inset-top)]">
      {search !== null ? (
        <div className="flex h-12 items-center gap-1 px-2">
          <button type="button" onClick={() => onSearch(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Close search">
            <X size={20} />
          </button>
          <input
            ref={input}
            type="search"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={`Search in ${active.label}`}
            className="h-10 min-w-0 flex-1 rounded-full bg-[var(--pc-hover)] px-4 text-[15px] outline-none placeholder:text-pc-text-muted"
            aria-label={`Search in ${active.label}`}
            enterKeyHint="search"
          />
          <span className="w-16 shrink-0 text-right text-[12px] text-pc-text-muted pr-1" aria-live="polite">
            {search.trim().length >= 2 ? (resultCount === 0 ? 'No results' : `${resultCount} found`) : ''}
          </span>
        </div>
      ) : (
        <div className="flex h-12 items-center gap-1 px-2">
          <div role="tablist" aria-label="Agent" className="flex min-w-0 flex-1 rounded-full bg-[var(--pc-hover-strong)] p-0.5">
            {agents.map(a => {
              const Icon = ICONS[a.id as keyof typeof ICONS] ?? Inbox;
              const on = a.session === active.session;
              const locked = !!lockedTo && a.session !== lockedTo.session;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  disabled={locked}
                  onClick={() => onChoose(a)}
                  className={`relative flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-medium transition-colors disabled:opacity-40 ${
                    on ? 'bg-pc-elevated text-pc-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-pc-text-muted'
                  }`}
                >
                  <Icon size={16} className={on ? 'text-pc-accent' : undefined} />
                  <span className="truncate">{a.label}</span>
                  {!on && unread.has(a.id) && <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-pc-accent" aria-label="unread" />}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => onSearch('')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Search">
            <Search size={20} />
          </button>
          <div className="relative shrink-0">
            <button type="button" onClick={() => setMenuOpen(o => !o)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Menu" aria-expanded={menuOpen}>
              <MoreVertical size={20} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-20 w-60 rounded-xl border border-pc-border bg-pc-elevated py-1 text-[15px] shadow-lg">
                  {menu.map(m => (
                    <button
                      key={m.label}
                      type="button"
                      disabled={m.disabled}
                      onClick={() => { setMenuOpen(false); m.onClick(); }}
                      className={`w-full px-4 py-2.5 text-left hover:bg-[var(--pc-hover)] disabled:opacity-60 ${m.danger ? 'text-red-500' : ''}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {statusLine && search === null && (
        <div className="flex h-6 items-center justify-center bg-amber-100 text-[12px] text-amber-800" role="status">{statusLine}</div>
      )}
    </header>
  );
}
