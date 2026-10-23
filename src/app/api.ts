/**
 * The desk API (register-api on CT 103 through Caddy, same origin, behind Cloudflare Access):
 * what Now, Open loops and the item sheet show, and the write door.
 */
export type Section = 'overdue' | 'today' | 'week' | 'waiting' | 'later';

export interface NowItem {
  id: string;
  /** The short number, household-wide ("22 done"). */
  n?: number;
  /** What kind of doing it is: Admin, Money, Health, People, Errands (the coloured pills). */
  topics?: string[];
  title: string;
  kind: string;
  store: 'admin' | 'tasks' | 'loops' | 'shopping' | 'pantry';
  scope: 'private' | 'shared';
  status: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  consequence?: string;
  amount?: number;
  currency?: string;
  payee?: string;
  domain?: string;
  due_date?: string;
  scheduled?: string;
  remind_on?: string;
  weight: number;
  section: Section;
  added_by?: string;
}

export interface Loop {
  id: string;
  n?: number;
  title: string;
  domain?: string;
  state: string;
  next_step?: string;
  links?: string[];
  status: string;
  last_touched?: string;
  scope: 'private' | 'shared';
}

export interface Sheet {
  today: string;
  item: Record<string, unknown> & { id: string; title: string; status: string; store: string; scope: string };
  origin: { kind: 'message' | 'mail'; id: string; ts?: string; text?: string; type?: string } | null;
}

export type ItemAction = 'done' | 'snooze' | 'drop' | 'reopen' | 'priority' | 'edit' | 'undo' | 'to-task' | 'loop-close';

export class SessionExpired extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new SessionExpired('offline or signed out');   // an Access redirect fails as an opaque error
  }
  if (res.redirected || res.type === 'opaqueredirect') throw new SessionExpired('signed out');
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new SessionExpired((data as { error?: string }).error || 'signed out');
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export const transcribeAudio = (audio: { content: string; mimeType: string }) =>
  post<{ text: string; lang: string | null }>('/reg/transcribe', { audio: audio.content, mimeType: audio.mimeType }).then(r => r.text);
export const fetchNow = () => post<{ today: string; items: NowItem[] }>('/reg/now', {});
export const fetchLoops = () => post<{ today: string; loops: Loop[] }>('/reg/loops', {});
export const fetchSheet = (item: string) => post<Sheet>('/reg/item', { item });
export const fetchStates = (items: string[]) => post<{ items: Record<string, Partial<NowItem>>; today: string }>('/reg/status', { items });
export const act = (item: string, action: ItemAction, extra: Record<string, unknown> = {}) =>
  post<{ ok: boolean; status: string; remind_on?: string; priority?: string; title: string; task?: { id: string } }>('/reg/act', { item, action, ...extra });

/** Who is signed in ('' when unknown: no Access identity, LAN, or local dev). */
export async function whoami(): Promise<string> {
  try {
    const r = await fetch('/whoami', { cache: 'no-store', credentials: 'same-origin' });
    const t = r.ok ? (await r.text()).trim() : '';
    return /^[a-z][a-z0-9-]{0,30}$/.test(t) ? t : '';
  } catch {
    return '';
  }
}

export function formatAmount(amount?: number, currency?: string): string {
  if (amount == null) return '';
  const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF ', RON: 'RON ' };
  const n = amount.toLocaleString(undefined, { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const c = (currency || '').toUpperCase();
  return (symbols[c] ?? (c ? `${c} ` : '')) + n;
}

export const formatDay = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** "3 d ago", "today", "2 w ago" — for loops. */
export function ago(d: string | undefined, today: string): string {
  if (!d) return '';
  const days = Math.round((Date.parse(today) - Date.parse(d.slice(0, 10))) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} d ago`;
  return `${Math.round(days / 7)} w ago`;
}

/** The date line of a to-do: Overdue / Today / Tomorrow / a date, with its colour class. */
export function whenLabel(item: NowItem, today: string): { text: string; cls: string } | null {
  const due = item.due_date || item.scheduled?.slice(0, 10);
  if (item.section === 'waiting') return { text: 'Waiting', cls: 'text-pc-text-muted' };
  if (!due) return null;
  if (item.section === 'overdue') return { text: `Overdue · ${formatDay(due)}`, cls: 'text-red-500' };
  if (item.section === 'today') return { text: 'Today', cls: 'text-pc-accent' };
  if (due === nextDay(today)) return { text: 'Tomorrow', cls: 'text-pc-accent' };
  return { text: formatDay(due), cls: 'text-pc-text-muted' };
}
const nextDay = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);
