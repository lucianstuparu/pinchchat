import { describe, expect, it } from 'vitest';
import { groupOf } from '../groups';

// The same cases as the server's test (shop.test.mjs "groups"): the two word lists must agree.
describe('groupOf', () => {
  const g = (title: string, tags: string[] = []) => groupOf({ title, tags });
  it('takes the given group, else the name, else the shop, else groceries', () => {
    expect(g('Ouă')).toBe('groceries');
    expect(g('Dovlecei', ['ikea'])).toBe('house');
    expect(g('Bec pentru lampă', ['ikea'])).toBe('house');
    expect(g('Baterii LR44 (pastilă)')).toBe('tech');
    expect(g('Foi pentru aparatul foto al Carlei', ['carrefour'])).toBe('tech');
    expect(g('Distribuitor robinet grădină, 4 căi (GEKA)', ['hornbach'])).toBe('garden');
    expect(g('Radiateur soufflant Eurom', ['hornbach'])).toBe('house');
    expect(g('Pâté de campagne')).toBe('groceries');
    expect(g('Scutece')).toBe('house');
    expect(groupOf({ title: 'Ouă', tags: [], group: 'other' })).toBe('other');
  });
});
