/**
 * Never reload mid-task, and keep what was typed (my.design principles/09-platform.md):
 *  - every input box says when it holds something in progress (text, a recording, photos waiting);
 *  - an app update reloads at once only when nothing is in progress, otherwise the next time the
 *    app goes to the background with every box idle;
 *  - the text in a box is saved as a draft and comes back after any reload.
 */
import { useEffect, useState } from 'react';

const busy = new Set<string>();
let pendingReload: (() => void) | null = null;

function tryReload(onlyWhenHidden: boolean) {
  if (!pendingReload || busy.size > 0) return;
  if (onlyWhenHidden && document.visibilityState !== 'hidden') return;
  const reload = pendingReload; pendingReload = null; reload();
}

/** Called by the service-worker code when a new version is ready. */
export function reloadWhenIdle(reload: () => void) {
  pendingReload = reload;
  if (busy.size === 0) { tryReload(false); return; }
  document.addEventListener('visibilitychange', () => tryReload(true));
}

/** A box reports whether it holds something in progress. */
export function useBusy(key: string, on: boolean) {
  useEffect(() => {
    if (on) busy.add(key); else { busy.delete(key); tryReload(true); }
    return () => { busy.delete(key); };
  }, [key, on]);
}

const read = (key: string) => { try { return localStorage.getItem(`draft:${key}`) ?? ''; } catch { return ''; } };

/** A text box's content, kept across reloads. `initial` (e.g. shared content) wins over the draft. */
export function useDraft(key: string, initial?: string): [string, (v: string | ((p: string) => string)) => void] {
  const [text, setText] = useState(() => (initial !== undefined && initial !== '' ? initial : read(key)));
  useEffect(() => {
    try { if (text) localStorage.setItem(`draft:${key}`, text); else localStorage.removeItem(`draft:${key}`); } catch { /* not kept */ }
  }, [key, text]);
  return [text, setText];
}
