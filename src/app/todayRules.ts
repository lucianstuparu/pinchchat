/** Today v2's rules, pure so they are tested: the words for when, and the place of each tile. */
import { formatDay, type NowItem } from './api';

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const nameOf = (i: NowItem) => i.waits_for || i.face?.name || (i.glance_title?.includes(' · ') ? i.glance_title.split(' · ')[0] : '');

/** One meta line. Late is a count beside a flag; waiting says who and since when ("Bérenger · 6d"). */
export function whenOf(item: NowItem, today: string): { text: string; tone: 'late' | 'today' | 'plain' } | null {
  const due = item.due_date || item.scheduled?.slice(0, 10);
  if (item.status === 'waiting') {
    const expected = item.waits_for && item.due_date ? -daysBetween(today, item.due_date) : 0;
    const since = expected > 0 ? expected : Math.max(0, -daysBetween(today, (item.waiting_since || item.updated_at || today).slice(0, 10)));
    return { text: `${nameOf(item) || 'waiting'} · ${since ? `${since}d` : 'today'}`, tone: expected > 0 ? 'late' : 'plain' };
  }
  if (!due) return null;
  const d = daysBetween(today, due);
  if (d < 0) return { text: `${-d}d`, tone: 'late' };
  if (d === 0) return { text: 'today', tone: 'today' };
  if (d === 1) return { text: 'tomorrow', tone: 'plain' };
  return { text: formatDay(due), tone: 'plain' };
}

// ---- The change card (ChangeCards.tsx): whether a message changed an item, and one line of what changed.
const CLOSED_STATES = ['done', 'paid', 'closed', 'bought', 'returned', 'used', 'cancelled', 'passed'];
const NEAR = 5 * 60_000;
export type ItemState = Partial<NowItem> & { created?: string };
export const isClosedState = (s?: string) => CLOSED_STATES.includes(s ?? '');

/** Did this message change the item? Its last change is within minutes of the message. */
export function changedBy(s: ItemState | undefined, ts: number): boolean {
  const at = Date.parse(s?.updated_at ?? '');
  return !Number.isNaN(at) && at > ts - NEAR && at < ts + 60_000;
}

/** One line of what changed, from the item itself; never the person's words back. */
export function whatChanged(s: ItemState, ts: number, today: string): string {
  if (s.status === 'cancelled') return 'Not needed';
  if (isClosedState(s.status)) return 'Done';
  const created = Date.parse(s.created ?? '');
  const verb = !Number.isNaN(created) && created > ts - NEAR ? 'Added' : 'Changed';
  return s.due_date ? `${verb} · ${s.due_date === today ? 'today' : formatDay(s.due_date)}` : verb;
}

/** Rough height, for placing tiles by index: stable, so a tile never jumps once it is drawn. */
const weightOf = (i: NowItem) => 84 + ((i.glance_title ?? i.title).length > 16 ? 19 : 0);

/** Which matter a thing in the pile belongs to (assumed, to confirm, until matters exist): the project, the company with a logo, its topic, or its name. */
export function matterOf(i: NowItem): string {
  if (i.domain === 'casa-artlia') return 'Casa Artlia';
  if (i.face?.logo && i.face.name) return i.face.name;
  return i.topics?.[0] || i.payee || i.face?.name || 'Other';
}

/** The pile by matter: the largest first; matters of one thing gather under Other. */
export function pileOf(items: NowItem[]): Array<{ matter: string; items: NowItem[] }> {
  const by = new Map<string, NowItem[]>();
  for (const it of items) { const m = matterOf(it); by.set(m, [...(by.get(m) ?? []), it]); }
  const other: NowItem[] = by.get('Other') ?? [];
  const groups: Array<{ matter: string; items: NowItem[] }> = [];
  for (const [matter, list] of by) {
    if (matter === 'Other') continue;
    if (list.length === 1) other.push(list[0]); else groups.push({ matter, items: list });
  }
  groups.sort((a, b) => b.items.length - a.items.length || a.matter.localeCompare(b.matter));
  return other.length ? [...groups, { matter: 'Other', items: other }] : groups;
}

export function columnsFor(items: NowItem[], n: number): NowItem[][] {
  const cols: NowItem[][] = Array.from({ length: n }, () => []);
  const h = new Array<number>(n).fill(0);
  for (const it of items) {
    const c = h.indexOf(Math.min(...h));
    cols[c].push(it);
    h[c] += weightOf(it);
  }
  return cols;
}

