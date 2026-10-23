/**
 * Back closes the top layer (a sheet, a full-screen panel), as the phone's Back does in any app
 * (my.design principles/09-platform.md). Each open layer owns one history step, numbered by depth,
 * so with two layers open (Products, then a product) Back closes only the top one.
 *  - Closed by Back: its step is already gone.
 *  - Closed by a button: its step is taken off a moment later, together with any other layer
 *    closed in the same moment (Ask from an item over To do closes both: one `history.go(-2)`).
 *  - Opened in that same moment (At home -> Products): it reuses a step that was about to be taken
 *    off, instead of pushing a new one.
 * Steps are added when a layer opens, which follows a tap or a swipe, so Chrome counts them.
 */
import { useEffect, useRef } from 'react';

type LayerState = { oc?: string; depth?: number } | null;
const depthNow = () => { const s = history.state as LayerState; return s?.oc === 'layer' ? (s.depth ?? 0) : 0; };

// A reload keeps history.state: a step left by a sheet that was open is no longer anyone's.
if (typeof history !== 'undefined' && (history.state as LayerState)?.oc === 'layer') history.replaceState(null, '');

let depth = 0;     // layers open now
let toPop = 0;     // steps of layers closed by a button, not yet taken off
let popTimer: number | null = null;

function schedulePop() {
  if (popTimer !== null) return;
  popTimer = window.setTimeout(() => {
    popTimer = null;
    const n = toPop; toPop = 0;
    if (n > 0) history.go(-n);
  }, 0);
}

export function useBackLayer(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const mine = ++depth;
    if (toPop > 0) { toPop--; history.replaceState({ oc: 'layer', depth: mine }, ''); }
    else history.pushState({ oc: 'layer', depth: mine }, '');
    let closedByBack = false;
    const onPop = () => { if (depthNow() < mine) { closedByBack = true; close.current(); } };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      depth = Math.max(0, depth - 1);
      if (closedByBack) return;
      toPop++; schedulePop();
    };
  }, [open]);
}

/**
 * oc and Shopping size everything in rem (Tailwind): pin the root to 16 px so the my.design sizes are
 * exact (40 / 48 / 56). The classic PinchChat views set it to their own font-size setting (15 px).
 */
export function useExactSizes() {
  useEffect(() => {
    const html = document.documentElement, before = html.style.fontSize;
    html.style.fontSize = '16px';
    return () => { html.style.fontSize = before; };
  }, []);
}
