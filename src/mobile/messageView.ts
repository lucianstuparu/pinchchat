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
