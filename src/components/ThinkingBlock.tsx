import { useState } from 'react';
import { ChevronRight, ChevronDown, Brain } from 'lucide-react';
import { useT } from '../hooks/useLocale';

export function ThinkingBlock({ text }: { text: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="my-2">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-pc-border bg-pc-elevated/35 px-3 py-1.5 text-xs text-violet-300 hover:bg-[var(--pc-hover)] transition-colors"
      >
        <Brain size={13} />
        <span className="font-medium">{t('thinking.label')}</span>
        {open ? <ChevronDown size={12} className="ml-1 text-pc-text-muted" /> : <ChevronRight size={12} className="ml-1 text-pc-text-muted" />}
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-pc-border bg-pc-elevated/25 p-3 text-sm italic text-pc-text-secondary whitespace-pre-wrap max-h-96 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  );
}
