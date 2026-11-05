import { describe, expect, it } from 'vitest';
import { columnsFor, whenOf } from '../todayRules';
import type { NowItem } from '../api';

const item = (o: Partial<NowItem>): NowItem => ({ id: 'x', title: 't', kind: 'task', store: 'tasks', scope: 'shared', status: 'todo', priority: 'P3', weight: 1, section: 'later', ...o });

describe('whenOf', () => {
  it('says late in words, never as a red date', () => {
    expect(whenOf(item({ due_date: '2026-11-03' }), '2026-11-05')).toEqual({ text: '2 days late', tone: 'late' });
    expect(whenOf(item({ due_date: '2026-11-04' }), '2026-11-05')?.text).toBe('1 day late');
  });
  it('today, tomorrow, waiting, no date', () => {
    expect(whenOf(item({ due_date: '2026-11-05' }), '2026-11-05')?.tone).toBe('today');
    expect(whenOf(item({ due_date: '2026-11-06' }), '2026-11-05')?.text).toBe('tomorrow');
    expect(whenOf(item({ status: 'waiting' }), '2026-11-05')?.text).toBe('waiting');
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
