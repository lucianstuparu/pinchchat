import { describe, it, expect } from 'vitest';
import { extractText, extractThinking } from '../messageExtract';

describe('extractText', () => {
  it('returns empty string for undefined', () => {
    expect(extractText(undefined)).toBe('');
  });

  it('returns empty string for empty message', () => {
    expect(extractText({})).toBe('');
  });

  it('returns string content directly', () => {
    expect(extractText({ content: 'hello world' })).toBe('hello world');
  });

  it('extracts text blocks from array content', () => {
    expect(extractText({
      content: [
        { type: 'text', text: 'hello' },
        { type: 'thinking', thinking: 'hmm' },
        { type: 'text', text: 'world' },
      ],
    })).toBe('hello\nworld');
  });

  it('ignores non-text blocks', () => {
    expect(extractText({
      content: [
        { type: 'thinking', text: 'reasoning' },
        { type: 'image', text: 'img' },
      ],
    })).toBe('');
  });

  it('skips text blocks with undefined text', () => {
    expect(extractText({
      content: [
        { type: 'text' },
        { type: 'text', text: 'ok' },
      ],
    })).toBe('ok');
  });

  it('returns empty string for non-string non-array content', () => {
    expect(extractText({ content: 42 as unknown as string })).toBe('');
  });
});

describe('extractThinking', () => {
  it('returns empty string for undefined', () => {
    expect(extractThinking(undefined)).toBe('');
  });

  it('returns empty string for string content', () => {
    expect(extractThinking({ content: 'hello' })).toBe('');
  });

  it('extracts thinking blocks using thinking field', () => {
    expect(extractThinking({
      content: [
        { type: 'text', text: 'hello' },
        { type: 'thinking', thinking: 'let me think' },
      ],
    })).toBe('let me think');
  });

  it('falls back to text field when thinking is absent', () => {
    expect(extractThinking({
      content: [
        { type: 'thinking', text: 'fallback' },
      ],
    })).toBe('fallback');
  });

  it('joins multiple thinking blocks', () => {
    expect(extractThinking({
      content: [
        { type: 'thinking', thinking: 'step 1' },
        { type: 'thinking', thinking: 'step 2' },
      ],
    })).toBe('step 1\nstep 2');
  });

  it('returns empty string for thinking block with no content', () => {
    expect(extractThinking({
      content: [{ type: 'thinking' }],
    })).toBe('');
  });
});
