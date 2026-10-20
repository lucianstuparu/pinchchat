import { describe, it, expect } from 'vitest';
import { searchMessages, snippet } from '../searchMessages';
import type { ChatMessage } from '../../types';

const msg = (id: string, text: string, role: 'user' | 'assistant' = 'assistant'): ChatMessage =>
  ({ id, role, content: text, timestamp: 1, blocks: [{ type: 'text', text }] });

const history = [
  msg('1', 'Taxe foncière 2026: €1,175, debit 26 Oct'),
  msg('2', 'buy oat milk', 'user'),
  msg('3', 'Added **Oat milk** to the shared shopping list.'),
];

describe('searchMessages', () => {
  it('matches case- and accent-insensitively', () => {
    expect(searchMessages(history, 'taxe FONCIERE').map(m => m.id)).toEqual(['1']);
    expect(searchMessages(history, 'oat milk').map(m => m.id)).toEqual(['2', '3']);
  });

  it('needs at least two characters', () => {
    expect(searchMessages(history, 'o')).toEqual([]);
    expect(searchMessages(history, ' ')).toEqual([]);
  });
});

describe('snippet', () => {
  it('returns the match with context and no markdown marks', () => {
    const s = snippet('Added **Oat milk** to the shared shopping list.', 'oat milk');
    expect(s).toEqual({ before: 'Added ', match: 'Oat milk', after: ' to the shared shopping list.' });
  });

  it('trims long context with ellipses', () => {
    const long = `${'a '.repeat(60)}needle${' b'.repeat(60)}`;
    const s = snippet(long, 'needle', 10);
    expect(s.before.startsWith('…')).toBe(true);
    expect(s.match).toBe('needle');
    expect(s.after.endsWith('…')).toBe(true);
  });
});
