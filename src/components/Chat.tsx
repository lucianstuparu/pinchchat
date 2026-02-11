import { useEffect, useRef } from 'react';
import { ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import type { ChatMessage, ConnectionStatus } from '../types';
import { Bot } from 'lucide-react';

interface Props {
  messages: ChatMessage[];
  isGenerating: boolean;
  status: ConnectionStatus;
  onSend: (text: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => void;
  onAbort: () => void;
}

function hasVisibleContent(msg: ChatMessage): boolean {
  if (msg.role === 'user') return true;
  if (msg.blocks.length === 0) return !!msg.content;
  // Show all assistant messages — tool-only ones render as compact inline
  return msg.blocks.some(b =>
    (b.type === 'text' && b.text.trim()) ||
    b.type === 'thinking' ||
    b.type === 'tool_use' ||
    b.type === 'tool_result'
  );
}

function hasStreamedText(messages: ChatMessage[]): boolean {
  if (messages.length === 0) return false;
  const last = messages[messages.length - 1];
  if (last.role !== 'assistant') return false;
  return last.blocks.some(b => b.type === 'text' && b.text.trim().length > 0) || (last.content?.trim().length > 0);
}

export function Chat({ messages, isGenerating, status, onSend, onAbort }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const showTyping = isGenerating && !hasStreamedText(messages);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500">
              <div className="relative mb-6">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-400/10 via-indigo-500/10 to-violet-500/10 blur-2xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-white/8 bg-zinc-800/40">
                  <Bot className="h-8 w-8 text-cyan-200" />
                </div>
              </div>
              <div className="text-lg text-zinc-200 font-semibold">ClawChat</div>
              <div className="text-sm mt-1 text-zinc-500">Envoie un message pour commencer</div>
            </div>
          )}
          {messages.filter(hasVisibleContent).map(msg => (
            <ChatMessageComponent key={msg.id} message={msg} />
          ))}
          {showTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>
      <ChatInput onSend={onSend} onAbort={onAbort} isGenerating={isGenerating} disabled={status !== 'connected'} />
    </div>
  );
}
