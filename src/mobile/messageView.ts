/** Pure helpers deciding what the messenger view shows for a message. */
import type { ChatMessage } from '../types';
import { stripWebchatEnvelope, hasWebchatEnvelope, stripWebhookScaffolding, hasWebhookScaffolding } from '../lib/systemEvent';

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function cleanUserText(text: string): string {
  let out = text;
  if (hasWebhookScaffolding(out)) out = stripWebhookScaffolding(out);
  if (hasWebchatEnvelope(out)) out = stripWebchatEnvelope(out);
  return out.trim();
}

/** Text shown for a message, or '' when it carries nothing a messenger would show. */
export function visibleText(msg: ChatMessage): string {
  const textBlocks = msg.blocks.filter(b => b.type === 'text').map(b => (b as { text: string }).text);
  const raw = (textBlocks.length > 0 ? textBlocks.join('\n\n') : msg.content || '').trim();
  if (raw === 'NO_REPLY' || raw === 'HEARTBEAT_OK') return '';
  return msg.role === 'user' ? cleanUserText(raw) : raw;
}

/** Messenger view hides tool traffic, thinking, system events and compaction markers. */
export function isShownInMessenger(msg: ChatMessage): boolean {
  if (msg.isCompactionSeparator || msg.isSystemEvent) return false;
  if (msg.isStreaming) return true;
  const hasImage = msg.blocks.some(b => b.type === 'image');
  return hasImage || visibleText(msg).length > 0;
}

type Meta = { api?: unknown; idempotencyKey?: unknown; __openclaw?: { importedFrom?: unknown } } | undefined;

/** The gateway's own combined reply for a claude-cli turn (what WhatsApp receives). */
function isCliCombinedReply(msg: ChatMessage): boolean {
  const meta = msg.metadata as Meta;
  return msg.role === 'assistant'
    && (meta?.api === 'cli' || (typeof meta?.idempotencyKey === 'string' && meta.idempotencyKey.startsWith('cli-assistant:')));
}

/** A step of the same turn imported from Claude's own transcript. */
function isCliImportedStep(msg: ChatMessage): boolean {
  const meta = msg.metadata as Meta;
  return msg.role === 'assistant' && meta?.__openclaw?.importedFrom === 'claude-cli';
}

/**
 * History stores a claude-cli turn twice: the imported step messages and one combined reply that
 * repeats their text. Keep the combined reply and drop the steps of any turn that has one. The
 * combined reply itself can carry the imported mark too (resumed sessions), so it is never dropped.
 * A turn runs from one real user message to the next (system events do not end it); turns without
 * a combined reply are left as they are.
 */
export function collapseCliTurns(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let turn: ChatMessage[] = [];
  const flush = () => {
    const combined = turn.some(isCliCombinedReply);
    for (const m of turn) {
      if (combined && isCliImportedStep(m) && !isCliCombinedReply(m)) continue;
      out.push(m);
    }
    turn = [];
  };
  for (const m of messages) {
    if (m.role === 'user' && !m.isSystemEvent) { flush(); out.push(m); } else turn.push(m);
  }
  flush();
  return out;
}

/** Markdown blockquote of the message being replied to, prepended to the reply (WhatsApp-style). */
export function quoteForReply(text: string, max = 300): string {
  const flat = text.trim();
  const cut = flat.length > max ? flat.slice(0, max).trimEnd() + '…' : flat;
  return cut.split('\n').map(line => (line.trim() ? `> ${line}` : '>')).join('\n');
}

/** A reply's own text without the quote it carries, so quoting it does not nest quotes. */
export function withoutLeadingQuote(text: string): string {
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && /^\s*>/.test(lines[i])) i++;
  if (i === 0) return text;
  while (i < lines.length && !lines[i].trim()) i++;
  return i < lines.length ? lines.slice(i).join('\n') : text;
}
