/**
 * Waiting, shown honestly (my.design principles/05-feedback.md):
 *  - useDelayedFlag: a spinner appears only after 200 ms (fast actions never flash one) and, once
 *    shown, stays at least 400 ms (no flicker);
 *  - useElapsed: seconds since something started, for "Working on it · 12 s".
 */
import { useEffect, useRef, useState } from 'react';

export function useDelayedFlag(on: boolean, delay = 200, minShown = 400): boolean {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (on) {
      if (shown) return;   // already up: keep the time it appeared
      const t = window.setTimeout(() => { since.current = Date.now(); setShown(true); }, delay);
      return () => window.clearTimeout(t);
    }
    if (!shown) return;
    const left = Math.max(0, minShown - (Date.now() - since.current));
    const t = window.setTimeout(() => setShown(false), left);
    return () => window.clearTimeout(t);
  }, [on, shown, delay, minShown]);
  return shown;
}

/** Whole seconds since `from` (ms timestamp), ticking once a second; 0 when `from` is null. */
export function useElapsed(from: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (from === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [from]);
  return from === null ? 0 : Math.max(0, Math.floor((now - from) / 1000));
}

export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** The current time, updated once a second while `active` (for elapsed times shown in a list). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}
