import { describe, expect, it } from 'vitest';
import { columnsFor, whenOf, changedBy, pileOf, whatChanged } from '../todayRules';
import type { NowItem } from '../api';

const item = (o: Partial<NowItem>): NowItem => ({ id: 'x', title: 't', kind: 'task', store: 'tasks', scope: 'shared', status: 'todo', priority: 'P3', weight: 1, section: 'later', ...o });

describe('the review of 2026-11-05', () => {
  const T = '2026-11-05';
  const base = { id: 'a', title: 'x', kind: 'task', store: 'tasks', scope: 'private', status: 'todo' } as unknown as NowItem;
  it('late is a count', () => {
    expect(whenOf({ ...base, due_date: '2026-10-25' }, T)).toEqual({ text: '11d', tone: 'late' });
  });
  it('waiting says who and since when', () => {
    expect(whenOf({ ...base, status: 'waiting', face: { name: 'Bérenger' }, waiting_since: '2026-10-30' }, T)?.text).toBe('Bérenger · 6d');
    expect(whenOf({ ...base, status: 'waiting', updated_at: '2026-11-05T08:00:00Z' }, T)?.text).toBe('waiting · today');
  });
  it('someone late with what we wait for carries the flag', () => {
    expect(whenOf({ ...base, status: 'waiting', waits_for: 'Crédit Mutuel', due_date: '2026-10-30' }, T)).toEqual({ text: 'Crédit Mutuel · 6d', tone: 'late' });
  });
  it('a card is for a change near the message, in words of its own', () => {
    const ts = Date.parse('2026-11-05T10:00:00Z');
    expect(changedBy({ updated_at: '2026-11-05T09:59:50Z' }, ts)).toBe(true);
    expect(changedBy({ updated_at: '2026-11-01T09:00:00Z' }, ts)).toBe(false);
    expect(changedBy(undefined, ts)).toBe(false);
    expect(whatChanged({ status: 'done' }, ts, T)).toBe('Done');
    expect(whatChanged({ status: 'cancelled' }, ts, T)).toBe('Not needed');
    expect(whatChanged({ status: 'todo', created: '2026-11-05T09:59:50Z', due_date: T }, ts, T)).toBe('Added · today');
    expect(whatChanged({ status: 'todo', created: '2026-01-01T09:00:00Z' }, ts, T)).toBe('Changed');
  });
  it('the pile groups by matter, largest first, single things under Other', () => {
    const a = { ...base, id: 'a', domain: 'casa-artlia' }, b = { ...base, id: 'b', domain: 'casa-artlia' };
    const c = { ...base, id: 'c', topics: ['house'] }, d = { ...base, id: 'd', face: { logo: 'x.png', name: 'SFR' } }, e = { ...base, id: 'e', face: { logo: 'x.png', name: 'SFR' } };
    expect(pileOf([c, a, d, b, e]).map(g => [g.matter, g.items.length])).toEqual([['Casa Artlia', 2], ['SFR', 2], ['Other', 1]]);
  });
});

describe('whenOf', () => {
  it('says late as a count, never as a red date', () => {
    expect(whenOf(item({ due_date: '2026-11-03' }), '2026-11-05')).toEqual({ text: '2d', tone: 'late' });
    expect(whenOf(item({ due_date: '2026-11-04' }), '2026-11-05')?.text).toBe('1d');
  });
  it('today, tomorrow, waiting, no date', () => {
    expect(whenOf(item({ due_date: '2026-11-05' }), '2026-11-05')?.tone).toBe('today');
    expect(whenOf(item({ due_date: '2026-11-06' }), '2026-11-05')?.text).toBe('tomorrow');
    expect(whenOf(item({ status: 'waiting' }), '2026-11-05')?.text).toBe('waiting · today');
    expect(whenOf(item({}), '2026-11-05')).toBeNull();
  });
});

describe('columnsFor', () => {
  it('keeps every tile once, in order within a column', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map(id => item({ id, glance_title: id }));
    const cols = columnsFor(items, 2);
    expect(cols.flat().map(i => i.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(cols[0].map(i => i.id)).toEqual(['a', 'c', 'e']);
  });
  it('a long title sends the next tile to the shorter column', () => {
    const cols = columnsFor([item({ id: 'long', glance_title: 'a title longer than sixteen' }), item({ id: 'b', glance_title: 'b' }), item({ id: 'c', glance_title: 'c' })], 2);
    expect(cols[1].map(i => i.id)).toEqual(['b', 'c']);
  });
});
