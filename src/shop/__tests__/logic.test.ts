import { describe, expect, it } from 'vitest';
import { DEFAULT_STORES as S, applyLocal, atStore, newItemId, parseQuickAdd, suggest, tagOf, type Item } from '../logic';

describe('shopping logic', () => {
  it('tags like the server', () => {
    expect(tagOf('Grand Frais')).toBe('grand-frais');
    expect(tagOf('La Panière')).toBe('la-paniere');
  });

  it('items show at their shop, related shops, and untagged ones everywhere', () => {
    expect(atStore({ tags: [] }, 'lidl', S)).toBe(true);
    expect(atStore({ tags: ['bio'] }, 'lidl', S)).toBe(true);
    expect(atStore({ tags: ['carrefour'] }, 'lidl', S)).toBe(false);
    expect(atStore({ tags: ['carrefour'] }, 'carrefour-market', S)).toBe(true);
    expect(atStore({ tags: ['lidl'] }, null, S)).toBe(true);
  });

  it('quick add: quantity, shop and "just me"', () => {
    expect(parseQuickAdd('Oat milk x2 @lidl !me', S)).toEqual({ title: 'Oat milk', qty: '2', tags: ['lidl'], private: true });
    expect(parseQuickAdd('3x yoghurt @grandfrais', S)).toEqual({ title: 'yoghurt', qty: '3', tags: ['grand-frais'], private: false });
    expect(parseQuickAdd('Sare pentru mașina de spălat vase', S).title).toBe('Sare pentru mașina de spălat vase');
    expect(parseQuickAdd('Box x 2', S).qty).toBeUndefined();   // only "x2" / "2x" count
  });

  it('ids match the server format', () => {
    expect(newItemId(new Date('2026-10-22T10:00:00Z'))).toMatch(/^shp-2026-10-22-[0-9a-f]{6}$/);
  });

  it('applies add, tick, untick, drop and edit like the server', () => {
    const id = 'shp-2026-10-22-aaaaaa';
    let items: Item[] = applyLocal([], { op: 'add', id, title: ' Salt ', tags: ['Carrefour'] }, 'lucian', '2026-10-22T10:00:00Z');
    expect(items[0]).toMatchObject({ title: 'Salt', tags: ['carrefour'], scope: 'shared', status: 'open' });
    expect(applyLocal(items, { op: 'add', id, title: 'again' }, 'lucian')).toHaveLength(1);
    items = applyLocal(items, { op: 'tick', id, store: 'carrefour' }, 'lucian', '2026-10-22T11:00:00Z');
    expect(items[0]).toMatchObject({ status: 'bought', bought_on: '2026-10-22', bought_at: 'carrefour' });
    expect(applyLocal(items, { op: 'tick', id }, 'ludmila', '2026-10-23T11:00:00Z')[0].bought_on).toBe('2026-10-22');
    items = applyLocal(items, { op: 'untick', id }, 'lucian');
    expect(items[0].status).toBe('open');
    items = applyLocal(items, { op: 'edit', id, qty: '2', tags: ['lidl'] }, 'lucian');
    expect(items[0]).toMatchObject({ qty: '2', tags: ['lidl'] });
    expect(applyLocal(items, { op: 'drop', id }, 'lucian')[0].status).toBe('cancelled');
  });

  it('a return is ticked as returned', () => {
    const items = applyLocal([], { op: 'add', id: 'shp-2026-10-22-bbbbbb', title: 'Kettle', kind: 'return', due_date: '2026-11-02' }, 'lucian');
    expect(applyLocal(items, { op: 'tick', id: items[0].id }, 'lucian')[0].status).toBe('returned');
  });

  it('suggests titles bought before, starts-with first, skipping what is already open', () => {
    const known = [{ title: 'Kefir', tags: [], n: 3 }, { title: 'Oat milk', tags: [], n: 9 }, { title: 'Milk', tags: [], n: 1 }];
    const open: Item[] = [{ id: 'x', kind: 'buy', title: 'Oat milk', tags: [], status: 'open', scope: 'shared' }];
    expect(suggest('mil', known, open).map(k => k.title)).toEqual(['Milk']);
    expect(suggest('k', known, [])).toEqual([]);
  });
});
