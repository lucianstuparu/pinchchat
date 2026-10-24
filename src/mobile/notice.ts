/**
 * Gateway noise in the messenger: the system lines it puts in front of a message, and failed-turn
 * notices that should read as one short line with the details a tap away.
 */

const PREAMBLE_LINE = /^(System:|OpenClaw resumed this CLI session\b)/;

/**
 * Drops the leading block the gateway adds to a user message ("System: [..] WhatsApp gateway
 * connected", "OpenClaw resumed this CLI session…"): whole leading paragraphs whose every line is
 * such a line. A message that is nothing else becomes ''.
 */
export function stripSystemPreamble(text: string): string {
  const paras = text.split(/\n\s*\n/);
  let i = 0;
  while (i < paras.length) {
    const lines = paras[i].split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0 || !lines.every(l => PREAMBLE_LINE.test(l))) break;
    i++;
  }
  return i === 0 ? text : paras.slice(i).join('\n\n').trim();
}

export interface Notice { summary: string; detail: string }

const FAILED = [
  /^This turn ended before a reply:\s*/i,
  /^Error:\s*/,
];
const CONTENTION = /^The turn was interrupted while the server was busy\b/;

const CAUSES: Array<[RegExp, string]> = [
  [/authenticat|oauth|\b401\b|log ?in|sign.?in|credential/i, 'sign-in expired'],
  [/usage limit|rate.?limit|\b429\b|quota|too many requests/i, 'usage limit reached'],
  [/overloaded|\b529\b|\b503\b|unavailable/i, 'Claude is busy'],
  [/timed? ?out|timeout|deadline/i, 'took too long'],
  [/network|ECONN|ENOTFOUND|EAI_AGAIN|fetch failed|socket/i, 'no connection'],
  [/abort|cancel/i, 'stopped'],
];

/** A failed-turn notice as one line ("No reply · sign-in expired") plus its full text. */
export function failedTurn(text: string): Notice | null {
  const t = text.trim();
  if (CONTENTION.test(t)) return { summary: 'No reply · server was busy', detail: t };
  const head = FAILED.find(re => re.test(t));
  if (!head) return null;
  const detail = t.replace(head, '');
  const cause = CAUSES.find(([re]) => re.test(detail))?.[1] ?? 'something went wrong';
  return { summary: `No reply · ${cause}`, detail };
}

/** Long bubbles start folded: more than this many characters or lines. */
export const FOLD_CHARS = 420;
export const FOLD_LINES = 8;

export function isLong(text: string): boolean {
  return text.length > FOLD_CHARS || text.split('\n').length > FOLD_LINES;
}
