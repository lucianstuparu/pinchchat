import { describe, it, expect } from 'vitest';
import { isShownInMessenger, visibleText } from '../messageView';
import type { ChatMessage } from '../../types';

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'm', role: 'assistant', content: '', timestamp: 0, blocks: [], ...over,
});

describe('messenger visibility', () => {
  it('shows plain assistant text', () => {
    expect(isShownInMessenger(msg({ blocks: [{ type: 'text', text: 'hello' }] }))).toBe(true);
  });

  it('hides tool-only and thinking-only assistant turns', () => {
    expect(isShownInMessenger(msg({ blocks: [{ type: 'tool_use', name: 'exec', input: {} }] }))).toBe(false);
    expect(isShownInMessenger(msg({ blocks: [{ type: 'thinking', text: 'hmm' }] }))).toBe(false);
  });

  it('hides NO_REPLY, heartbeat acks, system events and compaction markers', () => {
    expect(isShownInMessenger(msg({ blocks: [{ type: 'text', text: 'NO_REPLY' }] }))).toBe(false);
    expect(isShownInMessenger(msg({ blocks: [{ type: 'text', text: 'HEARTBEAT_OK' }] }))).toBe(false);
    expect(isShownInMessenger(msg({ role: 'user', isSystemEvent: true, blocks: [{ type: 'text', text: '[HEARTBEAT]' }] }))).toBe(false);
    expect(isShownInMessenger(msg({ isCompactionSeparator: true }))).toBe(false);
  });

  it('keeps a streaming turn visible even before text arrives (typing dots)', () => {
    expect(isShownInMessenger(msg({ isStreaming: true }))).toBe(true);
  });

  it('keeps image-only messages', () => {
    expect(isShownInMessenger(msg({ role: 'user', blocks: [{ type: 'image', mediaType: 'image/png', data: 'x' }] }))).toBe(true);
  });

  it('shows only the text blocks of a mixed turn', () => {
    const m = msg({ blocks: [{ type: 'thinking', text: 'plan' }, { type: 'tool_use', name: 'x', input: {} }, { type: 'text', text: 'done' }] });
    expect(visibleText(m)).toBe('done');
  });
});
