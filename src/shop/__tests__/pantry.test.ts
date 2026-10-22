import { describe, expect, it } from 'vitest';
import { applyPantry, expiryLabel, groupOf, newPantryId, type PantryEntry } from '../pantry';

describe('pantry in the app', () => {
  const today = '2026-10-22';
  it('adds with a date or "in days", once per id', () => {
    let l: PantryEntry[] = applyPantry([], { op: 'pantry-add', id: 'pan-2026-10-22-aaaaaa', title: ' Kefir ', in_days: 14 }, 'lucian', '2026-10-22T09:00:00Z');
    expect(l[0]).toMatchObject({ title: 'Kefir', due_date: '2026-11-05', where: 'fridge', status: 'open' });
    l = applyPantry(l, { op: 'pantry-add', id: 'pan-2026-10-22-aaaaaa', title: 'again' }, 'lucian');
    expect(l).toHaveLength(1);
  });
  it('closes as used or wasted and reopens', () => {
    const l = applyPantry([], { op: 'pantry-add', id: 'pan-2026-10-22-bbbbbb', title: 'Chicken', expires: '2026-10-24' }, 'lucian', '2026-10-22T09:00:00Z');
    const w = applyPantry(l, { op: 'pantry-close', id: l[0].id, how: 'wasted' }, 'ludmila', '2026-10-25T09:00:00Z');
    expect(w[0]).toMatchObject({ status: 'wasted', closed_by: 'ludmila', closed_on: '2026-10-25' });
    expect(applyPantry(w, { op: 'pantry-reopen', id: l[0].id }, 'lucian')[0].status).toBe('open');
  });
  it('groups and labels by expiry', () => {
    const e = (due?: string, guessed?: boolean): PantryEntry => ({ id: 'x', title: 't', status: 'open', due_date: due, guessed });
    expect(groupOf(e('2026-10-20'), today)).toBe('expired');
    expect(groupOf(e('2026-10-29'), today)).toBe('week');
    expect(groupOf(e('2026-11-10'), today)).toBe('later');
    expect(groupOf(e(), today)).toBe('nodate');
    expect(expiryLabel(e('2026-10-22'), today)).toBe('Expires today');
    expect(expiryLabel(e('2026-10-20'), today)).toBe('Expired 2 days ago');
    expect(expiryLabel(e('2026-10-23', true), today)).toBe('~Tomorrow');
  });
  it('ids match the server', () => {
    expect(newPantryId(new Date('2026-10-22T10:00:00Z'))).toMatch(/^pan-2026-10-22-[0-9a-f]{6}$/);
  });
});
