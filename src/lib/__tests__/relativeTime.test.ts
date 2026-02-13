import { describe, it, expect, vi, afterEach } from 'vitest';
import { relativeTime } from '../relativeTime';

describe('relativeTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for undefined', () => {
    expect(relativeTime(undefined)).toBeNull();
  });

  it('returns null for 0', () => {
    expect(relativeTime(0)).toBeNull();
  });

  it('returns "<1m" for timestamps less than 60s ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(relativeTime(now - 30_000)).toBe('<1m');
    expect(relativeTime(now)).toBe('<1m');
  });

  it('returns minutes for 1-59 minutes ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(relativeTime(now - 60_000)).toBe('1m');
    expect(relativeTime(now - 45 * 60_000)).toBe('45m');
  });

  it('returns hours for 1-23 hours ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(relativeTime(now - 3_600_000)).toBe('1h');
    expect(relativeTime(now - 23 * 3_600_000)).toBe('23h');
  });

  it('returns days for 1-29 days ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(relativeTime(now - 86_400_000)).toBe('1d');
    expect(relativeTime(now - 7 * 86_400_000)).toBe('7d');
  });

  it('returns months for 30+ days ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(relativeTime(now - 30 * 86_400_000)).toBe('1mo');
    expect(relativeTime(now - 90 * 86_400_000)).toBe('3mo');
  });

  it('clamps negative diff to 0 (future timestamps)', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(relativeTime(now + 60_000)).toBe('<1m');
  });
});
