/**
 * Actionable items in agent messages (ai.manager registers and to-dos).
 *
 * The Admin and General agents, and the morning reminder notes, end a line
 * that names a register item with a marker ⟨adm-YYYY-MM-DD-xxxxxx⟩. The
 * messenger hides the markers and shows one row per item with Done / Snooze,
 * backed by /reg/status (current state) and /reg/act (the change) — the same
 * endpoints the notification buttons use.
 */
export interface MessageItem {
  id: string;
  label: string;
}

export interface ItemState {
  status: string;
  remind_on?: string;
  due_date?: string;
  title?: string;
}

const MARKER = /\s*⟨(adm-\d{4}-\d{2}-\d{2}-[0-9a-f]{6})⟩/g;

/** The text without markers, and the items it names (in order, each once). */
export function extractItems(text: string): { text: string; items: MessageItem[] } {
  const items: MessageItem[] = [];
  for (const line of text.split('\n')) {
    for (const m of line.matchAll(MARKER)) {
      if (items.some(i => i.id === m[1])) continue;
      const label = line.replace(MARKER, '')
        .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
        .replace(/\*\*|__|`/g, '')
        .trim();
      items.push({ id: m[1], label: label.length > 90 ? `${label.slice(0, 89)}…` : label });
    }
  }
  return { text: text.replace(MARKER, ''), items };
}

export const isClosed = (s?: ItemState) => !!s && ['paid', 'done', 'cancelled'].includes(s.status);

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export const fetchItemStates = (ids: string[]) =>
  post<{ items: Record<string, ItemState>; today: string }>('/reg/status', { items: ids });

export const actOnItem = (id: string, action: 'done' | 'snooze') =>
  post<{ ok: boolean; status: string; remind_on?: string; title: string }>('/reg/act', { item: id, action });
