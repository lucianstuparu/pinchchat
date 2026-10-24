/**
 * Search beyond what is on the phone (Lucian 2026-10-24: "a hybrid search both keyword and semantic"):
 * the server's index by words and meaning (register-api /reg/search or /artlia/search, search.mjs),
 * and the whole conversation through the gateway's own transcript index (sessions.search, exact
 * words, accents ignored). Both are asked a moment after typing stops; only the answer for what is
 * typed now counts, and a failure leaves the on-phone results alone.
 */
import { useEffect, useState } from 'react';
import type { GatewayClient } from '../lib/gateway';
import { post } from '../app/api';

export interface ServerHit {
  id: string; kind: 'doc' | 'item' | 'term' | 'task' | 'loop'; ref: string; title: string; snippet: string; updated?: string;
  via: Array<'words' | 'meaning'>;
}
export interface ChatHit { messageId: string; sessionKey: string; role: 'user' | 'assistant'; timestamp: number; snippet: string }
export interface DeepResults { server: ServerHit[]; chat: ChatHit[]; busy: boolean; meaning: boolean; failed: boolean }

const EMPTY: DeepResults = { server: [], chat: [], busy: false, meaning: false, failed: false };

export function useDeepSearch(query: string | null, { path, sessionKey, getClient, delay = 350 }: {
  path: string; sessionKey: string | null; getClient: () => GatewayClient | null; delay?: number;
}): DeepResults {
  // The answer and the words it answers: busy while they differ from what is typed now.
  const [got, setGot] = useState<{ key: string; res: DeepResults } | null>(null);
  const q = (query ?? '').trim();
  const key = `${path}|${sessionKey}|${q}`;
  useEffect(() => {
    if (q.length < 2) return;
    let live = true;
    const t = window.setTimeout(() => {
      const server = post<{ results: ServerHit[]; meaning: boolean }>(path, { q });
      const client = getClient();
      const chat = client && sessionKey
        ? (client.send('sessions.search', { query: q, limit: 20, sessionKeys: [sessionKey] }) as Promise<{ results?: ChatHit[] }>)
        : Promise.resolve({ results: [] as ChatHit[] });
      void Promise.allSettled([server, chat]).then(([s, c]) => {
        if (!live) return;
        setGot({ key, res: {
          server: s.status === 'fulfilled' ? s.value.results ?? [] : [],
          meaning: s.status === 'fulfilled' && !!s.value.meaning,
          chat: c.status === 'fulfilled' ? (c.value.results ?? []).filter(h => h.role === 'user' || h.role === 'assistant') : [],
          busy: false,
          failed: s.status === 'rejected' && c.status === 'rejected',
        } });
      });
    }, delay);
    return () => { live = false; window.clearTimeout(t); };
  }, [key, q, path, sessionKey, getClient, delay]);
  if (q.length < 2) return EMPTY;
  return got?.key === key ? got.res : { ...EMPTY, busy: true };
}
