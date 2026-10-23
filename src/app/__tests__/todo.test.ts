import { describe, expect, it } from 'vitest';
import type { NowItem } from '../api';
import { areaOf, dueChip, groupTodo, matches, plainTitle, titleRuns } from '../todoRules';

const t = '2026-10-23';
const item = (o: Partial<NowItem>): NowItem => ({
  id: 'tsk-2026-10-01-000000', title: 'x', kind: 'task', store: 'tasks', scope: 'private', status: 'todo',
  priority: 'P3', weight: 1, section: 'later', ...o,
});

describe('dueChip', () => {
  it('says how late, today, tomorrow or the date', () => {
    expect(dueChip({ due_date: '2026-10-20' }, t)).toEqual({ kind: 'overdue', text: 'Overdue (3d)' });
    expect(dueChip({ due_date: t }, t)?.text).toBe('Today');
    expect(dueChip({ due_date: '2026-10-24' }, t)?.text).toBe('Tomorrow');
    expect(dueChip({ due_date: '2026-10-28' }, t)?.kind).toBe('soon');
    expect(dueChip({ due_date: '2026-12-01' }, t)?.kind).toBe('later');
    expect(dueChip({}, t)).toBeNull();
  });
});

describe('groupTodo', () => {
  it('puts each item in one place: due, then priority, then its area, waiting last', () => {
    const items = [
      item({ id: 'a', due_date: '2026-10-01', section: 'overdue', priority: 'P1' }),
      item({ id: 'b', priority: 'P1' }),
      item({ id: 'c', domain: 'home' }),
      item({ id: 'd', store: 'admin' }),
      item({ id: 'e', section: 'waiting', due_date: t }),
      item({ id: 'f', due_date: '2026-11-30' }),
    ];
    const g = groupTodo(items, t);
    expect(g.due.map(i => i.id)).toEqual(['a']);
    expect(g.priority.map(i => i.id)).toEqual(['b']);
    expect(g.waiting.map(i => i.id)).toEqual(['e']);
    expect(g.areas.map(a => [a.area.id, a.items.map(i => i.id)])).toEqual([['personal', ['f']], ['home', ['c']], ['admin', ['d']]]);
  });
});

describe('areas, titles and search', () => {
  it('maps stores and domains to areas', () => {
    expect(areaOf({ store: 'admin', domain: 'home' })).toBe('admin');
    expect(areaOf({ store: 'tasks', domain: 'casa-artlia' })).toBe('home');
    expect(areaOf({ store: 'tasks', domain: 'icrc' })).toBe('work');
    expect(areaOf({ store: 'tasks', domain: 'health' })).toBe('personal');
  });
  it('splits bold runs and strips them', () => {
    expect(titleRuns('Email **Fleur** re ERP')).toEqual([{ text: 'Email ', bold: false }, { text: 'Fleur', bold: true }, { text: ' re ERP', bold: false }]);
    expect(plainTitle('Email **Fleur**')).toBe('Email Fleur');
  });
  it('finds by number or words', () => {
    expect(matches(item({ n: 22, title: 'Email **Fleur**' }), '22')).toBe(true);
    expect(matches(item({ n: 22 }), '2')).toBe(false);
    expect(matches(item({ title: 'Email **Fleur**' }), 'fleur')).toBe(true);
    expect(matches(item({ topics: ['Health'] }), 'health')).toBe(true);
  });
});
