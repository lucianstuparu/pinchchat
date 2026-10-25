import { describe, expect, it } from 'vitest';
import { BOX, byRank, moveFor, opsFor, reorder } from '../dragRules';

const T = '2026-10-25';
type I = { id: string; focus?: string; rank?: number };
const ids = (z: Record<string, string[]>) => (zone: string) => z[zone] ?? [];

describe('dragging rows', () => {
  it('places an id before another, or at the end', () => {
    expect(reorder(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(reorder(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']);
    expect(reorder(['a', 'b'], 'x', 'b')).toEqual(['a', 'x', 'b']);
  });

  it('sorts ranked items first and keeps the others in their order', () => {
    const l: I[] = [{ id: 'a' }, { id: 'b', rank: 20 }, { id: 'c' }, { id: 'd', rank: 10 }];
    expect([...l].sort(byRank).map(x => x.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('into the box: focus on, placed where dropped; out: off only when put there by hand', () => {
    const plain: I = { id: 'p' }, pinned: I = { id: 'f', focus: T }, dated: I = { id: 'd' };
    const z = ids({ [BOX]: ['d', 'f'], week: ['p', 'q'] });
    expect(moveFor(plain, 'week', { zone: BOX, before: 'f' }, z)).toEqual({ item: plain, focus: true, order: ['d', 'p', 'f'] });
    expect(moveFor(pinned, BOX, { zone: 'week', before: null }, z)).toEqual({ item: pinned, focus: false });
    expect(moveFor(pinned, BOX, null, z)).toEqual({ item: pinned, focus: false });
    expect(moveFor(dated, BOX, { zone: 'week', before: null }, z)).toBeNull();
    expect(moveFor(plain, 'week', { zone: 'later', before: null }, z)).toBeNull();
    expect(moveFor(plain, 'week', { zone: 'week', before: 'q' }, z)).toBeNull();   // same place
    expect(moveFor(plain, 'week', { zone: 'week', before: null }, z)).toEqual({ item: plain, order: ['q', 'p'] });
  });

  it('turns a move into actions, their undo, and the local change', () => {
    const items: I[] = [{ id: 'a', rank: 10 }, { id: 'b' }, { id: 'c', focus: T }];
    const { ops, undo, patch } = opsFor({ item: items[1], focus: true, order: ['b', 'a'] }, items, T);
    expect(ops).toEqual([
      { id: 'b', action: 'focus', extra: {} },
      { id: 'b', action: 'order', extra: { rank: 10 } },
      { id: 'a', action: 'order', extra: { rank: 20 } },
    ]);
    expect(undo).toEqual([
      { id: 'b', action: 'focus', extra: { on: false } },
      { id: 'b', action: 'order', extra: { rank: null } },
      { id: 'a', action: 'order', extra: { rank: 10 } },
    ]);
    expect(patch(items)).toEqual([{ id: 'a', rank: 20 }, { id: 'b', focus: T, rank: 10 }, { id: 'c', focus: T }]);
  });
});
