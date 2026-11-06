/**
 * The desk API (register-api on CT 103 through Caddy, same origin, behind Cloudflare Access):
 * what Now, Open loops and the item sheet show, and the write door.
 */
export type Section = 'overdue' | 'today' | 'week' | 'waiting' | 'later';

/** What a thing looks like (src/kit2/ObjectFace): a logo, a drawing, or a drawing with the logo on it. */
export interface Face { logo?: string; object?: string; drawing?: string; /** A brand's or the realm's letters, and the brand's colour. */ mono?: string; mono_color?: string; name?: string }

/** oc v2: the next move (my.design v2/oc-v2-brief.md §7.4, §14.1). */
export interface Step { first: string; verb?: string; minutes?: number; where?: string; shape?: string; why?: string; by?: 'person' | 'coach'; draft?: string; recovery?: string; started?: string }
export interface Move { first: string; why?: string; minutes?: number; where?: string }
/** What the person told someone they would do; `told` keeps each time they kept them informed (§13.5). */
export interface Promise_ { to: string; said?: string; by?: string; on?: string; told?: Array<{ at: string; kind: string; how?: 'sent' | 'copied' }> }
export type TellKind = 'late' | 'update' | 'more-time' | 'confirm' | 'give';

export interface NowItem {
  id: string;
  /** The short number, household-wide ("22 done"). */
  n?: number;
  /** What kind of doing it is: Admin, Money, Health, People, Errands, Home, Business (Casa Artlia) (coloured icons in a row). */
  topics?: string[];
  /** "every month", when the task comes back after it is done. */
  repeat?: string;
  /** Put off until this day ("Remind in 3 days"); hidden from To do until then unless overdue or due today. */
  snoozed_until?: string;
  hidden?: boolean;
  /** Put in the highlighted box by hand (the day); and its place within its group, set by dragging. */
  focus?: string;
  rank?: number;
  title: string;
  /** oc v2: four words at most; the title stays the full one. */
  glance_title?: string;
  /** Who owes it, and since when it has been waiting (or its last change). */
  waits_for?: string; waiting_since?: string; updated_at?: string;
  face?: Face;
  /** oc v2: in Passing by because its payee is marked automatic. */
  automatic?: boolean;
  step?: Step; alternatives?: Move[]; readiness?: string; realm_id?: string; matter?: string;
  promise?: Promise_; waiting_on?: string; parked?: { on: string; why?: string }; review_on?: string; given_to?: string;
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
  /** Watch-outs (kind watch): the account or place, and one line of what to check. */
  place?: string;
  check?: string;
  /** Only in the Done list: the day it was finished. */
  done_on?: string;
}

/**
 * Watch-outs (ai.manager oc-app-design.md): what happens by itself (a direct debit, a delivery, a renewal).
 * Never something to do: not in items, not counted. upcoming nearest first; passed = the last 30 days.
 */
export interface Watching { upcoming: NowItem[]; passed: NowItem[] }

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
  /** oc v2's sheet. */
  face?: Face; glance_title?: string; realm_id?: string;
  matter?: { name: string; things: number; state: string; brief: Brief | null } | null;
}

/** The matter's brief (§13.4): rows with nothing are hidden, never shown empty. */
export interface DatedLine { date: string; what: string }
export interface Brief { name?: string; purpose?: string; state?: string; tried?: string[]; ruled_out?: string[]; confirmed?: DatedLine[]; estimated?: DatedLine[]; evidence?: string[]; open?: string[]; written_on?: string; written_by?: string; by_person?: string[] }

export type ItemAction = 'step-set' | 'step-pick' | 'step-reject' | 'step-start' | 'step-stop' | 'step-next' | 'think' | 'review-tomorrow' | 'park' | 'unpark' | 'readiness' | 'promise-set' | 'promise-tell' | 'give' | 'brief-correct' | 'tile-top' | 'away-seen' | 'crucial' | 'tile-move' | 'day-undo' | 'done' | 'snooze' | 'drop' | 'reopen' | 'priority' | 'edit' | 'undo' | 'to-task' | 'loop-close' | 'focus' | 'order' | 'went-wrong';

export class SessionExpired extends Error {}

export async function post<T>(path: string, body: unknown): Promise<T> {
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
export const fetchNow = () => post<{ today: string; items: NowItem[]; watch?: Watching; done?: NowItem[] }>('/reg/now', {});
/** oc v2: what Today shows (register-api /reg/today). */
export interface TodayData {
  today: string; last_open: string | null;
  day: { date: string; crucial: string[]; picked?: string[]; closed_at?: string; in_the_way?: string };
  crucial: NowItem[]; todo: NowItem[]; passing_by: NowItem[]; later_count: number; /** The pile: open things not on show. */ later?: NowItem[];
  /** The bands of §14.2 and §15.1. */
  away?: Away; waiting_you?: NowItem[]; top?: NowItem[]; must?: NowItem[]; worth?: NowItem[]; parked?: NowItem[]; passed_by?: NowItem[]; done_today?: NowItem[];
}
export interface AwayLine { id?: string; face?: Face; text: string; missed?: boolean }
export interface Away { days: number; lines: AwayLine[]; more: number; way_back: { id: string; label: string; minutes?: number } | null }
export const fetchToday = () => post<TodayData>('/reg/today', {});
export interface Payee { key: string; name: string; count: number; amount?: number; currency?: string; auto: boolean }
export const fetchPayees = () => post<{ payees: Payee[] }>('/reg/payees', {}).then(r => r.payees);
export const setPayee = (payee: string, auto: boolean) => post<{ ok: boolean; was: boolean }>('/reg/payees/act', { payee, auto });
export const fetchLoops = () => post<{ today: string; loops: Loop[] }>('/reg/loops', {});
export const fetchSheet = (item: string) => post<Sheet>('/reg/item', { item });
export const fetchStates = (items: string[]) => post<{ items: Record<string, Partial<NowItem>>; today: string }>('/reg/status', { items });
/** A coordination message: written by the server, sent only by the person's tap (TellSheet). */
export interface TellDraft { to: string; contact: { id: string; name: string; lang: string; channel: string; phone: boolean } | null; text: string }
export const fetchTell = (item: string, kind: TellKind, opts: { shorter?: boolean; nodate?: boolean; to?: string } = {}) => post<TellDraft>('/reg/tell', { item, kind, ...opts });
export const act = (item: string, action: ItemAction, extra: Record<string, unknown> = {}) =>
  post<{ ok: boolean; status: string; remind_on?: string; priority?: string; title: string; task?: { id: string }; next_due?: string }>('/reg/act', { item, action, ...extra });

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
