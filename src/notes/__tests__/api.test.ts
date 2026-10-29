import { describe, expect, it } from 'vitest';
import { splitLink } from '../api';

describe('splitLink', () => {
  it('takes the first web address out of shared text', () => {
    expect(splitLink('Bespoak, a carpenter https://www.facebook.com/share/p/abc123/ (Gexpats).')).toEqual({
      link: 'https://www.facebook.com/share/p/abc123/', rest: 'Bespoak, a carpenter  (Gexpats).',
    });
  });
  it('drops punctuation that ends the sentence', () => {
    expect(splitLink('see https://bespoak.ch.').link).toBe('https://bespoak.ch');
  });
  it('no link: the text as it is', () => {
    expect(splitLink('  a plumber in Ferney ')).toEqual({ link: '', rest: 'a plumber in Ferney' });
  });
});
