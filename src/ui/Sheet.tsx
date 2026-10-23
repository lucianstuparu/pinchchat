/**
 * The sheet of both apps (my.design patterns/sheet-and-tabs.md): a scrim, a panel with 20 px top
 * corners rising from the bottom (centred on a laptop), a grab handle, Back closes it, and scrolling
 * inside never scrolls the page behind. The content keeps its own header and body.
 */
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useBackLayer } from './useBackLayer';

export function Sheet({ label, onClose, onScrim, className = '', z = 40, children }: {
  label: string;
  onClose: () => void;
  /** Tapping outside: closes by default; a sheet with edits may save first. */
  onScrim?: () => void;
  /** Size and padding of the panel (e.g. "max-h-[88dvh] overflow-y-auto px-4"). */
  className?: string;
  z?: 40 | 50;
  children: ReactNode;
}) {
  useBackLayer(true, onClose);
  return (
    <div className={`fixed inset-0 ${z === 50 ? 'z-50' : 'z-40'} flex items-end justify-center md:items-center`} role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-[var(--pc-scrim,rgba(0,0,0,0.3))]" onClick={onScrim ?? onClose} />
      <div className={`relative w-full overscroll-contain rounded-t-[20px] shadow-2xl md:rounded-[20px] ${className.split(' ').some(c => c.startsWith('bg-')) ? '' : 'bg-pc-elevated'} ${className.includes('md:max-w-') ? '' : 'md:max-w-lg'} ${className.split(" ").some(c => c.startsWith("pb-")) ? '' : 'pb-[env(safe-area-inset-bottom)]'} ${className}`}>
        <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-pc-text-faint/50 md:hidden" aria-hidden />
        {children}
      </div>
    </div>
  );
}

/** The close button of a sheet: a 32 px disc in a 40 px target. */
export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pc-surface text-pc-text-muted"><X size={16} strokeWidth={2.5} /></span>
    </button>
  );
}
