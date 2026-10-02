import { describe, it, expect } from 'vitest';
import { composeShareText } from '../shareInbox';

describe('composeShareText', () => {
  it('Chrome style: title + url, no text', () => {
    expect(composeShareText('Article title', '', 'https://example.com/a')).toBe('Article title\nhttps://example.com/a');
  });

  it('does not repeat a URL already inside the text (common on Android)', () => {
    expect(composeShareText('', 'Look at this https://example.com/a', 'https://example.com/a')).toBe('Look at this https://example.com/a');
  });

  it('does not repeat a title already inside the text', () => {
    expect(composeShareText('Thread', 'Thread by someone\nhttps://x.y', '')).toBe('Thread by someone\nhttps://x.y');
  });

  it('plain text share (e.g. from WhatsApp)', () => {
    expect(composeShareText('', 'buy oat milk', '')).toBe('buy oat milk');
  });

  it('empty share yields empty text', () => {
    expect(composeShareText(' ', '', '')).toBe('');
  });
});
