import { describe, expect, it } from 'vitest';
import { answerOf } from '../answer';

describe('answerOf', () => {
  it('a short yes sends', () => {
    for (const s of ['Da', 'da.', 'OK', 'Okay!', 'da, trimite', 'Trimite', 'oui', 'yes send']) expect(answerOf(s), s).toBe('yes');
  });
  it('a no anywhere drops it', () => {
    for (const s of ['Nu', 'nu trimite', 'stop', 'Anulează', 'ok stop']) expect(answerOf(s), s).toBe('no');
  });
  it('anything else changes nothing', () => {
    for (const s of ['', 'poate', 'da, dar spune-i și că vin cu Ludmila', 'trimite-i și poza', 'bine']) expect(answerOf(s), s).toBe('other');
  });
});
