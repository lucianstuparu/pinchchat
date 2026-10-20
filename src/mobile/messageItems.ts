/**
 * Actionable items in agent messages (ai.manager registers and to-dos).
 *
 * The Admin and General agents, and the morning reminder notes, end a line
 * that names a register item with a marker ⟨adm-YYYY-MM-DD-xxxxxx⟩. The
 * messenger replaces those lines with cards (title, amount, due state, one
 * row of actions), backed by /reg/status (the item's data) and /reg/act
 * (the change) — the same endpoints the notification buttons use.
 */
export interface MessageItem {
  id: string;
  /** Fallback title from the message line, used until /reg/status answers. */
  label: string;
}

export interface ItemState {
  status: string;
  remind_on?: string;
  due_date?: string;
  title?: string;
  amount?: number;
  currency?: string;
  kind?: string;
  payee?: string;
  domain?: string;
  scope?: 'private' | 'shared';
  store?: 'admin' | 'todo';
}

export type ItemAction = 'done' | 'snooze' | 'drop' | 'reopen';

const MARKER = /\s*⟨(adm-\d{4}-\d{2}-\d{2}-[0-9a-f]{6})⟩/g;
const LIST_LINE = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * The text to show and the items it names (in order, each once). A list line
 * that names an item is dropped from the text — the card replaces it; prose
 * that names an item keeps its words, minus the marker.
 */
export function extractItems(text: string): { text: string; items: MessageItem[] } {
  const items: MessageItem[] = [];
  const kept: string[] = [];
  for (const line of text.split('\n')) {
    const marks = [...line.matchAll(MARKER)];
    if (marks.length === 0) { kept.push(line); continue; }
    const label = line.replace(MARKER, '').replace(LIST_LINE, '').replace(/\*\*|__|`/g, '').trim();
    for (const m of marks) {
      if (!items.some(i => i.id === m[1])) items.push({ id: m[1], label: label.length > 90 ? `${label.slice(0, 89)}…` : label });
    }
    if (!LIST_LINE.test(line)) kept.push(line.replace(MARKER, ''));
  }
  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), items };
}

export const isClosed = (s?: ItemState) => !!s && ['paid', 'done', 'cancelled'].includes(s.status);

/** How urgent an open item is, from its due date and today (both YYYY-MM-DD). */
export function urgency(s: ItemState | undefined, today: string): 'overdue' | 'today' | 'soon' | 'later' | 'none' {
  if (!s?.due_date || !today) return 'none';
  if (s.due_date < today) return 'overdue';
  if (s.due_date === today) return 'today';
  const days = Math.round((Date.parse(s.due_date) - Date.parse(today)) / 86_400_000);
  return days <= 3 ? 'soon' : 'later';
}

export function formatAmount(amount?: number, currency?: string): string {
  if (amount == null) return '';
  const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF ', RON: 'RON ' };
  const n = amount.toLocaleString(undefined, { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const c = (currency || '').toUpperCase();
  return (symbols[c] ?? (c ? `${c} ` : '')) + n;
}

export function formatDay(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

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

export const actOnItem = (id: string, action: ItemAction) =>
  post<{ ok: boolean; status: string; remind_on?: string; title: string }>('/reg/act', { item: id, action });
