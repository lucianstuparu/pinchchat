import { describe, it, expect } from 'vitest';
import { dropRepeatedFailures, failedTurn, isLong, stripSystemPreamble, voiceMessage } from '../notice';
import { visibleText } from '../messageView';
import type { ChatMessage } from '../../types';

const sys = [
  'OpenClaw resumed this CLI session after prompt content changed. Follow the current turn\'s instructions; changed=prompt-tools.',
  '',
  'System: [2026-10-22 13:28:51 UTC] WhatsApp gateway disconnected (status 428)',
  'System: [2026-10-22 13:28:54 UTC] WhatsApp gateway connected as +40700000000.',
  'System: <untrusted-text>',
  'System: </untrusted-text>',
].join('\n');

describe('gateway preamble', () => {
  it('drops the system lines in front of a message and keeps the message', () => {
    expect(stripSystemPreamble(`${sys}\n\nNote this, for when I may install a heat pump`)).toBe('Note this, for when I may install a heat pump');
  });

  it('leaves a message alone when it does not start with them', () => {
    const t = 'Remind me\n\nSystem: is a word I typed';
    expect(stripSystemPreamble(t)).toBe(t);
  });

  it('a message that is only system lines shows nothing', () => {
    expect(stripSystemPreamble(sys)).toBe('');
  });

  it('is applied to user messages in the messenger, around the webchat envelope too', () => {
    const m: ChatMessage = { id: 'u', role: 'user', content: '', timestamp: 0,
      blocks: [{ type: 'text', text: `${sys}\n\n[Thu 2026-10-22 13:30 UTC] Scrie la SFR` }] };
    expect(visibleText(m)).toBe('Scrie la SFR');
  });
});

describe('failed turns', () => {
  it('reads as one line with the cause; the full text stays as detail', () => {
    const n = failedTurn('This turn ended before a reply: Failed to authenticate: OAuth session expired and could not be refreshed');
    expect(n?.summary).toBe('No reply · sign-in expired');
    expect(n?.detail).toBe('Failed to authenticate: OAuth session expired and could not be refreshed');
  });

  it('knows limits, timeouts and the busy server; anything else is generic', () => {
    expect(failedTurn('Error: 429 rate_limit_error')?.summary).toBe('No reply · usage limit reached');
    expect(failedTurn('This turn ended before a reply: request timed out')?.summary).toBe('No reply · took too long');
    expect(failedTurn('The turn was interrupted while the server was busy. Check its status before trying again.')?.summary)
      .toMatch(/server was busy/);
    expect(failedTurn('Error: weird')?.summary).toBe('No reply · something went wrong');
  });

  it('ordinary replies are not failures', () => {
    expect(failedTurn('✓ 29 Cumpără sare · la Carrefour')).toBeNull();
  });
});

describe('folding', () => {
  it('folds long text, by length or by lines', () => {
    expect(isLong('a'.repeat(421))).toBe(true);
    expect(isLong(Array(9).fill('x').join('\n'))).toBe(true);
    expect(isLong('✓ done')).toBe(false);
  });
});

describe('the same failure twice', () => {
  it('the bare error after the notice is left out; real replies stay', () => {
    const msgs = ['This turn ended before a reply: Failed to authenticate: OAuth session expired', 'Failed to authenticate: OAuth session expired', 'ok', 'Error: 429'];
    expect(dropRepeatedFailures(msgs, m => m)).toEqual([msgs[0], 'ok', 'Error: 429']);
  });
});

describe('voice messages', () => {
  it('reads the words said, and knows the older caption without words', () => {
    expect(voiceMessage('Voice message: cumpar lapte')).toEqual({ said: 'cumpar lapte' });
    expect(voiceMessage('Voice message')).toEqual({ said: '' });
    expect(voiceMessage('\u{1F3A4} Voice note')).toEqual({ said: '' });
    expect(voiceMessage('A voice message about milk')).toBeNull();
  });
});
