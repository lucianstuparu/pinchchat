import { describe, it, expect } from 'vitest';
import { extractItems, formatAmount, isClosed, urgency } from '../messageItems';

const note = [
  'Reminders today:',
  '- Due 22 Oct: SFR/CertiDeal trade-in · 300 EUR ⟨adm-2026-10-18-5a672f⟩',
  '- **Overdue since 1 Oct:** AEDES charges · 693.78 EUR (shared) ⟨adm-2026-10-18-032d99⟩',
  '',
  'Anything else, tell me here.',
].join('\n');

describe('extractItems', () => {
  it('finds each marked item with a clean label, in order', () => {
    const { items } = extractItems(note);
    expect(items).toEqual([
      { id: 'adm-2026-10-18-5a672f', label: 'Due 22 Oct: SFR/CertiDeal trade-in · 300 EUR' },
      { id: 'adm-2026-10-18-032d99', label: 'Overdue since 1 Oct: AEDES charges · 693.78 EUR (shared)' },
    ]);
  });

  it('drops the list lines the cards replace and keeps the rest', () => {
    const { text } = extractItems(note);
    expect(text).toBe('Reminders today:\n\nAnything else, tell me here.');
  });

  it('keeps prose that names an item, minus the marker', () => {
    const { text, items } = extractItems('I added the water bill ⟨adm-2026-10-18-5a672f⟩ to the shared register.');
    expect(text).toBe('I added the water bill to the shared register.');
    expect(items.map(i => i.id)).toEqual(['adm-2026-10-18-5a672f']);
  });

  it('lists an item once even if it is named twice', () => {
    const { items } = extractItems('- A ⟨adm-2026-10-18-5a672f⟩\n- B again ⟨adm-2026-10-18-5a672f⟩');
    expect(items.map(i => i.id)).toEqual(['adm-2026-10-18-5a672f']);
  });

  it('ignores text without markers and malformed ids', () => {
    expect(extractItems('Nothing to do today.').items).toEqual([]);
    expect(extractItems('x ⟨adm-2026-10-18-ZZZZZZ⟩').items).toEqual([]);
  });
});

describe('card helpers', () => {
  it('knows closed states', () => {
    expect(isClosed({ status: 'paid' })).toBe(true);
    expect(isClosed({ status: 'open' })).toBe(false);
    expect(isClosed(undefined)).toBe(false);
  });

  it('grades urgency from the due date', () => {
    const t = '2026-10-20';
    expect(urgency({ status: 'open', due_date: '2026-10-01' }, t)).toBe('overdue');
    expect(urgency({ status: 'open', due_date: '2026-10-20' }, t)).toBe('today');
    expect(urgency({ status: 'open', due_date: '2026-10-22' }, t)).toBe('soon');
    expect(urgency({ status: 'open', due_date: '2026-11-10' }, t)).toBe('later');
    expect(urgency({ status: 'open' }, t)).toBe('none');
  });

  it('formats amounts with the currency symbol', () => {
    expect(formatAmount(693.78, 'EUR')).toBe('€693.78');
    expect(formatAmount(1175, 'EUR')).toBe('€1,175');
    expect(formatAmount(103.69, 'RON')).toBe('RON 103.69');
    expect(formatAmount(undefined)).toBe('');
  });
});
