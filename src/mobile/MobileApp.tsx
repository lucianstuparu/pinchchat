/**
 * Messenger-style client for OpenClaw: one conversation, bubbles, a composer.
 * Everything protocol-related comes from the upstream useGateway hook; this
 * file is presentation plus three behaviours upstream does not have:
 * a persisted outbox, Share Sheet import, and native ask_user choice cards.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
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
import { disablePush, enablePush, getPushState, type PushState } from './pushNotifications';
import type { OutgoingAttachment } from './attachments';
import { clearShareParam, pendingShareId, takeSharedContent } from '../share/shareInbox';
import { fetchPerson, loadAgentId, messengerAgents, saveAgentId, type MessengerAgent } from './agents';
import { TopBar } from './TopBar';
import { searchMessages, snippet } from './searchMessages';

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
  const { status, messages, isLoadingHistory, activeSession, sendMessage, createNewSession, logout, getClient, addEventListener, switchSession } = gw;
  const [person, setPerson] = useState<string | null>(null); // null until /whoami answered
  useEffect(() => { void fetchPerson().then(setPerson); }, []);
  const agents = useMemo(() => messengerAgents(gw.agents, person ?? ''), [gw.agents, person]);
  const ready = gw.agents.length > 0 && person !== null; // we know whose Inbox this is
  const INBOX = agents[0];
  const agent = agents.find(a => a.session === activeSession) ?? INBOX;
  const chooseAgent = useCallback((next: MessengerAgent) => {
    saveAgentId(next.id);
    if (next.session !== activeSession) switchSession(next.session);
  }, [activeSession, switchSession]);
  const [search, setSearch] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null);
  const [hint, setHint] = useState<string | null>(() => (pendingShareId() === 'failed' ? 'Could not read the shared content.' : null));
  const [outbox, setOutbox] = useState<OutboxItem[]>(loadOutbox);
  const [atBottom, setAtBottom] = useState(true);
  const [replyTo, setReplyTo] = useState<{ text: string; mine: boolean } | null>(null);
  const onReply = useCallback((msg: ChatMessage) => {
    setReplyTo({ text: withoutLeadingQuote(visibleText(msg)) || '📷 Photo', mine: msg.role === 'user' });
  }, []);
  const [pushState, setPushState] = useState<PushState | 'busy'>('off');
  useEffect(() => { void getPushState().then(setPushState).catch(() => setPushState('unsupported')); }, []);
  const togglePush = useCallback(async () => {
    const from = pushState;
    setPushState('busy');
    try {
      setPushState(from === 'on' ? await disablePush() : await enablePush());
    } catch (e) {
      setPushState(from);
      setHint(e instanceof Error ? e.message : 'Could not change notifications.');
    }
  }, [pushState]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentAttachments = useRef(new Map<string, OutgoingAttachment[]>());
  const flushing = useRef(false);

  const { questions, answer, skip } = useQuestions({ status, activeSession, getClient, addEventListener });
  const { notify } = useNotifications();

  useEffect(() => setBaseTitle(), []);

  // ---- Agent: reopen the last one; shares and the outbox always go to the Inbox
  const restored = useRef(false);
  const sharedOnLoad = useRef(pendingShareId() !== null); // read before the share import clears it
  const agentOnLoad = useRef(new URLSearchParams(window.location.search).get('agent')); // e.g. a reminder opens Admin
  useEffect(() => {
    // Wait for the agent list and /whoami: together they say whose Inbox this is.
    if (status !== 'connected' || restored.current || !ready) return;
    restored.current = true;
    const wanted = sharedOnLoad.current || outbox.length > 0 ? INBOX
      : (agents.find(a => a.id === (agentOnLoad.current ?? loadAgentId())) ?? INBOX);
    if (wanted.session !== activeSession) switchSession(wanted.session);
  }, [status, activeSession, switchSession, outbox.length, ready, agents, INBOX]);

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
    // Only into the Inbox, and only once we know which gateway (and so which Inbox) this is.
    if (!ready || activeSession !== INBOX.session) return;
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
  }, [status, outbox, sendMessage, activeSession, INBOX.session, ready]);

  const send = useCallback((text: string, attachments: OutgoingAttachment[]) => {
    if (status !== 'connected') {
      if (agent.session !== INBOX.session) {
        setHint(`Offline — messages to ${agent.label} cannot wait. Switch to Inbox to queue it.`);
        return;
      }
      setOutbox(prev => [...prev, { id: 'q-' + Date.now(), text, attachments, queuedAt: Date.now() }]);
      return;
    }
    if (attachments.length > 0) sentAttachments.current.set(text, attachments);
    void sendMessage(text, attachments.map(({ mimeType, fileName, content }) => ({ mimeType, fileName, content })));
  }, [status, sendMessage, agent, INBOX.session]);

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

  const statusLine =
    status === 'connected' ? null
      : status === 'connecting' ? 'Connecting…'
        : status === 'pairing' ? 'Waiting for pairing approval'
          : outbox.length > 0 ? `Offline — ${outbox.length} waiting to send` : 'Offline';

  // Tabs with a reply the person has not seen yet (other agents' sessions).
  const unread = useMemo(
    () => new Set(agents.filter(a => a.session !== activeSession && gw.sessions.some(s => s.key === a.session && s.hasUnread)).map(a => a.id)),
    [agents, activeSession, gw.sessions],
  );

  const results = useMemo(() => (search ? searchMessages(shown, search) : []), [shown, search]);
  const jumpTo = (id: string) => {
    setSearch(null);
    setFlash(id);
    window.setTimeout(() => document.getElementById(`m-${id}`)?.scrollIntoView({ block: 'center' }), 50);
    window.setTimeout(() => setFlash(null), 1800);
  };

  return (
    <div className="relative h-dvh flex flex-col bg-pc-base text-pc-text overflow-hidden">
      <TopBar
        agents={agents}
        active={agent}
        onChoose={chooseAgent}
        lockedTo={outbox.length > 0 ? INBOX : null}
        unread={unread}
        statusLine={statusLine}
        search={search}
        onSearch={setSearch}
        resultCount={results.length}
        menu={[
          { label: 'New conversation', onClick: () => void createNewSession() },
          ...(pushState !== 'unsupported' ? [{
            label: pushState === 'on' ? 'Notifications: on — turn off'
              : pushState === 'blocked' ? 'Notifications blocked in Chrome settings'
              : pushState === 'busy' ? 'Notifications…' : 'Turn on notifications',
            onClick: () => void togglePush(),
            disabled: pushState === 'blocked' || pushState === 'busy',
          }] : []),
          { label: 'Advanced (full PinchChat)', onClick: () => switchUiMode('full') },
          { label: 'Log out', onClick: logout, danger: true },
        ]}
      />

      {/* Conversation */}
      <main ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1" role="log" aria-live="polite">
        {isLoadingHistory && shown.length === 0 && <p className="text-center text-xs text-pc-text-muted py-6">Loading…</p>}
        {!isLoadingHistory && shown.length === 0 && outbox.length === 0 && (
          <p className="text-center text-sm text-pc-text-muted px-8 py-10">{agent.placeholder}</p>
        )}

        {search !== null && search.trim().length >= 2 && (
          <ul className="px-3 space-y-1" aria-label="Search results">
            {results.map(m => {
              const sn = snippet(visibleText(m), search);
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => jumpTo(m.id)} className="w-full rounded-xl bg-pc-surface px-3 py-2 text-left hover:bg-[var(--pc-hover)]">
                    <div className="mb-0.5 text-[11px] text-pc-text-muted">{m.role === 'user' ? 'You' : agent.label} · {dayLabel(m.timestamp)}</div>
                    <div className="line-clamp-2 text-[14px] leading-snug">{sn.before}<mark className="rounded bg-amber-200 px-0.5 text-pc-text-primary">{sn.match}</mark>{sn.after}</div>
                  </button>
                </li>
              );
            })}
            {results.length === 0 && <li className="py-8 text-center text-sm text-pc-text-muted">Nothing matches “{search.trim()}”</li>}
          </ul>
        )}

        {(search === null || search.trim().length < 2) && shown.map((msg, i) => {
          const prev = shown[i - 1];
          const newDay = !prev || new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
          const firstOfRun = newDay || prev.role !== msg.role;
          return (
            <div key={msg.id} id={`m-${msg.id}`} className={`transition-colors duration-1000 ${firstOfRun && i > 0 ? 'pt-1.5' : ''} ${flash === msg.id ? 'rounded-2xl bg-amber-100/60' : ''}`}>
              {newDay && (
                <div className="flex justify-center py-2">
                  <span className="rounded-lg bg-pc-surface px-3 py-1 text-[12px] text-pc-text-muted shadow-sm">{dayLabel(msg.timestamp)}</span>
                </div>
              )}
              <MessageBubble msg={msg} onRetry={retry} onReply={onReply} showAvatar={firstOfRun} />
            </div>
          );
        })}

        {outbox.map((item, i) => (
          <MessageBubble
            key={item.id}
            showAvatar={i === 0 && shown[shown.length - 1]?.role !== 'user'}
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
