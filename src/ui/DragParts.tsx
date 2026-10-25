/** The drop line and the lifted row that follows the finger (dragOrder.ts). */
import type { ReactNode } from 'react';

/** Where the row would go: a line before `before` in `zone` (or at its end). */
export function DropLine({ show }: { show: boolean }) {
  return show ? <div className="mx-3 my-0.5 h-[3px] rounded-full bg-pc-accent" aria-hidden /> : null;
}

/** The lifted row, following the finger. */
export function DragGhost({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed z-50 w-[min(340px,80vw)] -translate-x-1/2 -translate-y-[70%] rounded-[12px] bg-pc-elevated px-3 py-2.5 text-[15px] shadow-2xl ring-1 ring-[var(--pc-border)]"
      style={{ left: x, top: y }} aria-hidden>{children}</div>
  );
}
