import { describe, it, expect } from 'vitest';
import { extractItems, isClosed } from '../messageItems';

const note = [
  'Reminders today:',
  '- Due 22 Oct: SFR/CertiDeal trade-in · 300 EUR ⟨adm-2026-10-18-5a672f⟩',
  '- **Overdue since 1 Oct:** AEDES charges · 693.78 EUR (shared) ⟨adm-2026-10-18-032d99⟩',
  '',
  'Tap Done or Snooze under each item, or tell me here.',
].join('\n');

describe('extractItems', () => {
  it('finds each marked item with a clean label, in order', () => {
    const { items } = extractItems(note);
    expect(items).toEqual([
      { id: 'adm-2026-10-18-5a672f', label: 'Due 22 Oct: SFR/CertiDeal trade-in · 300 EUR' },
      { id: 'adm-2026-10-18-032d99', label: 'Overdue since 1 Oct: AEDES charges · 693.78 EUR (shared)' },
    ]);
  });

  it('removes the markers from the shown text and keeps the rest', () => {
    const { text } = extractItems(note);
    expect(text).not.toContain('⟨');
    expect(text).toContain('- Due 22 Oct: SFR/CertiDeal trade-in · 300 EUR\n');
    expect(text).toContain('Tap Done or Snooze');
  });

  it('lists an item once even if it is named twice', () => {
    const { items } = extractItems('A ⟨adm-2026-10-18-5a672f⟩\nB again ⟨adm-2026-10-18-5a672f⟩');
    expect(items.map(i => i.id)).toEqual(['adm-2026-10-18-5a672f']);
  });

  it('ignores text without markers and malformed ids', () => {
    expect(extractItems('Nothing to do today.').items).toEqual([]);
    expect(extractItems('x ⟨adm-2026-10-18-ZZZZZZ⟩').items).toEqual([]);
  });

  it('knows closed states', () => {
    expect(isClosed({ status: 'paid' })).toBe(true);
    expect(isClosed({ status: 'open' })).toBe(false);
    expect(isClosed(undefined)).toBe(false);
  });
});
