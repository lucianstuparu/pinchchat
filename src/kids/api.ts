/**
 * The kids app's data: one shared list on CT 103 (/srv/shared/kids), read and changed through
 * register-api's /kids/* routes (ai.manager kids-app.md). The last list is kept on the phone, so the
 * app opens with it at once and still shows it offline.
 */
import { post } from '../app/api';
export { roError } from '../artlia/api';

export type Kind = 'task' | 'activity' | 'event' | 'idea' | 'plan';
export type Status = 'todo' | 'done' | 'cancelled';
export type EventType = 'birthday' | 'invitation' | 'outing' | 'meeting' | 'dayoff' | 'other';
export type Who = 'lucian' | 'ludmila' | 'both';

/** A weekly session: ISO weekday (Monday = 1) and times. */
export interface Slot { day: number; start: string; end?: string }
export interface CalEvent { id: string; link?: string; start: string; weekly_until?: string }
export interface KidItem {
  id: string; n?: number; kind: Kind; title: string; status: Status; child?: string;
  due_date?: string; end_date?: string; time?: string; end_time?: string; type?: EventType; rsvp?: 'yes' | 'no' | 'maybe';
  who?: Who; schedule?: Slot[]; season_from?: string; season_to?: string;
  place?: string; cost?: string; contact?: string; bring?: string;
  tags?: string[]; materials?: string; link?: string; tried?: string; loved?: boolean;
  /** A step of this plan (the plan's id). */
  plan?: string;
  priority?: string; snoozed_until?: string; notes?: string; calendar?: CalEvent[];
  source?: string; added_by?: string; updated?: string; created?: string;
}
export interface Child { id: string; name: string; class?: string }
export interface KidList { today: string; children: Child[]; items: KidItem[] }

export type KidAction = 'done' | 'reopen' | 'snooze' | 'drop' | 'undo' | 'edit' | 'note' | 'calendar' | 'uncalendar';

const CACHE = 'kids:list';

export function cachedList(): KidList | null {
  try { const s = localStorage.getItem(CACHE); return s ? (JSON.parse(s) as KidList) : null; } catch { return null; }
}

export async function fetchList(): Promise<KidList> {
  const l = await post<KidList>('/kids/list', {});
  try { localStorage.setItem(CACHE, JSON.stringify(l)); } catch { /* full or blocked: the next open fetches again */ }
  return l;
}

export const actOn = (item: string, action: KidAction, extra: Record<string, unknown> = {}) =>
  post<{ ok: boolean; item?: KidItem; error?: string }>('/kids/act', { item, action, ...extra });
