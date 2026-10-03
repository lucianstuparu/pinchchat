import { describe, it, expect } from 'vitest';
import { collapseCliTurns, isShownInMessenger, visibleText } from '../messageView';
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

describe('claude-cli turn collapsing', () => {
  const step = (id: string, text: string) => msg({ id, blocks: [{ type: 'text', text }], metadata: { __openclaw: { importedFrom: 'claude-cli' } } });
  const tool = (id: string) => msg({ id, blocks: [{ type: 'tool_use', name: 'Bash', input: {} }], metadata: { __openclaw: { importedFrom: 'claude-cli' } } });
  const combined = (id: string, text: string) => msg({ id, blocks: [{ type: 'text', text }], metadata: { api: 'cli', idempotencyKey: 'cli-assistant:x' } });
  const user = (id: string) => msg({ id, role: 'user', blocks: [{ type: 'text', text: 'q' }] });

  it('keeps only the combined reply of a turn that has one', () => {
    const out = collapseCliTurns([user('u1'), step('s1', 'Routing.'), tool('t1'), step('s2', 'done'), combined('c1', 'Routing.\n\ndone')]);
    expect(out.map(m => m.id)).toEqual(['u1', 'c1']);
  });

  it('leaves turns without a combined reply untouched (still running, or other backends)', () => {
    const out = collapseCliTurns([user('u1'), step('s1', 'a'), user('u2'), msg({ id: 'p', blocks: [{ type: 'text', text: 'b' }] })]);
    expect(out.map(m => m.id)).toEqual(['u1', 's1', 'u2', 'p']);
  });

  it('collapses each turn independently', () => {
    const out = collapseCliTurns([user('u1'), step('s1', 'a'), combined('c1', 'a'), user('u2'), step('s2', 'b')]);
    expect(out.map(m => m.id)).toEqual(['u1', 'c1', 'u2', 's2']);
  });

  it('keeps a combined reply that is itself marked imported (resumed sessions)', () => {
    const importedCombined = msg({ id: 'c1', blocks: [{ type: 'text', text: '7:24 AM' }], metadata: { api: 'cli', __openclaw: { importedFrom: 'claude-cli' } } });
    const out = collapseCliTurns([user('u1'), tool('t1'), importedCombined]);
    expect(out.map(m => m.id)).toEqual(['u1', 'c1']);
  });

  it('does not end a turn at a system event', () => {
    const sys = msg({ id: 'sys', role: 'user', isSystemEvent: true, blocks: [{ type: 'text', text: 'System: connected' }] });
    const out = collapseCliTurns([user('u1'), step('s1', 'a'), sys, step('s2', 'b'), combined('c1', 'a\n\nb')]);
    expect(out.map(m => m.id)).toEqual(['u1', 'sys', 'c1']);
  });
});
