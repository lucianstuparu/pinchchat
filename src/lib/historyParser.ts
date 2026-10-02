/**
 * Pure function to parse raw gateway history messages into ChatMessage[].
 * Shared between useGateway and useSecondarySession to avoid duplication.
 */
import type { ChatMessage, MessageBlock } from '../types';
import { isSystemEvent } from './systemEvent';

/* eslint-disable @typescript-eslint/no-explicit-any -- raw gateway messages have dynamic shape */

/** Parse a single content block from a raw history message. */
function parseContentBlock(block: Record<string, any>): MessageBlock | null {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'thinking':
      return { type: 'thinking', text: block.thinking || block.text || '' };
    case 'image': {
      const src = block.source || {};
      return {
        type: 'image',
        mediaType: src.media_type || block.media_type || 'image/png',
        data: src.data || block.data,
        url: block.url || src.url,
      };
    }
    case 'image_url':
      return { type: 'image', mediaType: 'image/png', url: block.image_url?.url || block.url };
    case 'tool_use':
      return { type: 'tool_use', name: block.name, input: block.input, id: block.id };
    case 'tool_result':
      return {
        type: 'tool_result',
        content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2),
        toolUseId: block.tool_use_id,
      };
    case 'toolCall':
      return { type: 'tool_use', name: block.name, input: block.arguments || block.input, id: block.id };
    case 'toolResult':
      return {
        type: 'tool_result',
        content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2),
        toolUseId: block.toolCallId || block.tool_use_id,
        name: block.name,
      };
    default:
      return null;
  }
}

/** Parse content field (string or array) into MessageBlock[]. */
function parseContent(content: unknown): MessageBlock[] {
  if (!content) return [];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (Array.isArray(content)) {
    const blocks: MessageBlock[] = [];
    for (const block of content) {
      const parsed = parseContentBlock(block);
      if (parsed) blocks.push(parsed);
    }
    return blocks;
  }
  return [];
}

/**
 * Parse raw gateway history messages into ChatMessage[].
 * Merges tool results into their parent assistant messages.
 */
export function parseHistoryMessages(rawMsgs: Array<Record<string, any>>): ChatMessage[] {
  const msgs: (ChatMessage & { isToolResult?: boolean })[] = rawMsgs.map((m, i) => {
    const blocks = parseContent(m.content);
    const role: 'user' | 'assistant' = m.role === 'user' ? 'user' : 'assistant';

    if (m.role === 'toolResult') {
      const toolBlocks: MessageBlock[] = blocks.map(b => {
        if (b.type === 'text') {
          return { type: 'tool_result' as const, content: b.text, toolUseId: m.toolCallId };
        }
        return b;
      });
      return {
        id: m.id || `hist-${i}`,
        role: 'assistant' as const,
        content: '',
        timestamp: m.timestamp || Date.now(),
        blocks: toolBlocks,
        isToolResult: true,
      };
    }

    const textContent = blocks
      .filter((b): b is Extract<MessageBlock, { type: 'text' }> => b.type === 'text')
      .map(b => b.text)
      .join('');

    const metadata: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) {
      if (['content', 'blocks'].includes(k)) continue;
      metadata[k] = v;
    }

    return {
      id: m.id || `hist-${i}`,
      role,
      content: textContent,
      timestamp: m.timestamp || Date.now(),
      blocks,
      metadata,
      isSystemEvent: role === 'user' && isSystemEvent(textContent),
    };
  });

  // Merge tool results into preceding assistant message
  const merged: ChatMessage[] = [];
  for (const msg of msgs) {
    if (msg.isToolResult && merged.length > 0 && merged[merged.length - 1].role === 'assistant') {
      merged[merged.length - 1] = {
        ...merged[merged.length - 1],
        blocks: [...merged[merged.length - 1].blocks, ...msg.blocks],
      };
    } else if (!msg.isToolResult) {
      merged.push(msg);
    }
  }

  return merged;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
