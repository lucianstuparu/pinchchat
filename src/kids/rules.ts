/**
 * What the kids screens show, as pure functions (tested): Săptămâna (today to the end of next week,
 * one section per day: activity sessions on their weekday within their season, events, deadlines),
 * Activități by child, Idei by tag, Planuri with their steps, the children's colours and the words.
 */
import type { Child, KidItem, Slot } from './api';

export const isOpen = (i: KidItem) => i.status !== 'done' && i.status !== 'cancelled';
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
export const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** ISO weekday: Monday = 1 … Sunday = 7. */
export const weekday = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return w === 0 ? 7 : w; };

// ---- words (Romanian; French school terms stay as they are)
export const DAY_NAME = ['', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
const MONTH = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sept', 'oct', 'nov', 'dec'];
export const shortDate = (d: string) => `${Number(d.slice(8, 10))} ${MONTH[Number(d.slice(5, 7)) - 1]}`;
export const KIND_LABEL: Record<string, string> = { task: 'De făcut', activity: 'Activitate', event: 'Eveniment', idea: 'Idee', plan: 'Plan' };
export const TYPE_LABEL: Record<string, string> = { birthday: 'Zi de naștere', invitation: 'Invitație', outing: 'Ieșire', meeting: 'Întâlnire cu școala', dayoff: 'Zi liberă', other: 'Eveniment' };
export const WHO_LABEL: Record<string, string> = { lucian: 'duce Lucian', ludmila: 'duce Ludmila', both: 'merg amândoi' };
export const RSVP_LABEL: Record<string, string> = { yes: 'Venim', no: 'Nu venim', maybe: 'Poate' };

/** "miercuri 14:00–15:00" */
export const slotText = (s: Slot) => `${DAY_NAME[s.day]} ${s.start}${s.end ? `–${s.end}` : ''}`;
export const timeText = (start?: string, end?: string) => (start ? `${start}${end ? `–${end}` : ''}` : '');

// ---- the children: a colour each (by their order), "both" = the two
const CHILD_TONES = [
  { fill: '#0e7c86', ink: '#0b5f66', inkDark: '#5fcfd9' },
  { fill: '#c2477f', ink: '#8e2a59', inkDark: '#f39cc3' },
  { fill: '#7c5cd6', ink: '#5b3fb5', inkDark: '#b9a6f5' },
];
export const childTone = (id: string, children: Child[]) => CHILD_TONES[Math.max(0, children.findIndex(c => c.id === id)) % CHILD_TONES.length];
/** The children an item is for, in order: one, or all for "both". */
export const childrenOf = (i: Pick<KidItem, 'child'>, children: Child[]) =>
  (i.child === 'both' ? children : children.filter(c => c.id === i.child));
export const childName = (id: string | undefined, children: Child[]) =>
  (id === 'both' ? 'Amândouă' : children.find(c => c.id === id)?.name ?? '');

// ---- Săptămâna
export interface WeekLine {
  key: string; item: KidItem;
  /** What kind of line: a session of an activity, an event, a deadline, a plan's target. */
  what: 'session' | 'event' | 'task' | 'plan';
  time?: string; end?: string;
  /** An event that started before this day ("până pe 4 ian" on the first day shown). */
  until?: string;
}
export interface WeekDay { date: string; lines: WeekLine[] }
export interface Week { overdue: KidItem[]; days: WeekDay[]; undated: KidItem[]; from: string; to: string }

/** The last day shown: the Sunday of next week. */
export const weekEnd = (today: string) => addDays(today, 7 - weekday(today) + 7);

const inSeason = (i: KidItem, d: string) => (!i.season_from || i.season_from <= d) && (!i.season_to || d <= i.season_to);

export function week(items: KidItem[], today: string, to = weekEnd(today)): Week {
  const days: WeekDay[] = [];
  for (let d = today; d <= to; d = addDays(d, 1)) days.push({ date: d, lines: [] });
  const at = (d: string) => days.find(x => x.date === d);
  const overdue: KidItem[] = [], undated: KidItem[] = [];
  for (const i of items) {
    if (!isOpen(i)) continue;
    if (i.kind === 'activity') {
      for (const day of days) for (const [k, s] of (i.schedule ?? []).entries()) {
        if (s.day === weekday(day.date) && inSeason(i, day.date)) day.lines.push({ key: `${i.id}:${k}:${day.date}`, item: i, what: 'session', time: s.start, end: s.end });
      }
    } else if (i.kind === 'event') {
      if (!i.due_date) continue;
      const last = i.end_date ?? i.due_date;
      if (last < today || i.due_date > to) continue;
      // A several-day event shows once: on its first day, or today when it started before.
      const first = i.due_date < today ? today : i.due_date;
      at(first)?.lines.push({ key: i.id, item: i, what: 'event', time: i.time, end: i.end_time, until: i.end_date && i.end_date !== first ? i.end_date : undefined });
    } else if (i.kind === 'task' || i.kind === 'plan') {
      if (!i.due_date) { if (i.kind === 'task' && !i.plan) undated.push(i); continue; }
      if (i.due_date < today) { if (i.kind === 'task') overdue.push(i); continue; }
      at(i.due_date)?.lines.push({ key: i.id, item: i, what: i.kind });
    }
  }
  // The whole day first (deadlines, days off), then by time.
  for (const d of days) d.lines.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || (a.item.n ?? 0) - (b.item.n ?? 0));
  overdue.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
  undated.sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  return { overdue, days: days.filter(d => d.lines.length > 0), undated, from: today, to };
}

/** The pinned card: the first thing from now (overdue first), and how many more this week. */
export function topOf(items: KidItem[], today: string): { top: WeekLine | null; day: string | null; overdue: number; more: number } {
  const w = week(items, today, addDays(today, 7 - weekday(today)));
  const all = w.days.flatMap(d => d.lines.map(l => ({ l, d: d.date })));
  if (w.overdue.length) return { top: { key: w.overdue[0].id, item: w.overdue[0], what: 'task' }, day: w.overdue[0].due_date ?? null, overdue: w.overdue.length, more: all.length };
  const first = all[0];
  return { top: first?.l ?? null, day: first?.d ?? null, overdue: 0, more: Math.max(0, all.length - 1) };
}

/** "Azi", "Mâine", "miercuri 5 nov" */
export function dayTitle(d: string, today: string) {
  const n = daysBetween(today, d);
  const name = `${DAY_NAME[weekday(d)]} ${shortDate(d)}`;
  return n === 0 ? `Azi · ${name}` : n === 1 ? `Mâine · ${name}` : name;
}

// ---- Activități: by child (Carla, Lia, then those for both)
export function activitiesByChild(items: KidItem[], children: Child[]) {
  const acts = items.filter(i => i.kind === 'activity' && isOpen(i));
  const groups = [...children.map(c => ({ key: c.id, label: c.name, items: acts.filter(i => i.child === c.id) })),
    { key: 'both', label: 'Amândouă', items: acts.filter(i => i.child === 'both') },
    { key: 'none', label: 'Fără copil', items: acts.filter(i => !i.child || (i.child !== 'both' && !children.some(c => c.id === i.child))) }];
  const first = (i: KidItem) => Math.min(...(i.schedule ?? []).map(s => s.day * 10000 + Number(s.start.replace(':', ''))), 99999);
  for (const g of groups) g.items.sort((a, b) => first(a) - first(b));
  return groups.filter(g => g.items.length > 0);
}

// ---- Idei: tags, the most used first; filtered by one tag
export function ideaTags(items: KidItem[]): string[] {
  const count = new Map<string, number>();
  for (const i of items) if (i.kind === 'idea' && isOpen(i)) for (const t of i.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}
export function ideas(items: KidItem[], tag: string | null): KidItem[] {
  return items.filter(i => i.kind === 'idea' && isOpen(i) && (!tag || (i.tags ?? []).includes(tag)))
    .sort((a, b) => Number(!!b.loved) - Number(!!a.loved) || String(b.created ?? '').localeCompare(String(a.created ?? '')));
}

// ---- Planuri: each plan with its steps
export interface PlanView { plan: KidItem; steps: KidItem[]; done: number }
export function plans(items: KidItem[]): PlanView[] {
  return items.filter(i => i.kind === 'plan' && i.status !== 'cancelled')
    .map(plan => {
      const steps = items.filter(s => s.plan === plan.id && s.status !== 'cancelled')
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || (a.n ?? 0) - (b.n ?? 0));
      return { plan, steps, done: steps.filter(s => !isOpen(s)).length };
    })
    .sort((a, b) => Number(!isOpen(a.plan)) - Number(!isOpen(b.plan)) || (a.plan.due_date ?? '9999').localeCompare(b.plan.due_date ?? '9999'));
}

// ---- the shared chat: "[Ludmila] text" says who wrote it
export { senderOf } from '../mobile/messageView';
export { withSender } from '../artlia/rules';
