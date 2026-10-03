/**
 * Messenger-style client for OpenClaw: one conversation, bubbles, a composer.
 * Everything protocol-related comes from the upstream useGateway hook; this
 * file is presentation plus three behaviours upstream does not have:
 * a persisted outbox, Share Sheet import, and native ask_user choice cards.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, MoreVertical } from 'lucide-react';
import { useGateway } from '../hooks/useGateway';
import { useNotifications, setBaseTitle } from '../hooks/useNotifications';
import { LoginScreen } from '../components/LoginScreen';
import { getStoredCredentials } from '../lib/credentials';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { collapseCliTurns, isShownInMessenger, visibleText, withoutLeadingQuote } from './messageView';
import { Composer, type ComposerPrefill } from './Composer';
import { QuestionCard } from './QuestionCard';
import { useQuestions } from './useQuestions';
import { switchUiMode } from './uiMode';
import { WARM_VARS, useWarmChrome } from './warmTheme';
import type { OutgoingAttachment } from './attachments';
import { clearShareParam, pendingShareId, takeSharedContent } from '../share/shareInbox';

const OUTBOX_KEY = 'openclaw-pwa:outbox';

interface OutboxItem {
  id: string;
  text: string;
  attachments: OutgoingAttachment[];
  queuedAt: number;
}

/** Text survives a reload; attachments are memory-only (they can exceed storage quotas). */
function loadOutbox(): OutboxItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') as Array<Omit<OutboxItem, 'attachments'> & { hadAttachments?: boolean }>;
    return raw.map(r => ({ id: r.id, text: r.text, attachments: [], queuedAt: r.queuedAt }));
  } catch {
    return [];
  }
}

function saveOutbox(items: OutboxItem[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.map(i => ({ id: i.id, text: i.text, queuedAt: i.queuedAt, hadAttachments: i.attachments.length > 0 }))));
  } catch {
    // Storage full or unavailable — the in-memory queue still works for this session
  }
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export default function MobileApp() {
  const gw = useGateway();
  useWarmChrome();
  return <div style={WARM_VARS} className="bg-pc-base text-pc-text">{mobileScreen(gw)}</div>;
}

function mobileScreen(gw: ReturnType<typeof useGateway>) {
  if (gw.authenticated === null) {
    return <div className="h-dvh flex items-center justify-center bg-pc-base text-pc-text-muted text-sm">Connecting…</div>;
  }
  // Upstream treats any failed first connect as "not logged in". On a phone that
  // is usually just no signal: with saved credentials and a plain network failure
  // stay in the conversation (offline, outbox working) while the client keeps
  // reconnecting. Only a real auth rejection, or no saved login, shows the form.
  const savedLogin = getStoredCredentials() !== null;
  const networkOnly = !gw.connectError || gw.connectError.startsWith('Connection failed');
  if (!gw.authenticated && !(savedLogin && networkOnly)) {
    return <LoginScreen onConnect={gw.login} error={gw.connectError} isConnecting={gw.isConnecting} />;
  }
  return <MobileChat gw={gw} />;
}

function MobileChat({ gw }: { gw: ReturnType<typeof useGateway> }) {
  const { status, messages, isGenerating, isLoadingHistory, activeSession, sendMessage, createNewSession, logout, getClient, addEventListener } = gw;
  const [menuOpen, setMenuOpen] = useState(false);
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null);
  const [hint, setHint] = useState<string | null>(() => (pendingShareId() === 'failed' ? 'Could not read the shared content.' : null));
  const [outbox, setOutbox] = useState<OutboxItem[]>(loadOutbox);
  const [atBottom, setAtBottom] = useState(true);
  const [replyTo, setReplyTo] = useState<{ text: string; mine: boolean } | null>(null);
  const onReply = useCallback((msg: ChatMessage) => {
    setReplyTo({ text: withoutLeadingQuote(visibleText(msg)) || '📷 Photo', mine: msg.role === 'user' });
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentAttachments = useRef(new Map<string, OutgoingAttachment[]>());
  const flushing = useRef(false);

  const { questions, answer, skip } = useQuestions({ status, activeSession, getClient, addEventListener });
  const { notify } = useNotifications();

  useEffect(() => setBaseTitle(), []);

  // ---- Share Sheet import (once per load) --------------------------------
  useEffect(() => {
    const id = pendingShareId();
    if (!id) return;
    clearShareParam();
    if (id === 'failed') return; // hint already set by the useState initializer
    void takeSharedContent(id).then(shared => {
      if (!shared) {
        setHint('The shared content has expired.');
        return;
      }
      setPrefill({ nonce: Date.now(), text: shared.text, attachments: shared.attachments });
      setHint(shared.rejected.length > 0
        ? `Shared — could not attach: ${shared.rejected.join(', ')}`
        : 'Shared — add a note, then send.');
    });
  }, []);

  // ---- Outbox: never lose a message typed while offline -------------------
  useEffect(() => saveOutbox(outbox), [outbox]);

  useEffect(() => {
    if (status !== 'connected' || outbox.length === 0 || flushing.current) return;
    flushing.current = true;
    void (async () => {
      for (const item of outbox) {
        if (item.attachments.length > 0) sentAttachments.current.set(item.text, item.attachments);
        await sendMessage(item.text, item.attachments.map(({ mimeType, fileName, content }) => ({ mimeType, fileName, content })));
        setOutbox(prev => prev.filter(p => p.id !== item.id));
      }
      flushing.current = false;
      // Items queued while this flush ran were skipped by the guard — re-run for them
      setOutbox(prev => (prev.length > 0 ? [...prev] : prev));
    })();
  }, [status, outbox, sendMessage]);

  const send = useCallback((text: string, attachments: OutgoingAttachment[]) => {
    if (status !== 'connected') {
      setOutbox(prev => [...prev, { id: 'q-' + Date.now(), text, attachments, queuedAt: Date.now() }]);
      return;
    }
    if (attachments.length > 0) sentAttachments.current.set(text, attachments);
    void sendMessage(text, attachments.map(({ mimeType, fileName, content }) => ({ mimeType, fileName, content })));
  }, [status, sendMessage]);

  const retry = useCallback((msg: ChatMessage) => {
    const text = visibleText(msg);
    setPrefill({ nonce: Date.now(), text, attachments: sentAttachments.current.get(text) ?? [] });
    setHint('Not sent — check it and send again.');
  }, []);

  // ---- Notifications while the app is in the background ------------------
  const prevCount = useRef(messages.length);
  useEffect(() => {
    const before = prevCount.current;
    prevCount.current = messages.length;
    if (messages.length <= before) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !last.isStreaming && isShownInMessenger(last)) {
      notify('OpenClaw', visibleText(last).slice(0, 120) || 'New message');
    }
  }, [messages, notify]);

  // ---- Scrolling -----------------------------------------------------------
  const shown = useMemo(() => collapseCliTurns(messages).filter(isShownInMessenger), [messages]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (atBottom) scrollToBottom(false);
  }, [shown, outbox, questions, atBottom, scrollToBottom]);

  // Keep the latest message visible when the on-screen keyboard resizes the viewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => { if (atBottom) scrollToBottom(false); };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [atBottom, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const subtitle =
    status === 'connected'
      ? (isGenerating ? 'typing…' : 'online')
      : status === 'connecting'
        ? 'connecting…'
        : status === 'pairing'
          ? 'waiting for pairing approval'
          : outbox.length > 0 ? `offline — ${outbox.length} waiting to send` : 'offline';

  return (
    <div className="relative h-dvh flex flex-col bg-pc-base text-pc-text overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-3 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] bg-pc-surface border-b border-pc-border">
        <img src="/logo-192.png" alt="" className="h-9 w-9 rounded-full" />
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold leading-tight">OpenClaw</h1>
          <p className={`text-xs leading-tight ${status === 'connected' ? 'text-pc-text-muted' : 'text-amber-600'}`}>{subtitle}</p>
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen(o => !o)} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-[var(--pc-hover)]" aria-label="Menu" aria-expanded={menuOpen}>
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-56 rounded-xl border border-pc-border bg-pc-elevated shadow-lg py-1 text-[15px]">
                <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={() => { setMenuOpen(false); void createNewSession(); }}>New conversation</button>
                <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={() => switchUiMode('full')}>Advanced (full PinchChat)</button>
                <button type="button" className="w-full text-left px-4 py-2.5 text-red-500 hover:bg-[var(--pc-hover)]" onClick={() => { setMenuOpen(false); logout(); }}>Log out</button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Conversation */}
      <main ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1" role="log" aria-live="polite">
        {isLoadingHistory && shown.length === 0 && <p className="text-center text-xs text-pc-text-muted py-6">Loading…</p>}
        {!isLoadingHistory && shown.length === 0 && outbox.length === 0 && (
          <p className="text-center text-sm text-pc-text-muted px-8 py-10">Send anything — a note, a link, a photo. Shared items from other apps land here too.</p>
        )}

        {shown.map((msg, i) => {
          const prev = shown[i - 1];
          const newDay = !prev || new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
          return (
            <div key={msg.id}>
              {newDay && (
                <div className="flex justify-center py-2">
                  <span className="rounded-lg bg-pc-surface px-3 py-1 text-[12px] text-pc-text-muted shadow-sm">{dayLabel(msg.timestamp)}</span>
                </div>
              )}
              <MessageBubble msg={msg} onRetry={retry} onReply={onReply} />
            </div>
          );
        })}

        {outbox.map(item => (
          <MessageBubble
            key={item.id}
            msg={{ id: item.id, role: 'user', content: item.text, timestamp: item.queuedAt, blocks: [{ type: 'text', text: item.text || `📎 ${item.attachments.length} attachment(s)` }], sendStatus: 'sending' }}
          />
        ))}

        {questions.map(q => <QuestionCard key={q.id} record={q} onAnswer={answer} onSkip={skip} />)}
      </main>

      {!atBottom && (
        <button type="button" onClick={() => scrollToBottom()} className="absolute right-4 bottom-24 z-10 h-10 w-10 rounded-full bg-pc-surface border border-pc-border shadow-md flex items-center justify-center" aria-label="Scroll to latest">
          <ArrowDown size={18} />
        </button>
      )}

      <Composer
        key={prefill?.nonce ?? 0}
        onSend={send}
        prefill={prefill}
        hint={hint}
        onHintDismiss={() => setHint(null)}
        replyTo={replyTo}
        onReplyCancel={() => setReplyTo(null)}
      />
    </div>
  );
}
