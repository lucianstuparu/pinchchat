import { useState, useCallback } from 'react';

const STORAGE_KEY = 'pinchchat-send-on-enter';

/** Hook to manage the send shortcut preference (Enter vs Ctrl+Enter). */
export function useSendShortcut() {
  const [sendOnEnter, setSendOnEnter] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const toggle = useCallback(() => {
    setSendOnEnter(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { sendOnEnter, toggle };
}
