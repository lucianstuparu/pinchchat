import { describe, expect, it } from 'vitest';
import { markCopyables } from '../copyables';

describe('markCopyables', () => {
  it('marks emails, phones, IBANs and references', () => {
    expect(markCopyables('Write to service@sfr.fr or call 06 12 34 56 78.')).toBe('Write to `service@sfr.fr` or call `06 12 34 56 78`.');
    expect(markCopyables('IBAN FR76 3000 6000 0112 3456 7890 189 please')).toBe('IBAN `FR76 3000 6000 0112 3456 7890 189` please');
    expect(markCopyables('Order FR123456 and ref 7845-2219-03')).toBe('Order `FR123456` and ref `7845-2219-03`');
    expect(markCopyables('+33 6 12 34 56 78')).toBe('`+33 6 12 34 56 78`');
  });
  it('leaves code, links, dates, amounts and short numbers alone', () => {
    const s = 'Due 2026-11-05, 42,50 € for 3 items. `X123456` [bill](https://a.fr/123456) https://b.fr/987654';
    expect(markCopyables(s)).toBe(s);
    expect(markCopyables('COVID-19 at 14:30, 12345 steps')).toBe('COVID-19 at 14:30, 12345 steps');
  });
});
