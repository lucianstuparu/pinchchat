/**
 * In-conversation search: which messages match, and the snippet to show.
 * Case- and accent-insensitive ("Taxe fonciere" finds "Taxe foncière").
 */
import type { ChatMessage } from '../types';
import { visibleText } from './messageView';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchMessages(messages: ChatMessage[], query: string): ChatMessage[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  return messages.filter(m => fold(visibleText(m)).includes(q));
}

export interface Snippet { before: string; match: string; after: string }

/** The matched words with some context either side; the match keeps its original spelling. */
export function snippet(text: string, query: string, radius = 56): Snippet {
  const flat = text.replace(/\s+/g, ' ').replace(/[*_`#>]/g, '').trim();
  const q = fold(query.trim());
  const folded = fold(flat);
  const at = q ? folded.indexOf(q) : -1;
  if (at < 0) return { before: flat.slice(0, radius * 2), match: '', after: '' };
  // fold() keeps character count except for removed accents; map through the folded string
  // only when lengths agree, else fall back to a plain slice.
  const same = folded.length === flat.length;
  const start = same ? at : flat.toLowerCase().indexOf(query.trim().toLowerCase());
  const s = start >= 0 ? start : at;
  const b = Math.max(0, s - radius);
  return {
    before: (b > 0 ? '…' : '') + flat.slice(b, s),
    match: flat.slice(s, s + q.length),
    after: flat.slice(s + q.length, s + q.length + radius) + (s + q.length + radius < flat.length ? '…' : ''),
  };
}
