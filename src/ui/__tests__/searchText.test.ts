import { describe, expect, it } from 'vitest';
import { excerpt, loadedMatch, markedParts, queryWords, wordParts } from '../searchText';

describe('markedParts', () => {
  it('splits the server snippet at its markers', () => {
    expect(markedParts('…la \u0002promesse\u0003 de \u0002vente\u0003 signée')).toEqual([
      { text: '…la ', hit: false }, { text: 'promesse', hit: true }, { text: ' de ', hit: false }, { text: 'vente', hit: true }, { text: ' signée', hit: false },
    ]);
  });
  it('keeps brackets and plain text as they are', () => {
    expect(markedParts('[KB 03] no match')).toEqual([{ text: '[KB 03] no match', hit: false }]);
    expect(markedParts('')).toEqual([]);
  });
});

describe('wordParts', () => {
  it('marks words starting with a query word, accents ignored, spelling kept', () => {
    expect(wordParts('Taxe foncière payée', 'fonciere')).toEqual([
      { text: 'Taxe ', hit: false }, { text: 'foncière', hit: true }, { text: ' payée', hit: false },
    ]);
    expect(wordParts('Contractul cu arhitectul', 'arhitect contract').filter(p => p.hit).map(p => p.text)).toEqual(['Contractul', 'arhitectul']);
  });
  it('does not mark inside words, nor one-letter queries', () => {
    expect(wordParts('notaire', 'tai').some(p => p.hit)).toBe(false);
    expect(wordParts('a b', 'a')).toEqual([{ text: 'a b', hit: false }]);
    expect(queryWords("d'œuvre, ERP!")).toEqual(['œuvre', 'erp']);
  });
});

describe('excerpt', () => {
  const long = `${'x '.repeat(100)}la convention de maîtrise d'œuvre ${'y '.repeat(100)}`;
  it('centres on the first matched word', () => {
    const e = excerpt(long, 'maitrise');
    expect(e.startsWith('…')).toBe(true);
    expect(e.endsWith('…')).toBe(true);
    expect(e).toContain('maîtrise');
  });
  it('is the start of the text without a match', () => {
    expect(excerpt('short text', 'nope')).toBe('short text');
  });
});

describe('loadedMatch', () => {
  const loaded = [{ id: 'a', role: 'user', timestamp: 1000 }, { id: 'b', role: 'assistant', timestamp: 5000 }];
  it('finds by id, else by role and time', () => {
    expect(loadedMatch({ messageId: 'b', role: 'assistant', timestamp: 0 }, loaded)?.id).toBe('b');
    expect(loadedMatch({ messageId: 'zz', role: 'assistant', timestamp: 6500 }, loaded)?.id).toBe('b');
    expect(loadedMatch({ messageId: 'zz', role: 'user', timestamp: 5000 }, loaded)).toBeUndefined();
  });
});
