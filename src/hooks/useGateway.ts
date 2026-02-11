import { useState, useEffect, useRef, useCallback } from 'react';
import { GatewayClient } from '../lib/gateway';
import { genIdempotencyKey } from '../lib/utils';
import type { ChatMessage, MessageBlock, ConnectionStatus, Session } from '../types';

function extractText(message: any): string {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n');
  }
  return '';
}

export function useGateway() {
  const clientRef = useRef<GatewayClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState('agent:main:main');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;
  const currentRunIdRef = useRef<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const client = new GatewayClient();
    clientRef.current = client;

    client.onStatus((s) => {
      setStatus(s);
      if (s === 'connected') {
        loadSessions();
        loadHistory(activeSessionRef.current);
      }
    });

    client.onEvent((event, payload) => {
      if (event === 'agent') {
        // Tool stream events
        handleAgentEvent(payload);
        return;
      }
      if (event !== 'chat') return;

      const { state, runId, message, errorMessage, sessionKey: evtSession } = payload;

      // Track active/inactive sessions globally
      if (evtSession) {
        if (state === 'delta') {
          setActiveSessions(prev => {
            if (prev.has(evtSession)) return prev;
            const next = new Set(prev);
            next.add(evtSession);
            return next;
          });
        } else if (state === 'final' || state === 'error' || state === 'aborted') {
          setActiveSessions(prev => {
            if (!prev.has(evtSession)) return prev;
            const next = new Set(prev);
            next.delete(evtSession);
            return next;
          });
        }
      }

      if (evtSession !== activeSessionRef.current) return;

      if (state === 'delta') {
        const text = extractText(message);
        currentRunIdRef.current = runId;

        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming && last.runId === runId) {
            // Update text block but preserve tool/thinking blocks
            const updated = { ...last };
            updated.content = text;
            const nonTextBlocks = updated.blocks.filter(b => b.type !== 'text');
            updated.blocks = [...nonTextBlocks, { type: 'text' as const, text }];
            return [...prev.slice(0, -1), updated];
          }
          // Create new streaming message
          const msg: ChatMessage = {
            id: runId + '-' + Date.now(),
            role: 'assistant',
            content: text,
            timestamp: Date.now(),
            blocks: [{ type: 'text', text }],
            isStreaming: true,
            runId,
          };
          return [...prev, msg];
        });
      } else if (state === 'final') {
        currentRunIdRef.current = null;
        setIsGenerating(false);
        // Reload full history to get the proper final messages with tool calls etc.
        loadHistory(activeSessionRef.current);
      } else if (state === 'error') {
        currentRunIdRef.current = null;
        setIsGenerating(false);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming && last.runId === runId) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
          }
          return [...prev, {
            id: 'error-' + Date.now(),
            role: 'assistant' as const,
            content: `Error: ${errorMessage || 'unknown error'}`,
            timestamp: Date.now(),
            blocks: [{ type: 'text' as const, text: `Error: ${errorMessage || 'unknown error'}` }],
          }];
        });
      } else if (state === 'aborted') {
        currentRunIdRef.current = null;
        setIsGenerating(false);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
          }
          return prev;
        });
      }
    });

    client.connect();
    return () => client.disconnect();
  }, []);

  const handleAgentEvent = useCallback((payload: any) => {
    // Handle tool stream events from agent stream
    if (payload?.stream !== 'tool') return;
    const data = payload.data ?? {};
    const phase = data.phase;
    const toolCallId = data.toolCallId;
    const name = data.name || 'tool';
    if (!toolCallId) return;

    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant' || !last.isStreaming) return prev;

      const updated = { ...last, blocks: [...last.blocks] };

      if (phase === 'start') {
        updated.blocks.push({
          type: 'tool_use' as const,
          name,
          input: data.args,
          id: toolCallId,
        });
      } else if (phase === 'result') {
        const result = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
        updated.blocks.push({
          type: 'tool_result' as const,
          content: result?.slice(0, 500) || '',
          toolUseId: toolCallId,
          name,
        });
      }

      return [...prev.slice(0, -1), updated];
    });
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await clientRef.current?.send('sessions.list', {});
      if (res?.sessions) {
        setSessions(res.sessions.map((s: any) => ({
          key: s.key || s.sessionKey,
          label: s.label || s.key || s.sessionKey,
          messageCount: s.messageCount,
          totalTokens: s.totalTokens,
          contextTokens: s.contextTokens,
          inputTokens: s.inputTokens,
          outputTokens: s.outputTokens,
        })));
      }
    } catch {}
  }, []);

  const loadHistory = useCallback(async (sessionKey: string) => {
    try {
      const res = await clientRef.current?.send('chat.history', { sessionKey, limit: 100 });
      if (res?.messages) {
        const rawMsgs: any[] = res.messages;
        const msgs: ChatMessage[] = rawMsgs.map((m: any, i: number) => {
          const blocks: MessageBlock[] = [];
          if (m.content) {
            if (Array.isArray(m.content)) {
              for (const block of m.content) {
                if (block.type === 'text') blocks.push({ type: 'text', text: block.text });
                else if (block.type === 'thinking') blocks.push({ type: 'thinking', text: block.thinking || block.text || '' });
                // Anthropic format
                else if (block.type === 'tool_use') blocks.push({ type: 'tool_use', name: block.name, input: block.input, id: block.id });
                else if (block.type === 'tool_result') blocks.push({ type: 'tool_result', content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2), toolUseId: block.tool_use_id });
                // OpenClaw gateway format (toolCall / toolResult)
                else if (block.type === 'toolCall') blocks.push({ type: 'tool_use', name: block.name, input: block.arguments || block.input, id: block.id });
                else if (block.type === 'toolResult') blocks.push({ type: 'tool_result', content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2), toolUseId: block.toolCallId || block.tool_use_id, name: block.name });
              }
            } else if (typeof m.content === 'string') {
              blocks.push({ type: 'text', text: m.content });
            }
          }
          // Map gateway roles to our simplified roles
          const role: 'user' | 'assistant' = m.role === 'user' ? 'user' : 'assistant';

          // toolResult role messages: convert text blocks to tool_result blocks, then merge into previous assistant
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

          return {
            id: m.id || `hist-${i}`,
            role,
            content: blocks.filter(b => b.type === 'text').map(b => (b as any).text).join(''),
            timestamp: m.timestamp || Date.now(),
            blocks,
          };
        });
        // Merge toolResult messages into their preceding assistant message
        const merged: ChatMessage[] = [];
        for (const msg of msgs) {
          if ((msg as any).isToolResult && merged.length > 0 && merged[merged.length - 1].role === 'assistant') {
            merged[merged.length - 1] = {
              ...merged[merged.length - 1],
              blocks: [...merged[merged.length - 1].blocks, ...msg.blocks],
            };
          } else if ((msg as any).isToolResult) {
            // Orphan toolResult — skip or show as assistant
            // skip it
          } else {
            merged.push(msg);
          }
        }
        setMessages(merged);
      }
    } catch {}
  }, []);

  const sendMessage = useCallback(async (text: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => {
    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      blocks: [{ type: 'text', text }],
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      await clientRef.current?.send('chat.send', {
        sessionKey: activeSessionRef.current,
        message: text,
        deliver: false,
        idempotencyKey: genIdempotencyKey(),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      });
    } catch (e) {
      setIsGenerating(false);
    }
  }, []);

  const abort = useCallback(async () => {
    try {
      await clientRef.current?.send('chat.abort', { sessionKey: activeSessionRef.current });
    } catch {}
    setIsGenerating(false);
  }, []);

  const switchSession = useCallback((key: string) => {
    setActiveSession(key);
    activeSessionRef.current = key;
    setMessages([]);
    loadHistory(key);
  }, [loadHistory]);

  // Periodic session refresh every 30s
  useEffect(() => {
    if (status !== 'connected') return;
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, [status, loadSessions]);

  // Merge active state into sessions
  const enrichedSessions = sessions.map(s => ({
    ...s,
    isActive: activeSessions.has(s.key),
  }));

  return { status, messages, sessions: enrichedSessions, activeSession, isGenerating, sendMessage, abort, switchSession, loadSessions };
}
