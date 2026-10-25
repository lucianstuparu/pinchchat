/** What a drag on a list changes (dragOrder.tsx does the dragging): the box, the order, and their undo. */
import type { CSSProperties } from 'react';

/** The highlighted box's zone name. */
export const BOX = 'box';
export const DROP_OUTLINE: CSSProperties = { outline: '2.5px dashed #d48a12', outlineOffset: 3 };
/** Where a lifted row would land: a section, before a row (null = at its end). */
export interface Over { zone: string; before: string | null }

// ---- from a drop to changes
export interface Orderable { id: string; focus?: string; rank?: number }
/** What a drop changes: the box (focus on / off) and the new order of one section (ids, top first). */
export interface Move<T extends Orderable> { item: T; focus?: boolean; order?: string[] }
export interface Op { id: string; action: 'focus' | 'order'; extra: Record<string, unknown> }

/** The section's ids with `id` placed before `before` (null = at the end). */
export function reorder(ids: string[], id: string, before: string | null): string[] {
  const rest = ids.filter(x => x !== id);
  const i = before ? rest.indexOf(before) : -1;
  if (i < 0) rest.push(id); else rest.splice(i, 0, id);
  return rest;
}

/** Ranked items first, in rank order; the others keep the order they came in (a stable sort). */
export function byRank(a: Orderable, b: Orderable): number {
  const ra = a.rank ?? Number.POSITIVE_INFINITY, rb = b.rank ?? Number.POSITIVE_INFINITY;
  return ra === rb ? 0 : ra < rb ? -1 : 1;
}

/** The server actions for a move, the actions that undo it, and the same change applied to a local list. */
export function opsFor<T extends Orderable>(m: Move<T>, items: T[], today: string): { ops: Op[]; undo: Op[]; patch: (list: T[]) => T[] } {
  const ops: Op[] = [], undo: Op[] = [];
  const next = new Map<string, Partial<Orderable>>();
  if (m.focus !== undefined && m.focus !== !!m.item.focus) {
    ops.push({ id: m.item.id, action: 'focus', extra: m.focus ? {} : { on: false } });
    undo.push({ id: m.item.id, action: 'focus', extra: m.focus ? { on: false } : {} });
    next.set(m.item.id, { focus: m.focus ? today : undefined });
  }
  (m.order ?? []).forEach((id, i) => {
    const rank = (i + 1) * 10;
    const was = items.find(x => x.id === id)?.rank;
    if (was === rank) return;
    ops.push({ id, action: 'order', extra: { rank } });
    undo.push({ id, action: 'order', extra: { rank: was ?? null } });
    next.set(id, { ...next.get(id), rank });
  });
  const patch = (list: T[]) => list.map(x => (next.has(x.id) ? { ...x, ...next.get(x.id) } : x));
  return { ops, undo, patch };
}

/**
 * A drop on a list with a highlighted box: into the box puts the row there (and in that place); out of it takes
 * a row put there by hand out again (a dated one stays: its date keeps it there); within one section, the new
 * order. Moving between two plain sections changes nothing: they follow dates and stars.
 */
export function moveFor<T extends Orderable>(item: T, from: string, over: Over | null, idsOf: (zone: string) => string[]): Move<T> | null {
  if (!over) return from === BOX && item.focus ? { item, focus: false } : null;
  if (over.zone === BOX && from !== BOX) return { item, focus: true, order: reorder(idsOf(BOX), item.id, over.before) };
  if (from === BOX && over.zone !== BOX) return item.focus ? { item, focus: false } : null;
  if (over.zone === from) {
    const order = reorder(idsOf(from), item.id, over.before);
    return order.join() === idsOf(from).join() ? null : { item, order };
  }
  return null;
}
