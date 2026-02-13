import { describe, it, expect, vi } from 'vitest';
import { messagesToMarkdown } from '../exportChat';
import type { ChatMessage } from '../../types';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: '1',
    role: 'user',
    content: 'Hello world',
    timestamp: new Date('2026-01-15T10:30:00Z').getTime(),
    blocks: [],
    isSystemEvent: false,
    ...overrides,
  } as ChatMessage;
}

describe('messagesToMarkdown', () => {
  it('includes session label as heading', () => {
    const md = messagesToMarkdown([], 'Test Session');
    expect(md).toContain('# Test Session');
  });

  it('includes export timestamp', () => {
    const md = messagesToMarkdown([]);
    expect(md).toContain('Exported from PinchChat on');
  });

  it('labels user messages with 👤 User', () => {
    const md = messagesToMarkdown([makeMessage({ role: 'user' })]);
    expect(md).toContain('👤 User');
  });

  it('labels assistant messages with 🤖 Assistant', () => {
    const md = messagesToMarkdown([makeMessage({ role: 'assistant' })]);
    expect(md).toContain('🤖 Assistant');
  });

  it('labels system events with ⚙️ System Event', () => {
    const md = messagesToMarkdown([makeMessage({ role: 'user', isSystemEvent: true })]);
    expect(md).toContain('⚙️ System Event');
  });

  it('renders text blocks', () => {
    const md = messagesToMarkdown([makeMessage({
      content: '',
      blocks: [{ type: 'text', text: 'Some content here' }],
    })]);
    expect(md).toContain('Some content here');
  });

  it('renders tool_use blocks with name and input', () => {
    const md = messagesToMarkdown([makeMessage({
      role: 'assistant',
      content: '',
      blocks: [{ type: 'tool_use', name: 'exec', input: { command: 'ls' } }],
    })]);
    expect(md).toContain('`exec`');
    expect(md).toContain('"command": "ls"');
  });

  it('falls back to content when blocks are empty', () => {
    const md = messagesToMarkdown([makeMessage({ content: 'Fallback text', blocks: [] })]);
    expect(md).toContain('Fallback text');
  });

  it('renders image blocks as placeholder', () => {
    const md = messagesToMarkdown([makeMessage({
      content: '',
      blocks: [{ type: 'image', mediaType: 'image/png' }],
    })]);
    expect(md).toContain('*[Image]*');
  });

  it('wraps thinking blocks in details tags', () => {
    vi.stubGlobal('Date', globalThis.Date);
    const md = messagesToMarkdown([makeMessage({
      role: 'assistant',
      content: '',
      blocks: [{ type: 'thinking', text: 'Let me think...' }],
    })]);
    expect(md).toContain('<details><summary>💭 Thinking</summary>');
    expect(md).toContain('Let me think...');
  });
});
