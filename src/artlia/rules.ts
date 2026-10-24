/**
 * What the Casa Artlia screens show, as pure functions (tested): Acum (what needs attention now),
 * Plan (the road to opening, by milestone), Categorii (counts and progress), the words for kinds,
 * phases and states, glossary terms in texts, and who wrote a chat message.
 */
import type { ArtItem, Category, Phase } from './api';

export const isOpen = (i: ArtItem) => i.status !== 'done' && i.status !== 'cancelled';

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Put off until a later day (and not overdue): out of the way until then. */
export const isPutOff = (i: ArtItem, today: string) => !!i.snoozed_until && i.snoozed_until > today && !(i.due_date && i.due_date <= today);

// ---- words (Romanian; French terms stay as they are)
export const KIND_LABEL: Record<string, string> = { task: 'De făcut', check: 'De verificat', decision: 'De decis', milestone: 'Etapă' };
export const STATUS_LABEL: Record<string, string> = { todo: 'De făcut', check: 'De verificat', waiting: 'În așteptare', done: 'Făcut', cancelled: 'Nu mai e nevoie' };
export const PHASE_LABEL: Record<Phase, string> = { lucrari: 'În timpul lucrărilor', deschidere: 'Înainte de deschidere', dupa: 'După deschidere' };
export const NEED_LABEL: Record<string, string> = { must: 'Obligatoriu', firm: 'Promis în dosar', adj: 'Se poate ajusta', other: 'De verificat cu regulile' };

// ---- category colours: one per category, by its order, readable in light and dark
const PALETTE = [
  { rail: '#d0453e', bg: '#fbe4e2', ink: '#9b2a24', inkDark: '#f6a19b' },
  { rail: '#378add', bg: '#e6f1fb', ink: '#0c447c', inkDark: '#8cc0f5' },
  { rail: '#1d9e75', bg: '#e1f5ee', ink: '#0f6e56', inkDark: '#5fd3a9' },
  { rail: '#ba7517', bg: '#faeeda', ink: '#854f0b', inkDark: '#e9b467' },
  { rail: '#7c5cd6', bg: '#efeafd', ink: '#5b3fb5', inkDark: '#b9a6f5' },
  { rail: '#0e9488', bg: '#ddf3f1', ink: '#0b6a62', inkDark: '#5fd3c6' },
  { rail: '#c2477f', bg: '#fbe6ef', ink: '#8e2a59', inkDark: '#f39cc3' },
  { rail: '#8a9a2b', bg: '#eef0d9', ink: '#4d5a12', inkDark: '#c3d36a' },
  { rail: '#5b6b85', bg: '#e9edf3', ink: '#384457', inkDark: '#aab8cf' },
  { rail: '#c48a00', bg: '#fbf1d0', ink: '#7a5a00', inkDark: '#f0c94a' },
  { rail: '#3f7fbf', bg: '#e3eef9', ink: '#24527f', inkDark: '#93bfeb' },
];
export type Tone = (typeof PALETTE)[number];
export function toneOf(cat: string, cats: Category[]): Tone {
  const i = cats.findIndex(c => c.id === cat);
  return PALETTE[(i < 0 ? cats.length : i) % PALETTE.length];
}
export const toneStyle = (t: Tone, mode: string) => (mode === 'dark' ? { background: `${t.rail}33`, color: t.inkDark } : { background: t.bg, color: t.ink });

// ---- Acum: what needs attention, each item once
export interface NowGroups { overdue: ArtItem[]; week: ArtItem[]; soon: ArtItem[]; check: ArtItem[]; priority: ArtItem[]; putOff: number }

const byDue = (a: ArtItem, b: ArtItem) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || (a.n ?? 0) - (b.n ?? 0);

export function groupNow(items: ArtItem[], today: string): NowGroups {
  const g: NowGroups = { overdue: [], week: [], soon: [], check: [], priority: [], putOff: 0 };
  for (const i of items) {
    if (!isOpen(i)) continue;
    if (isPutOff(i, today)) { g.putOff++; continue; }
    const d = i.due_date ? daysBetween(today, i.due_date) : null;
    if (d !== null && d < 0) g.overdue.push(i);
    else if (d !== null && d <= 7) g.week.push(i);
    else if (d !== null && d <= 28) g.soon.push(i);
    else if (i.status === 'check' && i.kind !== 'milestone') g.check.push(i);
    else if (i.priority === 'P1' && i.kind !== 'milestone') g.priority.push(i);
  }
  for (const k of ['overdue', 'week', 'soon', 'check', 'priority'] as const) g[k].sort(byDue);
  return g;
}

/** The pinned card: the most pressing thing, and how much else waits. */
export function topOf(items: ArtItem[], today: string): { top: ArtItem | null; overdue: number; week: number } {
  const g = groupNow(items, today);
  const top = g.overdue[0] ?? g.week[0] ?? g.priority[0] ?? g.soon[0] ?? g.check[0] ?? null;
  return { top, overdue: g.overdue.length, week: g.week.length };
}

// ---- Plan: the road to opening, one section per milestone
export interface PlanSection { milestone: ArtItem | null; label: string; items: ArtItem[]; past: boolean }

export function plan(items: ArtItem[], today: string): PlanSection[] {
  const milestones = items.filter(i => i.kind === 'milestone' && i.status !== 'cancelled').sort(byDue);
  const sections: PlanSection[] = milestones.map(m => ({ milestone: m, label: m.title, items: [], past: m.status === 'done' || (!!m.due_date && m.due_date < today && !isOpen(m)) }));
  const after: PlanSection = { milestone: null, label: 'După deschidere', items: [], past: false };
  const undated: PlanSection = { milestone: null, label: 'Fără dată', items: [], past: false };
  for (const i of items) {
    if (i.kind === 'milestone' || !isOpen(i)) continue;
    let home: PlanSection | undefined;
    if (i.due_date) home = sections.find(s => s.milestone?.due_date && s.milestone.due_date >= i.due_date!);
    else if (i.phase) home = sections.find(s => s.milestone?.phase === i.phase);
    if (!home && (i.phase === 'dupa' || i.due_date)) home = after;
    (home ?? undated).items.push(i);
  }
  for (const s of [...sections, after, undated]) s.items.sort(byDue);
  return [...sections, ...(after.items.length ? [after] : []), ...(undated.items.length ? [undated] : [])];
}

// ---- Categorii: counts and progress
export interface CatStat { cat: Category; open: number; overdue: number; done: number; total: number }
export function catStats(items: ArtItem[], cats: Category[], today: string): CatStat[] {
  return cats.map(cat => {
    const mine = items.filter(i => i.cat === cat.id && i.kind !== 'milestone' && i.status !== 'cancelled');
    const open = mine.filter(isOpen);
    return {
      cat, open: open.length, total: mine.length, done: mine.length - open.length,
      overdue: open.filter(i => i.due_date && i.due_date < today).length,
    };
  });
}

export const GROUP_LABEL: Record<string, string> = {
  first: 'De făcut întâi', proc: 'Procedură și acte', acc: 'Accesibilitate', fire: 'Securitate la incendiu', ops: 'Funcționarea locului', other: 'Alte reguli de verificat',
};

/** A category's open items in sections: by the checklist's own groups when the items have them, else by phase. */
export function sectionsOf(items: ArtItem[]): Array<{ key: string; label: string; items: ArtItem[] }> {
  if (items.some(i => i.group && GROUP_LABEL[i.group])) {
    return [...Object.keys(GROUP_LABEL), null]
      .map(g => ({ key: g ?? 'none', label: g ? GROUP_LABEL[g] : 'Altele', items: items.filter(i => (i.group && GROUP_LABEL[i.group] ? i.group : null) === g).sort(byDue) }))
      .filter(s => s.items.length > 0);
  }
  return byPhase(items).map(g => ({ key: g.phase ?? 'none', label: g.label, items: g.items }));
}

/** A category's open items by phase, in screen order; items with no phase last. */
export function byPhase(items: ArtItem[]): Array<{ phase: Phase | null; label: string; items: ArtItem[] }> {
  const order: Array<Phase | null> = ['lucrari', 'deschidere', 'dupa', null];
  return order
    .map(p => ({ phase: p, label: p ? PHASE_LABEL[p] : 'Altele', items: items.filter(i => (i.phase ?? null) === p).sort(byDue) }))
    .filter(g => g.items.length > 0);
}

// ---- texts with glossary terms: "Ask whether a [[DP]] is needed"
export function termRuns(text: string): Array<{ text: string; term?: string }> {
  const out: Array<{ text: string; term?: string }> = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], term: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
export const plainText = (text: string) => text.replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\*\*/g, '');

// ---- the shared chat: "[Ludmila] text" says who wrote it
export { senderOf } from '../mobile/messageView';
export const withSender = (name: string, text: string) => (name ? `[${name}] ${text}` : text);

export function matchesArt(i: ArtItem, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (/^\d+$/.test(s)) return i.n === Number(s);
  const fold = (x?: string) => (x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hay = fold([i.title, i.what, i.todo, i.notes, i.src].join(' '));
  return fold(s).split(/\s+/).every(w => hay.includes(w));
}
