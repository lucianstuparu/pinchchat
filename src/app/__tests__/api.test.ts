import { describe, it, expect } from 'vitest';
import { ago, formatAmount } from '../api';

describe('desk api helpers', () => {
  it('ago reads relative to today', () => {
    expect(ago('2026-10-21', '2026-10-21')).toBe('today');
    expect(ago('2026-10-20', '2026-10-21')).toBe('yesterday');
    expect(ago('2026-10-18T10:00:00Z', '2026-10-21')).toBe('3 d ago');
    expect(ago('2026-09-30', '2026-10-21')).toBe('3 w ago');
    expect(ago(undefined, '2026-10-21')).toBe('');
  });

  it('formats amounts', () => {
    expect(formatAmount(1175, 'EUR')).toBe('€1,175');
    expect(formatAmount(103.69, 'RON')).toBe('RON 103.69');
  });
});
