import { describe, expect, it } from 'vitest';
import { DEFAULT_STORES as S, type Item } from '../logic';
import { shopTagOf, tripLists } from '../trip';

const item = (id: string, title: string, tags: string[] = [], more: Partial<Item> = {}): Item =>
  ({ id, kind: 'buy', title, tags, status: 'open', scope: 'shared', ...more });

describe('a trip to a shop', () => {
  it('receipt shop names become tags, longest first', () => {
    expect(shopTagOf('Carrefour Market Lyon', S)).toBe('carrefour-market');
    expect(shopTagOf('CARREFOUR', S)).toBe('carrefour');
    expect(shopTagOf('Aldi', S)).toBeNull();
  });

  it('splits the list: meant for this shop, and maybe here too', () => {
    const items = [
      item('a', 'Lapte', ['carrefour']),
      item('b', 'Iaurt', ['carrefour-market']),
      item('c', 'Pâine'),
      item('d', 'Kefir', ['lidl']),
      item('e', 'Bec LED', ['lidl']),
      item('f', 'Return jacket', ['lidl'], { kind: 'return' }),
      item('g', 'Lampă', ['wishlist']),
      item('h', 'Ouă', ['grand-frais']),
      item('x', 'Ouă', ['carrefour'], { status: 'bought', bought_at: 'carrefour' }),
    ];
    const { here, maybe } = tripLists(items, 'carrefour', S);
    expect(here.map(i => i.id)).toEqual(['a', 'b']);
    // Eggs were bought here, bread is for any shop, kefir is groceries (what Carrefour sold us);
    // the bulb (house) was never bought here, returns and the wishlist never show.
    expect(maybe.map(m => [m.item.id, m.why, m.shops])).toEqual([['h', 'bought here before', undefined], ['c', 'any shop', undefined], ['d', '', ['lidl']]]);
  });

  it('a shop with no history counts as a supermarket, unless known for one kind', () => {
    const items = [item('k', 'Kefir', ['lidl']), item('b', 'Bec LED', ['lidl']), item('s', 'Seminte busuioc', ['lidl'])];
    expect(tripLists(items, 'leclerc', S).maybe.map(m => m.item.id)).toEqual(['k', 'b']);
    const ikea = [...S, { tag: 'ikea', name: 'IKEA', also: [] }];
    expect(tripLists(items, 'ikea', ikea).maybe.map(m => m.item.id)).toEqual(['b']);
  });

  it('receipts count as bought here', () => {
    const items = [item('k', 'Kefir', ['lidl'], { product: 'prd-1' })];
    const purchases = [{ id: 'p1', title: 'KEFIR 1L', product: 'prd-1', store: 'Carrefour Ségny', date: '2026-10-01' }];
    expect(tripLists(items, 'carrefour', S, purchases).maybe[0].why).toBe('bought here before');
  });
});
