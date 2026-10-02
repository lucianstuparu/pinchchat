import { describe, it, expect } from 'vitest';
import { parseHistoryMessages } from '../historyParser';

describe('parseHistoryMessages', () => {
  it('returns empty array for empty input', () => {
    expect(parseHistoryMessages([])).toEqual([]);
  });

  it('parses a simple text message', () => {
    const raw = [{ id: '1', role: 'user', content: 'hello', timestamp: 1000 }];
    const result = parseHistoryMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('hello');
    expect(result[0].blocks).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('parses array content with text blocks', () => {
    const raw = [{
      id: '1', role: 'assistant', timestamp: 1000,
      content: [{ type: 'text', text: 'hello ' }, { type: 'text', text: 'world' }],
    }];
    const result = parseHistoryMessages(raw);
    expect(result[0].content).toBe('hello world');
    expect(result[0].blocks).toHaveLength(2);
  });

  it('parses thinking blocks', () => {
    const raw = [{
      id: '1', role: 'assistant', timestamp: 1000,
      content: [{ type: 'thinking', thinking: 'hmm' }, { type: 'text', text: 'answer' }],
    }];
    const result = parseHistoryMessages(raw);
    expect(result[0].blocks).toEqual([
      { type: 'thinking', text: 'hmm' },
      { type: 'text', text: 'answer' },
    ]);
  });

  it('parses image blocks with source object', () => {
    const raw = [{
      id: '1', role: 'assistant', timestamp: 1000,
      content: [{ type: 'image', source: { media_type: 'image/jpeg', data: 'abc' } }],
    }];
    const result = parseHistoryMessages(raw);
    expect(result[0].blocks[0]).toEqual({
      type: 'image', mediaType: 'image/jpeg', data: 'abc', url: undefined,
    });
  });

  it('parses image_url blocks', () => {
    const raw = [{
      id: '1', role: 'assistant', timestamp: 1000,
      content: [{ type: 'image_url', image_url: { url: 'https://example.com/img.png' } }],
    }];
    const result = parseHistoryMessages(raw);
    expect(result[0].blocks[0]).toEqual({
      type: 'image', mediaType: 'image/png', url: 'https://example.com/img.png',
    });
  });

  it('parses tool_use and tool_result blocks', () => {
    const raw = [{
      id: '1', role: 'assistant', timestamp: 1000,
      content: [
        { type: 'tool_use', name: 'exec', input: { cmd: 'ls' }, id: 'tc1' },
        { type: 'tool_result', content: 'file.txt', tool_use_id: 'tc1' },
      ],
    }];
    const result = parseHistoryMessages(raw);
    expect(result[0].blocks).toEqual([
      { type: 'tool_use', name: 'exec', input: { cmd: 'ls' }, id: 'tc1' },
      { type: 'tool_result', content: 'file.txt', toolUseId: 'tc1' },
    ]);
  });

  it('parses toolCall/toolResult (OpenAI format)', () => {
    const raw = [{
      id: '1', role: 'assistant', timestamp: 1000,
      content: [
        { type: 'toolCall', name: 'read', arguments: { path: '/tmp' }, id: 'tc2' },
        { type: 'toolResult', content: 'data', toolCallId: 'tc2', name: 'read' },
      ],
    }];
    const result = parseHistoryMessages(raw);
    expect(result[0].blocks[0]).toEqual({ type: 'tool_use', name: 'read', input: { path: '/tmp' }, id: 'tc2' });
    expect(result[0].blocks[1]).toEqual({ type: 'tool_result', content: 'data', toolUseId: 'tc2', name: 'read' });
  });

  it('merges toolResult messages into preceding assistant message', () => {
    const raw = [
      { id: '1', role: 'assistant', content: 'thinking...', timestamp: 1000 },
      { id: '2', role: 'toolResult', content: 'result data', toolCallId: 'tc1', timestamp: 1001 },
    ];
    const result = parseHistoryMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('assistant');
    expect(result[0].blocks).toHaveLength(2); // text + tool_result
  });

  it('skips orphan toolResult messages', () => {
    const raw = [
      { id: '1', role: 'toolResult', content: 'orphan', toolCallId: 'tc1', timestamp: 1000 },
      { id: '2', role: 'user', content: 'hello', timestamp: 1001 },
    ];
    const result = parseHistoryMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  it('marks user system events', () => {
    const raw = [{ id: '1', role: 'user', content: '[HEARTBEAT] check', timestamp: 1000 }];
    const result = parseHistoryMessages(raw);
    expect(result[0].isSystemEvent).toBe(true);
  });

  it('generates fallback ids when missing', () => {
    const raw = [{ role: 'user', content: 'no id', timestamp: 1000 }];
    const result = parseHistoryMessages(raw);
    expect(result[0].id).toBe('hist-0');
  });

  it('preserves metadata excluding content/blocks', () => {
    const raw = [{ id: '1', role: 'user', content: 'hi', timestamp: 1000, model: 'gpt-4' }];
    const result = parseHistoryMessages(raw);
    expect(result[0].metadata?.model).toBe('gpt-4');
    expect(result[0].metadata?.content).toBeUndefined();
  });

  it('handles unknown block types gracefully (skips them)', () => {
    const raw = [{
      id: '1', role: 'assistant', timestamp: 1000,
      content: [{ type: 'unknown_type', data: 'foo' }, { type: 'text', text: 'ok' }],
    }];
    const result = parseHistoryMessages(raw);
    expect(result[0].blocks).toHaveLength(1);
    expect(result[0].blocks[0]).toEqual({ type: 'text', text: 'ok' });
  });

  it('handles tool_result with object content (JSON stringified)', () => {
    const raw = [{
      id: '1', role: 'assistant', timestamp: 1000,
      content: [{ type: 'tool_result', content: { key: 'val' }, tool_use_id: 'tc1' }],
    }];
    const result = parseHistoryMessages(raw);
    expect(result[0].blocks[0]).toEqual({
      type: 'tool_result',
      content: JSON.stringify({ key: 'val' }, null, 2),
      toolUseId: 'tc1',
    });
  });
});
