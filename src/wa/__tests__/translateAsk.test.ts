import { describe, expect, it } from 'vitest';
import { asksTranslation } from '../api';

describe('asksTranslation: said or typed starting with a request to translate', () => {
  it('recognises it in the languages Relay is used in', () => {
    for (const t of [
      'Traduce în franceză informal: ajung mâine la 7',
      'tradu asta în rusă',
      'Translate this into French: I am late',
      'please translate to English, formal',
      "Traduis en roumain : j'arrive",
      'Переведи на французский: я опоздаю',
      'Te rog, traduce în engleză',
    ]) expect(asksTranslation(t), t).toBe(true);
  });
  it('leaves messages for someone alone', () => {
    for (const t of [
      'Spune-i lui Marius că traduc eu documentele',
      'Bunica: ajung la 7',
      'traducerea e gata',
      'translated the documents yesterday',
    ]) expect(asksTranslation(t), t).toBe(false);
  });
});
