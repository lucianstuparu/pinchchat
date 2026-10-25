/**
 * Drag a row to put it in another order, or into / out of the highlighted box (Lucian 2026-10-25: "drag and drop
 * taskuri în highlight zone", "order also within the highlighted area or in the other area, also by drag").
 * Shared by oc's To do and Casa Artlia's Acum.
 *
 * A long press lifts a row (useLift, on the row). While lifted, what is under the finger or the mouse decides
 * where it goes: the section (`data-zone`) and the row it goes before (`data-row`). On release the list gets the
 * drop (useDragDrop) and turns it into a Move: focus on / off, and the new order of one section. opsFor turns a
 * Move into server actions (items.mjs `focus` and `order`), their undo, and the local change (dragRules.ts).
 */
import { useEffect, useRef, useState } from 'react';
import type { Over } from './dragRules';

const LIFT_MS = 380;

/** A long press (finger or mouse) lifts the row. Wire `touch*` into the row's own touch handlers. */
export function useLift(onLift: ((x: number, y: number) => void) | undefined) {
  const lift = useRef<{ timer: number; x: number; y: number; up: boolean } | null>(null);
  const suppressClick = useRef(false);   // the click a mouse release sends after a drag
  const lifted = () => !!lift.current?.up;
  const end = () => {
    const l = lift.current; if (l) window.clearTimeout(l.timer);
    if (l?.up) { suppressClick.current = true; window.setTimeout(() => { suppressClick.current = false; }, 300); }
    lift.current = null;
  };
  const start = (x: number, y: number) => {
    if (!onLift) return;
    const l = { x, y, up: false, timer: 0 };
    l.timer = window.setTimeout(() => {
      l.up = true; navigator.vibrate?.(15); onLift(l.x, l.y);
      // The release may happen anywhere (over another section): end the hold there too.
      const off = () => { end(); document.removeEventListener('mouseup', off); document.removeEventListener('touchend', off); };
      document.addEventListener('mouseup', off); document.addEventListener('touchend', off);
    }, LIFT_MS);
    lift.current = l;
  };
  const move = (x: number, y: number) => {
    const l = lift.current; if (!l || l.up) return;
    if (Math.abs(x - l.x) > 8 || Math.abs(y - l.y) > 8) { window.clearTimeout(l.timer); lift.current = null; }
  };
  return {
    lifted,
    touchStart: (x: number, y: number) => start(x, y),
    touchMove: (x: number, y: number) => move(x, y),
    touchEnd: (e: { preventDefault: () => void }) => { if (lifted()) e.preventDefault(); end(); },   // no click after a lift
    mouse: onLift ? {
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      onMouseDown: (e: { button: number; clientX: number; clientY: number }) => { if (e.button === 0) start(e.clientX, e.clientY); },
      onMouseMove: (e: { clientX: number; clientY: number }) => move(e.clientX, e.clientY),
      onMouseUp: end,
      onMouseLeave: () => { if (!lifted()) end(); },
      onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
        if (lifted() || suppressClick.current) { e.preventDefault(); e.stopPropagation(); }
      },
    } : {},
  };
}

export interface DragState<T> { item: T; from: string; x: number; y: number; over: Over | null }

/** The nearest scrolling ancestor (the list pane), for scrolling while dragging near an edge. */
function scrollerOf(el: Element | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export function useDragDrop<T extends { id: string }>(onDrop: (item: T, from: string, over: Over | null) => void) {
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const cur = useRef<DragState<T> | null>(null);
  const drop = useRef(onDrop);
  useEffect(() => { drop.current = onDrop; });
  const dragging = drag !== null;
  const lift = (item: T, from: string, x: number, y: number) => { const d = { item, from, x, y, over: { zone: from, before: null } }; cur.current = d; setDrag(d); };

  useEffect(() => {
    if (!dragging) return;
    const scroller = scrollerOf(document.querySelector('[data-zone]'));
    const move = (x: number, y: number) => {
      const d0 = cur.current; if (!d0) return;
      const zone = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-zone]');
      let over: Over | null = null;
      if (zone) {
        const rows = [...zone.querySelectorAll<HTMLElement>('[data-row]')].filter(r => r.dataset.row !== d0.item.id);
        const next = rows.find(r => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
        over = { zone: zone.dataset.zone ?? '', before: next?.dataset.row ?? null };
      }
      if (y < 110) scroller?.scrollBy(0, -14); else if (y > window.innerHeight - 110) scroller?.scrollBy(0, 14);
      const d = { ...d0, x, y, over };
      cur.current = d; setDrag(d);
    };
    const end = () => {
      const d = cur.current;
      cur.current = null; setDrag(null);
      if (d) drop.current(d.item, d.from, d.over);
    };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', end);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', end);
      document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', end);
    };
  }, [dragging]);

  return { drag, lift };
}
