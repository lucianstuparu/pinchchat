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
    expect(md).toContain('Exported from Chat on');
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

  it('renders tool_result blocks with name in details', () => {
    const md = messagesToMarkdown([makeMessage({
      role: 'assistant',
      content: '',
      blocks: [{ type: 'tool_result', name: 'exec', content: 'file1.txt\nfile2.txt' }],
    })]);
    expect(md).toContain('<details><summary>📋 Result (exec)</summary>');
    expect(md).toContain('file1.txt\nfile2.txt');
  });

  it('renders tool_result blocks without name', () => {
    const md = messagesToMarkdown([makeMessage({
      role: 'assistant',
      content: '',
      blocks: [{ type: 'tool_result', content: 'some output' }],
    })]);
    expect(md).toContain('<details><summary>📋 Result</summary>');
  });

  it('skips tool_result blocks with no content', () => {
    const md = messagesToMarkdown([makeMessage({
      role: 'assistant',
      content: '',
      blocks: [{ type: 'tool_result', name: 'exec', content: '' }],
    })]);
    expect(md).not.toContain('📋 Result');
  });

  it('truncates long tool_result content to 5000 chars', () => {
    const longContent = 'x'.repeat(6000);
    const md = messagesToMarkdown([makeMessage({
      role: 'assistant',
      content: '',
      blocks: [{ type: 'tool_result', content: longContent }],
    })]);
    // The content inside the code block should be sliced to 5000
    const codeBlockMatch = md.match(/```\n([\s\S]*?)\n```/);
    expect(codeBlockMatch).toBeTruthy();
    expect(codeBlockMatch![1].length).toBe(5000);
  });

  it('renders tool_use blocks without input json when input is empty', () => {
    const md = messagesToMarkdown([makeMessage({
      role: 'assistant',
      content: '',
      blocks: [{ type: 'tool_use', name: 'read', input: {} }],
    })]);
    expect(md).toContain('`read`');
    expect(md).not.toContain('```json');
  });

  it('omits session label heading when not provided', () => {
    const md = messagesToMarkdown([]);
    expect(md).not.toMatch(/^# /);
  });

  it('renders multiple blocks in sequence', () => {
    const md = messagesToMarkdown([makeMessage({
      role: 'assistant',
      content: '',
      blocks: [
        { type: 'text', text: 'Starting...' },
        { type: 'tool_use', name: 'exec', input: { command: 'ls' } },
        { type: 'tool_result', name: 'exec', content: 'output' },
        { type: 'text', text: 'Done!' },
      ],
    })]);
    expect(md).toContain('Starting...');
    expect(md).toContain('`exec`');
    expect(md).toContain('📋 Result (exec)');
    expect(md).toContain('Done!');
  });
});

