/**
 * Gateway noise in the messenger: the system lines it puts in front of a message, and failed-turn
 * notices that should read as one short line with the details a tap away.
 */

import { L } from '../ui/lang';

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
  /^FailoverError:\s*/,
];
/** The bare error text the gateway also sends next to its notice (same failure, no prefix). */
const BARE = /^(Failed to authenticate|OAuth session expired|Request timed out|Overloaded|Rate limit)/i;
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
  if (CONTENTION.test(t)) return { summary: `${L('No reply')} · ${L('server was busy')}`, detail: t };
  const head = FAILED.find(re => re.test(t));
  if (!head && !BARE.test(t)) return null;
  const detail = head ? t.replace(head, '') : t;
  const cause = L(CAUSES.find(([re]) => re.test(detail))?.[1] ?? 'something went wrong');
  return { summary: `${L('No reply')} · ${cause}`, detail };
}

/**
 * One failure, one line: the gateway reports a failed turn twice (its notice and the bare error),
 * so a failure right after the same failure is left out.
 */
export function dropRepeatedFailures<T>(msgs: T[], textOf: (m: T) => string): T[] {
  let last: string | null = null;
  return msgs.filter(m => {
    const f = failedTurn(textOf(m));
    const repeat = !!f && f.summary === last;
    last = f ? f.summary : null;
    return !repeat;
  });
}

/** A voice message: "Voice message: <what was said>" (older ones: "🎤 Voice note", no words). */
export function voiceMessage(text: string): { said: string } | null {
  const m = text.trim().match(/^(?:Voice message|🎤 Voice note)(?::\s*([\s\S]*))?$/u);
  return m ? { said: (m[1] ?? '').trim() } : null;
}

/** Long bubbles start folded: more than this many characters or lines. */
export const FOLD_CHARS = 420;
export const FOLD_LINES = 8;

export function isLong(text: string): boolean {
  return text.length > FOLD_CHARS || text.split('\n').length > FOLD_LINES;
}
