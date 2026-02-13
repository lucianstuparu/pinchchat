import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useT } from '../hooks/useLocale';

interface Props {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string, activeIndex: number) => void;
  matchCount: number;
}

export function MessageSearch({ open, onClose, onSearch, matchCount }: Props) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  useEffect(() => {
    onSearch(query, activeIndex);
  }, [query, activeIndex, onSearch]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0); // eslint-disable-line react-hooks/set-state-in-effect -- intentional: reset index on query change
  }, [query]);

  const navigate = useCallback((dir: 1 | -1) => {
    if (matchCount === 0) return;
    setActiveIndex(prev => {
      const next = prev + dir;
      if (next < 0) return matchCount - 1;
      if (next >= matchCount) return 0;
      return next;
    });
  }, [matchCount]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate(e.shiftKey ? -1 : 1);
    }
  }, [onClose, navigate]);

  if (!open) return null;

  return (
    <div className="absolute top-2 right-4 z-20 flex items-center gap-1.5 rounded-xl border border-pc-border-strong bg-pc-elevated/95 backdrop-blur-lg px-3 py-1.5 shadow-lg">
      <Search size={14} className="text-pc-text-muted shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        className="bg-transparent text-sm text-pc-text placeholder:text-pc-text-muted outline-none w-48"
      />
      {query && (
        <span className="text-xs text-pc-text-muted whitespace-nowrap">
          {matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : t('search.noResults')}
        </span>
      )}
      <button
        onClick={() => navigate(-1)}
        disabled={matchCount === 0}
        className="p-1 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] disabled:opacity-30 transition-colors"
        aria-label={t('search.prev')}
      >
        <ChevronUp size={14} />
      </button>
      <button
        onClick={() => navigate(1)}
        disabled={matchCount === 0}
        className="p-1 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] disabled:opacity-30 transition-colors"
        aria-label={t('search.next')}
      >
        <ChevronDown size={14} />
      </button>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
        aria-label={t('shortcuts.close')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
