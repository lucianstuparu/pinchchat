/**
 * Search text helpers shared by oc and Casa Artlia: splitting a text into plain and matched parts
 * (the server marks its matches; chat excerpts and documents are marked here, by word, accents
 * ignored), and which older chat hits are already on screen.
 */
export interface Part { text: string; hit: boolean }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The server's snippet: matched words sit between \u0002 and \u0003. */
export function markedParts(snippet: string): Part[] {
  const out: Part[] = [];
  for (const piece of snippet.split('\u0002')) {
    const end = piece.indexOf('\u0003');
    if (end < 0) { if (piece) out.push({ text: piece, hit: false }); continue; }
    if (end > 0) out.push({ text: piece.slice(0, end), hit: true });
    if (end + 1 < piece.length) out.push({ text: piece.slice(end + 1), hit: false });
  }
  return merge(out);
}

/** The snippet's text without its marks. */
export const plainOf = (snippet: string) => markedParts(snippet).map(p => p.text).join('');

/** The words someone searched for, for marking: 2 letters or more, accents and case ignored. */
export const queryWords = (q: string) => fold(q).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1);

/** Marks every word that starts with one of the query words (accents ignored, original spelling kept). */
export function wordParts(text: string, query: string): Part[] {
  const words = queryWords(query);
  if (words.length === 0) return text ? [{ text, hit: false }] : [];
  const out: Part[] = [];
  // Letters and digits form words; everything else passes through unmarked.
  for (const m of text.matchAll(/([\p{L}\p{M}\p{N}]+)|([^\p{L}\p{M}\p{N}]+)/gu)) {
    const w = m[1];
    out.push({ text: m[0], hit: !!w && words.some(q => fold(w).startsWith(q)) });
  }
  return merge(out);
}

function merge(parts: Part[]): Part[] {
  const out: Part[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.hit === p.hit) last.text += p.text; else out.push({ ...p });
  }
  return out;
}

/**
 * A short excerpt of a long text around the first matched word, for a result row.
 * Without a match it is the start of the text.
 */
export function excerpt(text: string, query: string, radius = 70): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const words = queryWords(query);
  const f = fold(flat);
  // fold() can shorten a string (combining marks); positions hold only when the lengths agree.
  let at = -1;
  if (words.length && f.length === flat.length) {
    for (const w of words) { const i = f.search(new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u')); if (i >= 0 && (at < 0 || i < at)) at = i; }
  }
  if (at < 0) return flat.length > radius * 2 ? `${flat.slice(0, radius * 2)}…` : flat;
  const from = Math.max(0, at - radius), to = Math.min(flat.length, at + radius);
  return `${from > 0 ? '…' : ''}${flat.slice(from, to).trim()}${to < flat.length ? '…' : ''}`;
}

/** A gateway chat hit is "on screen" when a loaded message has the same id, or the same role within 2 s. */
export function loadedMatch<T extends { id: string; role: string; timestamp: number }>(
  hit: { messageId: string; role: string; timestamp: number }, loaded: T[],
): T | undefined {
  return loaded.find(m => m.id === hit.messageId) ?? loaded.find(m => m.role === hit.role && Math.abs(m.timestamp - hit.timestamp) < 2000);
}
