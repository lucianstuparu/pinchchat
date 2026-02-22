/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocale, useT } from '../useLocale';
import { setLocale } from '../../lib/i18n';
import type { TranslationKey } from '../../lib/i18n';

describe('useLocale', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('returns current locale', () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current).toBe('en');
  });

  it('updates when locale changes', () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current).toBe('en');

    act(() => { setLocale('fr'); });
    expect(result.current).toBe('fr');
  });
});

describe('useT', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('returns a translation function', () => {
    const { result } = renderHook(() => useT());
    expect(typeof result.current).toBe('function');
  });

  it('translates keys for current locale', () => {
    const { result } = renderHook(() => useT());
    // 'send' is a common key that should exist
    const translated = result.current('chat.send' as TranslationKey);
    expect(typeof translated).toBe('string');
    expect(translated.length).toBeGreaterThan(0);
  });

  it('re-renders with new translations when locale changes', () => {
    const { result } = renderHook(() => useT());
    const enText = result.current('chat.send' as TranslationKey);

    act(() => { setLocale('fr'); });
    const frText = result.current('chat.send' as TranslationKey);

    // EN='Send', FR='Envoyer'
    expect(enText).not.toBe(frText);
  });
});
