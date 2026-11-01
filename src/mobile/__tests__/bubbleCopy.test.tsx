/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import type { ChatMessage } from '../../types';

void React;
const msg = (role: 'user' | 'assistant', content: string): ChatMessage =>
  ({ id: 'm1', role, content, timestamp: Date.now(), blocks: [{ type: 'text', text: content }] } as ChatMessage);

describe('MessageBubble copy buttons', () => {
  it('puts a copy button after each value in a reply', async () => {
    render(<MessageBubble msg={msg('assistant', 'Mail service@sfr.fr, ref FR123456, `12 rue de la Paix`, https://sfr.fr/x')} onReply={() => undefined} />);
    for (const v of ['service@sfr.fr', 'FR123456', '12 rue de la Paix', 'https://sfr.fr/x'])
      expect(await screen.findByRole('button', { name: `Copy ${v}` })).toBeDefined();
  });
  it('lets a mouse select the text (the no-select rule is for touch only)', async () => {
    const { container } = render(<MessageBubble msg={msg('assistant', 'Hello')} onReply={() => undefined} />);
    await screen.findByText('Hello');
    const cls = container.querySelector('[data-text]')!.parentElement!.className;
    expect(cls).not.toMatch(/(^|\s)select-none/);
    expect(cls).toContain('[@media(pointer:coarse)]:select-none');
  });
});
