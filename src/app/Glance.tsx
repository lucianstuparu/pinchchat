/**
 * A short title with only its key word group bold (glance_key, written by the coach job; Lucian 2026-11-07, assumed, to confirm).
 * With no key, or a key no longer in the words, nothing is bold.
 */
import { keyParts } from './todayRules';

export function Glance({ text, keyWords, bold = 'font-bold' }: { text: string; keyWords?: string; bold?: string }) {
  const parts = keyParts(text, keyWords);
  if (!parts) return <>{text}</>;
  return <>{parts[0]}<strong className={bold}>{parts[1]}</strong>{parts[2]}</>;
}
