/**
 * The Undo bar (oc and Shopping): after a tick, a swipe, a star or a change in the details, what
 * happened and an Undo button, for six seconds. Undo puts the item back exactly as it was (the
 * server keeps the previous state; Shopping reopens offline).
 */
import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export interface UndoInfo { key: number; label: string; undo: () => void }

export function UndoBar({ info, onClose, bottom }: { info: UndoInfo | null; onClose: () => void; bottom: string }) {
  useEffect(() => {
    if (!info) return;
    const t = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(t);
  }, [info, onClose]);
  if (!info) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3" style={{ bottom }} role="status" aria-live="polite">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[14px] bg-pc-text py-1.5 pl-4 pr-1.5 text-pc-base shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
        <span className="min-w-0 flex-1 truncate text-[15px]">{info.label}</span>
        <button type="button" onClick={() => { info.undo(); onClose(); }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[15px] font-semibold active:opacity-60">
          <RotateCcw size={16} strokeWidth={2.5} /> Undo
        </button>
      </div>
    </div>
  );
}
