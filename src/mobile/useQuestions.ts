/**
 * Native OpenClaw ask_user questions (gateway >= 2026.7 protocol).
 *
 * Events:  question.requested (QuestionRecord), question.resolved ({ id, status })
 * Methods: question.list {} -> { questions }, question.resolve
 *          { id, answers: { answers: { [questionId]: string[] } } } | { id, cancel: true }
 *
 * Built on useGateway's getClient/addEventListener so the upstream hook stays
 * untouched. Older gateways simply never emit these events and reject
 * question.list; both are handled as "no questions".
 */
import { useCallback, useEffect, useState } from 'react';
import type { GatewayClient, JsonPayload } from '../lib/gateway';
import type { ConnectionStatus } from '../types';

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionItem {
  questionId: string;
  header?: string;
  question: string;
  url?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  isOther?: boolean;
  isSecret?: boolean;
}

export interface QuestionRecord {
  id: string;
  questions: QuestionItem[];
  agentId?: string;
  sessionKey?: string;
  runId?: string;
  createdAtMs: number;
  expiresAtMs: number;
  status: 'pending' | 'answered' | 'cancelled' | 'expired';
}

interface Deps {
  status: ConnectionStatus;
  activeSession: string;
  getClient: () => GatewayClient | null;
  addEventListener: (fn: (event: string, payload: JsonPayload) => void) => () => void;
}

function isRecord(v: unknown): v is QuestionRecord {
  const r = v as QuestionRecord;
  return !!r && typeof r.id === 'string' && Array.isArray(r.questions);
}

/** Session keys can arrive canonical or aliased; compare on the agent+name tail. */
function sameSession(a?: string, b?: string): boolean {
  if (!a || !b) return true; // unscoped questions are shown everywhere
  return a === b || a.endsWith(':' + b.split(':').slice(-2).join(':'));
}

export function useQuestions({ status, activeSession, getClient, addEventListener }: Deps) {
  const [pending, setPending] = useState<QuestionRecord[]>([]);

  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;

    getClient()?.send('question.list', {})
      .then(res => {
        if (cancelled) return;
        const list = (res.questions as unknown[] | undefined) ?? [];
        setPending(list.filter(isRecord).filter(q => q.status === 'pending'));
      })
      .catch(() => { /* gateway without question support */ });

    const off = addEventListener((event, payload) => {
      if (event === 'question.requested' && isRecord(payload)) {
        setPending(prev => [...prev.filter(q => q.id !== payload.id), payload]);
      } else if (event === 'question.resolved' && typeof payload.id === 'string') {
        setPending(prev => prev.filter(q => q.id !== payload.id));
      }
    });
    return () => { cancelled = true; off(); };
  }, [status, getClient, addEventListener]);

  // Drop questions as they expire
  useEffect(() => {
    if (pending.length === 0) return;
    const next = Math.min(...pending.map(q => q.expiresAtMs));
    const t = setTimeout(() => setPending(prev => prev.filter(q => q.expiresAtMs > Date.now())), Math.max(0, next - Date.now()) + 250);
    return () => clearTimeout(t);
  }, [pending]);

  const answer = useCallback(async (id: string, answers: Record<string, string[]>) => {
    await getClient()?.send('question.resolve', { id, answers: { answers } });
    setPending(prev => prev.filter(q => q.id !== id));
  }, [getClient]);

  const skip = useCallback(async (id: string) => {
    await getClient()?.send('question.resolve', { id, cancel: true });
    setPending(prev => prev.filter(q => q.id !== id));
  }, [getClient]);

  const visible = pending.filter(q => sameSession(q.sessionKey, activeSession));
  return { questions: visible, answer, skip };
}
