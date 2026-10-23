/**
 * The progress row (my.design patterns/progress-row.md, after the createui upload component): what
 * is happening, how far, and a way out. A thumbnail or icon tile, a name, "Uploading 68% · 1.4 MB of
 * 2.3 MB" (or, when the length is unknown, what is happening and for how long), cancel, a 4 px bar.
 */
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function ProgressRow({ tile, name, status, detail, progress, onCancel, cancelLabel = 'Cancel' }: {
  tile: ReactNode; name: string; status: string; detail?: string;
  /** 0..1, or null while the length is unknown (a moving segment). */
  progress: number | null;
  onCancel?: () => void; cancelLabel?: string;
}) {
  return (
    <div className="rounded-[12px] bg-pc-surface px-3 pb-2.5 pt-2" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-pc-elevated text-pc-text-muted">{tile}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight">{name}</span>
          <span className="block truncate text-[13px] leading-tight">
            <span className="text-[var(--pc-accent-ink)]">{status}</span>
            {detail && <span className="text-pc-text-muted"> · {detail}</span>}
          </span>
        </span>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label={cancelLabel} className="press -mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted">
            <X size={18} />
          </button>
        )}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-[2px] bg-[var(--pc-separator)]" aria-hidden>
        {progress === null
          ? <div className="progress-indeterminate h-full w-1/3 rounded-[2px] bg-pc-accent" />
          : <div className="h-full rounded-[2px] bg-pc-accent transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />}
      </div>
    </div>
  );
}
