import { useSyncExternalStore } from 'react';
import { getLocale, onLocaleChange, t as rawT, type TranslationKey } from '../lib/i18n';

/** Re-renders component when locale changes. Returns the current locale string. */
export function useLocale(): string {
  return useSyncExternalStore(onLocaleChange, getLocale, getLocale);
}

/**
 * Reactive translation hook.
 * Components using this will automatically re-render when locale changes.
 */
export function useT(): (key: TranslationKey) => string {
  useLocale(); // subscribe to changes
  return rawT;
}
