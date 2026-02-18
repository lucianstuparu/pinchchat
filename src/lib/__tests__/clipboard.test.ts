/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '../clipboard';

describe('copyToClipboard', () => {
  beforeEach(() => {
    // jsdom doesn't define execCommand — add it so we can spy on it
    if (!document.execCommand) {
      (document as unknown as Record<string, unknown>).execCommand = () => false;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const result = await copyToClipboard('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result).toBe(true);
  });

  it('falls back to execCommand when clipboard API throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    vi.spyOn(document, 'execCommand').mockReturnValue(true);

    const result = await copyToClipboard('fallback text');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toBe(true);
  });

  it('falls back to execCommand when clipboard API is undefined', async () => {
    Object.assign(navigator, { clipboard: undefined });
    vi.spyOn(document, 'execCommand').mockReturnValue(true);

    const result = await copyToClipboard('no clipboard');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toBe(true);
  });

  it('returns false when execCommand returns false', async () => {
    Object.assign(navigator, { clipboard: undefined });
    vi.spyOn(document, 'execCommand').mockReturnValue(false);

    const result = await copyToClipboard('fail');
    expect(result).toBe(false);
  });

  it('returns false when both methods throw', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } });
    vi.spyOn(document, 'execCommand').mockImplementation(() => { throw new Error('not supported'); });

    const result = await copyToClipboard('total fail');
    expect(result).toBe(false);
  });
});
