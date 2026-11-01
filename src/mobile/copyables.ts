/**
 * Things in an assistant's reply that Lucian may want to copy (2026-11-01: "have copy icon next to
 * each information like this: a link, a number, an email address, an address"). Inline code gets a
 * copy button in the bubble, so these are marked as inline code before the Markdown is rendered.
 * Links (Markdown or bare) already get their own copy button; addresses cannot be found reliably
 * here, so the agents are asked to write them as inline code themselves.
 */

// What is left alone: code (fenced or inline), Markdown links and images, bare URLs.
const SKIP = /```[\s\S]*?(?:```|$)|`[^`\n]*`|!?\[[^\]\n]*\]\([^)\n]*\)|https?:\/\/[^\s<>)]+/g;

const EMAIL = String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`;
const IBAN = String.raw`\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b`;
// +33 6 12 34 56 78, 06 12 34 56 78, 0612345678, +40 721 234 567
const PHONE = String.raw`(?<![\w+])(?:\+\d{2,3}[ .]?\d{1,3}|0\d)(?:[ .-]?\d{2,3}){3,4}(?![\w])`;
// References and long numbers: 6+ characters with at least 4 digits (FR123456, 7845-2219-03)
const REF = String.raw`(?<![\w.,/-])(?=(?:[A-Z-]*\d){4})[A-Z0-9][A-Z0-9-]{4,}[A-Z0-9](?![\w/-])`;
const FIND = new RegExp(`${EMAIL}|${IBAN}|${PHONE}|${REF}`, 'g');

/** Not worth a copy button: dates, times, plain amounts. */
const isNoise = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}-\d{1,2}-\d{2,4}$/.test(s);

function markPlain(part: string): string {
  return part.replace(FIND, m => (isNoise(m) ? m : `\`${m}\``));
}

export function markCopyables(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(SKIP)) {
    out += markPlain(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + markPlain(text.slice(last));
}
