/** Today v2's rules, pure so they are tested: the words for when, and the place of each tile. */
import { formatDay, type NowItem } from './api';

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** One meta line: when, as words. Late is ink with a flag. */
export function whenOf(item: NowItem, today: string): { text: string; tone: 'late' | 'today' | 'plain' } | null {
  const due = item.due_date || item.scheduled?.slice(0, 10);
  if (item.status === 'waiting') return { text: 'waiting', tone: 'plain' };
  if (!due) return null;
  const d = daysBetween(today, due);
  if (d < 0) return { text: d === -1 ? '1 day late' : `${-d} days late`, tone: 'late' };
  if (d === 0) return { text: 'today', tone: 'today' };
  if (d === 1) return { text: 'tomorrow', tone: 'plain' };
  return { text: formatDay(due), tone: 'plain' };
}

/** Rough height, for placing tiles by index: stable, so a tile never jumps once it is drawn. */
const weightOf = (i: NowItem) => 84 + ((i.glance_title ?? i.title).length > 16 ? 19 : 0);

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

