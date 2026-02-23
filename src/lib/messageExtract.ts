/**
 * Shared helpers for extracting text and thinking content from gateway chat messages.
 */

export interface ChatPayloadMessage {
  content?: string | Array<{ type: string; text?: string; thinking?: string }>;
}

/** Extract all text blocks from a gateway chat message, joined by newline. */
export function extractText(message: ChatPayloadMessage | undefined): string {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n');
  }
  return '';
}

/** Extract all thinking blocks from a gateway chat message, joined by newline. */
export function extractThinking(message: ChatPayloadMessage | undefined): string {
  if (!message) return '';
  const content = message.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b.type === 'thinking')
    .map((b) => b.thinking || b.text || '')
    .join('\n');
}
