/**
 * The Undo bar (oc and Shopping; my.design patterns/undo-bar.md): after a tick, a swipe, a star or a
 * change, what happened and an Undo button, for six seconds. It is a block in the layout, rendered
 * at the bottom of whatever surface is on top (above the input bar, at the foot of the To do panel
 * or of a sheet), never positioned over the page with a guessed offset. Undo puts the item back
 * exactly as it was (the server keeps the previous state; Shopping reopens offline).
 */
import { L } from '../ui/lang';
import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export interface UndoInfo { key: number; label: string; undo: () => void }

export function UndoBar({ info, onClose }: { info: UndoInfo | null; onClose: () => void }) {
  useEffect(() => {
    if (!info) return;
    const t = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(t);
  }, [info, onClose]);
  if (!info) return null;
  return (
    <div className="shrink-0 px-3 pb-2 pt-1" role="status" aria-live="polite">
      <div className="mx-auto flex w-full max-w-md items-center gap-3 rounded-[12px] bg-pc-text py-1 pl-4 pr-1 text-pc-base shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <span className="min-w-0 flex-1 truncate text-[15px]">{info.label}</span>
        <button type="button" onClick={() => { info.undo(); onClose(); }}
          className="press flex h-10 shrink-0 items-center gap-1.5 rounded-[8px] px-3 text-[15px] font-semibold">
          <RotateCcw size={16} strokeWidth={2.5} /> {L('Undo')}
        </button>
      </div>
    </div>
  );
}
