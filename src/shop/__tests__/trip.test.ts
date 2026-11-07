import { describe, expect, it } from 'vitest';
import { DEFAULT_STORES as S, type Item } from '../logic';
import { atStore, neverTag } from '../logic';
import { askBatches, countOf, extrasAsk, photosOf, shopTagOf, shotsAsk, tripLists, withoutPhoto, withPhoto } from '../trip';

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

describe('never at this shop', () => {
  const never = neverTag('carrefour');
  it('leaves both lists of that shop, and only that shop', () => {
    const items = [item('a', 'Lapte', ['carrefour-market', never]), item('b', 'Pâine', [never]), item('c', 'Unt')];
    const { here, maybe } = tripLists(items, 'carrefour', S);
    expect(here).toEqual([]);
    expect(maybe.map(m => m.item.id)).toEqual(['c']);
    expect(tripLists(items, 'lidl', S).maybe.map(m => m.item.id)).toContain('b');
  });

  it('holds for the same thing when it is back on the list later', () => {
    const items = [item('old', 'Kéfir', ['lidl', never], { status: 'bought' }), item('new', 'Kefir', ['lidl']), item('p', 'Other name', ['lidl'], { product: 'prd-1' }), item('q', 'Old name', [never], { status: 'cancelled', product: 'prd-1' })];
    expect(tripLists(items, 'carrefour', S).maybe).toEqual([]);
  });

  it('hides it from that shop on the main list too', () => {
    expect(atStore({ tags: [never] }, 'carrefour', S)).toBe(false);
    expect(atStore({ tags: [never] }, 'lidl', S)).toBe(true);
    expect(atStore({ tags: [never] }, null, S)).toBe(true);
  });
});

describe('several photos of one product', () => {
  const p = (ref: string) => ({ ref, thumb: `t-${ref}` });
  it('adds and removes photos, the next becoming the first', () => {
    const two = withPhoto(p('a'), p('b'));
    expect(photosOf(two).map(x => x.ref)).toEqual(['a', 'b']);
    const left = withoutPhoto(two, 'a')!;
    expect([left.ref, left.thumb, left.also]).toEqual(['b', 't-b', []]);
    expect(withoutPhoto(left, 'b')).toBeNull();
  });

  it('a trip saved before this change still reads', () => {
    expect(photosOf(p('a')).map(x => x.ref)).toEqual(['a']);
  });

  it('never splits a product between two asks, at most 6 photos in each', () => {
    const three = withPhoto(withPhoto(p('a'), p('a2')), p('a3'));
    const batches = askBatches([three, withPhoto(p('b'), p('b2')), three, p('c'), p('d')]);
    expect(batches.map(b => b.reduce((n, x) => n + photosOf(x).length, 0))).toEqual([5, 5]);
    expect(batches.map(b => b.length)).toEqual([2, 3]);
  });

  it('tells the assistant which photos are one product', () => {
    expect(extrasAsk('Carrefour', [2, 1])).toContain('2 products in the photos: product 1 = photos 1-2; product 2 = photo 3.');
    expect(extrasAsk('Carrefour', [1])).toContain('1 product in the photos: product 1 = photo 1.');
    expect(shotsAsk('Lidl', [{ id: 'shp-1', title: 'Kefir', count: 2 }, { id: 'shp-2', title: 'Unt', count: 1 }])).toContain('Kefir (shp-1) = photos 1-2; Unt (shp-2) = photo 3.');
  });
});

describe('countOf', () => {
  it('reads the number at the start of a quantity', () => {
    expect(countOf('2')).toBe(2);
    expect(countOf('x20')).toBe(20);
    expect(countOf('3 kg')).toBe(3);
    expect(countOf('some')).toBeUndefined();
    expect(countOf(undefined)).toBeUndefined();
  });
});
