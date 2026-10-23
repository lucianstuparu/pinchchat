/**
 * How To do looks and groups (ai.manager oc-app-design.md, after Lucian's life-manager artifact):
 * topic colours for the number and the pills, the areas the list is grouped by, the due chip, and
 * the boxes at the top (Due & overdue, Priority). Pure functions, so the rules are tested.
 */
import type { NowItem } from './api';

/** Topic colours (the artifact's palette): rail = the number, bg/ink = the pill. */
export const TOPIC_COLORS: Record<string, { rail: string; bg: string; ink: string; inkDark: string }> = {
  Admin:   { rail: '#1d9e75', bg: '#e1f5ee', ink: '#0f6e56', inkDark: '#5fd3a9' },
  Money:   { rail: '#378add', bg: '#e6f1fb', ink: '#0c447c', inkDark: '#8cc0f5' },
  Health:  { rail: '#e24b4a', bg: '#fdeaea', ink: '#a32d2d', inkDark: '#f59a99' },
  People:  { rail: '#ba7517', bg: '#faeeda', ink: '#854f0b', inkDark: '#e9b467' },
  Errands: { rail: '#8a9a2b', bg: '#eef0d9', ink: '#4d5a12', inkDark: '#c3d36a' },
};
export const NO_TOPIC = '#9aa2b4';
export const railOf = (item: { topics?: string[] }) => TOPIC_COLORS[item.topics?.[0] ?? '']?.rail ?? NO_TOPIC;

/** The areas, in screen order, and the domains in each (everything else is Personal). */
export type Area = 'personal' | 'home' | 'admin' | 'work';
export const AREAS: Array<{ id: Area; label: string; dot: string }> = [
  { id: 'personal', label: 'Personal', dot: '#1d9e75' },
  { id: 'home', label: 'Home', dot: '#378add' },
  { id: 'admin', label: 'Admin & money', dot: '#7c5cd6' },
  { id: 'work', label: 'Work & projects', dot: '#ba7517' },
];
const AREA_OF: Record<string, Area> = {
  home: 'home', 'casa-artlia': 'home',
  admin: 'admin', finance: 'admin',
  icrc: 'work', itccs: 'work', 'citizen-next': 'work', cipm: 'work', phd: 'work', iheid: 'work', tech: 'work', 'unicef-lp': 'work', zitec: 'work',
};
export function areaOf(item: Pick<NowItem, 'store' | 'domain'> & { store: string }): Area {
  if (item.store === 'admin') return 'admin';
  if (item.store === 'pantry') return 'home';
  return AREA_OF[item.domain ?? ''] ?? 'personal';
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY);
const short = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export type DueKind = 'overdue' | 'today' | 'soon' | 'later';
/** The due chip: "Overdue (3d)", "Today", "Tomorrow", "Fri 24 Oct". Null without a date. */
export function dueChip(item: Pick<NowItem, 'due_date' | 'scheduled'>, today: string): { kind: DueKind; text: string } | null {
  const due = item.due_date || item.scheduled?.slice(0, 10);
  if (!due || !today) return null;
  const d = daysBetween(today, due);
  if (d < 0) return { kind: 'overdue', text: `Overdue (${-d}d)` };
  if (d === 0) return { kind: 'today', text: 'Today' };
  if (d === 1) return { kind: 'soon', text: 'Tomorrow' };
  return { kind: d <= 7 ? 'soon' : 'later', text: short(due) };
}

/** Due & overdue = overdue, today, and the next three days. */
export const isDue = (item: NowItem, today: string) => {
  const due = item.due_date || item.scheduled?.slice(0, 10);
  return !!due && !!today && daysBetween(today, due) <= 3 && item.section !== 'waiting';
};
export const isStarred = (item: NowItem) => item.priority === 'P1';

export interface TodoGroups {
  due: NowItem[];
  priority: NowItem[];
  areas: Array<{ area: (typeof AREAS)[number]; items: NowItem[] }>;
  waiting: NowItem[];
}
/** Each item appears once: due first, then starred, then its area; waiting on others last. */
export function groupTodo(items: NowItem[], today: string): TodoGroups {
  const due: NowItem[] = [], priority: NowItem[] = [], waiting: NowItem[] = [];
  const byArea = new Map<Area, NowItem[]>();
  for (const i of items) {
    if (i.section === 'waiting') waiting.push(i);
    else if (isDue(i, today)) due.push(i);
    else if (isStarred(i)) priority.push(i);
    else { const a = areaOf(i); byArea.set(a, [...(byArea.get(a) ?? []), i]); }
  }
  const when = (i: NowItem) => i.due_date || i.scheduled || '9999';
  due.sort((a, b) => when(a).localeCompare(when(b)) || b.weight - a.weight);
  return { due, priority, waiting, areas: AREAS.map(area => ({ area, items: byArea.get(area.id) ?? [] })).filter(g => g.items.length > 0) };
}

/** Titles may mark the key person or place as **bold**; split into plain and bold runs. */
export function titleRuns(title: string): Array<{ text: string; bold: boolean }> {
  return title.split(/(\*\*[^*]+\*\*)/).filter(Boolean)
    .map(p => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? { text: p.slice(2, -2), bold: true } : { text: p, bold: false }));
}
export const plainTitle = (title: string) => title.replace(/\*\*/g, '');

/** Search in To do: the title, the number, the payee, the domain, the topics. */
export function matches(item: NowItem, q: string): boolean {
  const s = q.trim().toLowerCase().replace(/^#/, '');
  if (!s) return true;
  if (/^\d+$/.test(s)) return String(item.n ?? '') === s;
  return [plainTitle(item.title), item.payee, item.domain, item.consequence, ...(item.topics ?? [])]
    .some(f => f && f.toLowerCase().includes(s));
}
