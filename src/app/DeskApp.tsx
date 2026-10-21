/**
 * The desk (ai.manager app v2): one place for everything. Three bands — Now (what needs you),
 * Open loops (where you were) and one chat with the person's front agent — plus a composer with
 * dictation and voice notes. The default since 2026-10-21; the older messenger (?view=mobile) stays until this
 * one has proven itself. Protocol work comes from the upstream useGateway hook; the fork's mobile
 * layer provides the bubbles, composer, question cards, share import and theme.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { getTheme, setTheme, themeVars, useThemeChrome, type ThemeName } from './themes';
import { ArrowDown, ListChecks, Languages, MessageSquareText, MoreVertical, RefreshCw, Search, StickyNote, Compass, Bell, X } from 'lucide-react';
import { useGateway } from '../hooks/useGateway';
import { useNotifications, setBaseTitle } from '../hooks/useNotifications';
import { LoginScreen } from '../components/LoginScreen';
import { getStoredCredentials } from '../lib/credentials';
import type { ChatMessage } from '../types';
import { MessageBubble } from '../mobile/MessageBubble';
import { collapseCliTurns, isShownInMessenger, visibleText, withoutLeadingQuote } from '../mobile/messageView';
import { Composer, type ComposerPrefill } from '../mobile/Composer';
import { QuestionCard } from '../mobile/QuestionCard';
import { useQuestions } from '../mobile/useQuestions';
import { switchUiMode } from '../mobile/uiMode';
import { disablePush, enablePush, getPushState, type PushState } from '../mobile/pushNotifications';
import type { OutgoingAttachment } from '../mobile/attachments';
import { clearShareParam, pendingShareId, takeSharedContent } from '../share/shareInbox';
import { searchMessages, snippet } from '../mobile/searchMessages';
import { act, fetchLoops, fetchNow, whoami, SessionExpired, type Loop, type NowItem } from './api';
import { NowList } from './NowList';
import { LoopsList } from './LoopsList';
import { ItemSheet } from './ItemSheet';
import { ItemChips } from './ItemChips';

const OUTBOX_KEY = 'openclaw-pwa:outbox';
interface OutboxItem { id: string; text: string; attachments: OutgoingAttachment[]; queuedAt: number }
function loadOutbox(): OutboxItem[] {
  try { return (JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') as OutboxItem[]).map(r => ({ ...r, attachments: [] })); } catch { return []; }
}
function saveOutbox(items: OutboxItem[]) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.map(i => ({ id: i.id, text: i.text, queuedAt: i.queuedAt })))); } catch { /* storage unavailable */ }
}
function dayLabel(ts: number): string {
  const d = new Date(ts), today = new Date(), y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
const isLocal = () => ['127.0.0.1', 'localhost'].includes(window.location.hostname);

/** Quick actions: they set the intent of the next message (app v2 §2). */
const QUICK = [
  { label: 'Translate', icon: Languages, text: 'Translate: ' },
  { label: 'Note', icon: StickyNote, text: 'Note: ' },
  { label: 'Task', icon: ListChecks, text: 'Task: ' },
  { label: 'Remind', icon: Bell, text: 'Remind me ' },
  { label: 'Ask', icon: MessageSquareText, text: '' },
  { label: 'Explore', icon: Compass, text: 'Let’s think through: ' },
];

export default function DeskApp() {
  const [theme, setThemeState] = useState<ThemeName>(getTheme);
  useThemeChrome(theme);
  const gw = useGateway();
  const savedLogin = getStoredCredentials() !== null;
  const networkOnly = !gw.connectError || gw.connectError.startsWith('Connection failed');
  const chooseTheme = (t: ThemeName) => { setTheme(t); setThemeState(t); };
  return (
    <div style={themeVars(theme)} className="h-dvh bg-pc-base text-pc-text">
      {!gw.authenticated && !(savedLogin && networkOnly)
        ? <LoginScreen onConnect={gw.login} error={gw.connectError} isConnecting={gw.isConnecting} />
        : <Desk gw={gw} theme={theme} onTheme={chooseTheme} />}
    </div>
  );
}

function Desk({ gw, theme, onTheme }: { gw: ReturnType<typeof useGateway>; theme: ThemeName; onTheme: (t: ThemeName) => void }) {
  const { status, messages, isLoadingHistory, activeSession, sendMessage, logout, getClient, addEventListener, switchSession } = gw;
  const [person, setPerson] = useState<string | null>(null);
  useEffect(() => { void whoami().then(setPerson); }, []);

  // Whose chat: the front agent of the signed-in person. Fail closed: no identity, no chat
  // (except in local dev, where the build setting picks the agent).
  const frontSession = useMemo(() => {
    if (person) return gw.agents.includes(`gateway-${person}`) ? `agent:gateway-${person}:main` : null;
    if (person === '' && isLocal()) return import.meta.env.VITE_AGENT_SESSION || 'agent:gateway-lucian:main';
    return null;
  }, [person, gw.agents]);
  const ready = status === 'connected' && !!frontSession && gw.agents.length > 0;
  useEffect(() => {
    if (ready && frontSession && activeSession !== frontSession) switchSession(frontSession);
  }, [ready, frontSession, activeSession, switchSession]);

  // ---- Now and loops
  const [now, setNow] = useState<{ today: string; items: NowItem[] }>({ today: '', items: [] });
  const [loops, setLoops] = useState<Loop[]>([]);
  const [expired, setExpired] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [nowOpen, setNowOpen] = useState(true);   // the Now strip above the chat: open or collapsed to one line
  const [selected, setSelected] = useState<Set<string> | null>(null);   // multi-select for copying
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(() => (pendingShareId() === 'failed' ? 'Could not read the shared content.' : null));
  const refresh = useCallback(async () => {
    try {
      const [n, l] = await Promise.all([fetchNow(), fetchLoops()]);
      setNow(n); setLoops(l.loops); setExpired(false);
    } catch (e) {
      if (e instanceof SessionExpired) setExpired(true);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5 * 60_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(t); };
  }, [refresh]);

  const doAct = async (item: NowItem, action: 'done' | 'snooze') => {
    setBusy(item.id);
    setNow(n => ({ ...n, items: n.items.filter(i => i.id !== item.id) }));   // optimistic
    try { await act(item.id, action); } catch (e) { setHint(e instanceof Error ? e.message : 'Could not change it'); }
    finally { setBusy(null); void refresh(); }
  };

  // ---- Chat plumbing (outbox, share import, questions, notifications)
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null);
  const [outbox, setOutbox] = useState<OutboxItem[]>(loadOutbox);
  const [replyTo, setReplyTo] = useState<{ text: string; mine: boolean } | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pushState, setPushState] = useState<PushState | 'busy'>('off');
  useEffect(() => { void getPushState().then(setPushState).catch(() => setPushState('unsupported')); }, []);
  const togglePush = async () => {
    const from = pushState; setPushState('busy');
    try { setPushState(from === 'on' ? await disablePush() : await enablePush()); }
    catch (e) { setPushState(from); setHint(e instanceof Error ? e.message : 'Could not change notifications.'); }
  };
  const sentAttachments = useRef(new Map<string, OutgoingAttachment[]>());
  const flushing = useRef(false);
  const { questions, answer, skip } = useQuestions({ status, activeSession, getClient, addEventListener });
  const { notify } = useNotifications();
  useEffect(() => setBaseTitle(), []);

  useEffect(() => {
    const id = pendingShareId();
    if (!id) return;
    clearShareParam();
    if (id === 'failed') return;
    void takeSharedContent(id).then(shared => {
      if (!shared) { setHint('The shared content has expired.'); return; }
      setPrefill({ nonce: Date.now(), text: shared.text, attachments: shared.attachments });
      setHint(shared.rejected.length > 0 ? `Shared — could not attach: ${shared.rejected.join(', ')}` : 'Shared — add a note, then send.');
    });
  }, []);

  useEffect(() => saveOutbox(outbox), [outbox]);
  useEffect(() => {
    if (!ready || activeSession !== frontSession || outbox.length === 0 || flushing.current) return;
    flushing.current = true;
    void (async () => {
      for (const item of outbox) {
        if (item.attachments.length > 0) sentAttachments.current.set(item.text, item.attachments);
        await sendMessage(item.text, item.attachments);
        setOutbox(prev => prev.filter(p => p.id !== item.id));
      }
      flushing.current = false;
      setOutbox(prev => (prev.length > 0 ? [...prev] : prev));
    })();
  }, [ready, activeSession, frontSession, outbox, sendMessage]);

  const send = useCallback((text: string, attachments: OutgoingAttachment[]) => {
    if (!ready) { setOutbox(prev => [...prev, { id: 'q-' + Date.now(), text, attachments, queuedAt: Date.now() }]); return; }
    if (attachments.length > 0) sentAttachments.current.set(text, attachments);
    void sendMessage(text, attachments);
  }, [ready, sendMessage]);
  const retry = useCallback((msg: ChatMessage) => { send(msg.content, sentAttachments.current.get(msg.content) ?? []); }, [send]);
  const onReply = useCallback((msg: ChatMessage) => { setReplyTo({ text: withoutLeadingQuote(visibleText(msg)) || '📷 Photo', mine: msg.role === 'user' }); }, []);
  const putInComposer = (text: string, sendNow = false) => {
    if (sendNow) { send(text, []); return; }
    setPrefill({ nonce: Date.now(), text, attachments: [] });
  };

  // A new reply may have filed or closed something: refresh the bands.
  const shown = useMemo(() => collapseCliTurns(messages).filter(isShownInMessenger), [messages]);
  const prevCount = useRef(messages.length);
  useEffect(() => {
    const before = prevCount.current; prevCount.current = messages.length;
    if (messages.length <= before) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !last.isStreaming && isShownInMessenger(last)) {
      notify('OpenClaw', visibleText(last).slice(0, 120) || 'New message');
      void refresh();
    }
  }, [messages, notify, refresh]);

  // ---- scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollToBottom = useCallback((smooth = true) => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); }, []);
  useEffect(() => { if (atBottom && search === null) scrollToBottom(false); }, [shown, outbox, questions, atBottom, search, scrollToBottom]);
  const onScroll = () => { const el = scrollRef.current; if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };

  const results = useMemo(() => (search ? searchMessages(shown, search) : []), [shown, search]);
  const jumpTo = (id: string) => {
    setSearch(null); setFlash(id);
    window.setTimeout(() => document.getElementById(`d-${id}`)?.scrollIntoView({ block: 'center' }), 50);
    window.setTimeout(() => setFlash(null), 1800);
  };

  const toggleSelect = useCallback((m: ChatMessage) => {
    setSelected(prev => { const n = new Set(prev ?? []); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; });
  }, []);
  const copySelected = async () => {
    const lines = shown.filter(m => selected?.has(m.id)).map(m => `${m.role === 'user' ? 'Me' : 'Assistant'} (${new Date(m.timestamp).toLocaleString()}):\n${withoutLeadingQuote(visibleText(m))}`);
    try { await navigator.clipboard.writeText(lines.join('\n\n')); setHint(`Copied ${lines.length} message${lines.length === 1 ? '' : 's'}.`); }
    catch { setHint('Could not copy.'); }
    setSelected(null);
  };

  const statusLine = status === 'connected' ? null : status === 'connecting' ? 'Connecting…' : status === 'pairing' ? 'Waiting for pairing approval' : outbox.length > 0 ? `Offline — ${outbox.length} waiting to send` : 'Offline';
  const renderChips = useCallback((items: Array<{ id: string; label: string }>) => <ItemChips items={items} onOpen={setSheet} />, []);

  const nowSection = (collapsible: boolean) => (
    <section aria-label="Now" className="bg-pc-base">
      <h2 className="flex items-center justify-between px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted">
        <button type="button" onClick={() => collapsible && setNowOpen(o => !o)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={!collapsible || nowOpen}>
          <span>Now{now.items.length > 0 ? ` · ${now.items.length}` : ''}</span>
          {collapsible && !nowOpen && now.items[0] && <span className="min-w-0 truncate normal-case tracking-normal text-[12px] font-normal text-pc-text-secondary">— {now.items[0].title}{now.items.length > 1 ? ` +${now.items.length - 1}` : ''}</span>}
          {collapsible && (nowOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </button>
        <button type="button" onClick={() => void refresh()} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Refresh"><RefreshCw size={13} /></button>
      </h2>
      {(!collapsible || nowOpen) && (expired
        ? <p className="px-4 py-3 text-[14px] text-amber-700">Signed out of the lists — <a href="/" className="underline">sign in again</a>.</p>
        : <NowList items={now.items} today={now.today} expanded={expanded} onExpand={setExpanded} busy={busy}
            onDone={i => void doAct(i, 'done')} onSnooze={i => void doAct(i, 'snooze')} onOpen={i => setSheet(i.id)} />)}
    </section>
  );
  const bands = (
    <>
      {nowSection(false)}
      <section aria-label="Open loops" className="border-t border-pc-border">
        <h2 className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted">Open loops</h2>
        <LoopsList loops={loops} today={now.today} onContinue={l => putInComposer(`Continue: ${l.title} ⟨${l.id}⟩`, true)} onOpen={l => setSheet(l.id)} />
      </section>
    </>
  );

  const chat = (
    <>
      {search !== null && search.trim().length >= 2 && (
        <ul className="px-3 space-y-1" aria-label="Search results">
          {results.map(m => { const sn = snippet(visibleText(m), search); return (
            <li key={m.id}><button type="button" onClick={() => jumpTo(m.id)} className="w-full rounded-xl bg-pc-surface px-3 py-2 text-left hover:bg-[var(--pc-hover)]">
              <div className="mb-0.5 text-[11px] text-pc-text-muted">{m.role === 'user' ? 'You' : 'Assistant'} · {dayLabel(m.timestamp)}</div>
              <div className="line-clamp-2 text-[14px] leading-snug">{sn.before}<mark className="rounded bg-amber-200 px-0.5 text-pc-text-primary">{sn.match}</mark>{sn.after}</div>
            </button></li>); })}
          {results.length === 0 && <li className="py-8 text-center text-sm text-pc-text-muted">Nothing matches “{search.trim()}”</li>}
        </ul>
      )}
      {(search === null || search.trim().length < 2) && (
        <>
          {isLoadingHistory && shown.length === 0 && <p className="py-6 text-center text-xs text-pc-text-muted">Loading…</p>}
          {!isLoadingHistory && shown.length === 0 && outbox.length === 0 && <p className="px-8 py-6 text-center text-sm text-pc-text-muted">Say or send anything: a note, a link, a photo, a question, a task.</p>}
          {shown.map((msg, i) => {
            const prev = shown[i - 1];
            const newDay = !prev || new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
            const firstOfRun = newDay || prev.role !== msg.role;
            return (
              <div key={msg.id} id={`d-${msg.id}`} className={`transition-colors duration-1000 ${firstOfRun && i > 0 ? 'pt-1.5' : ''} ${flash === msg.id ? 'rounded-2xl bg-amber-100/60' : ''}`}>
                {newDay && <div className="flex justify-center py-2"><span className="rounded-lg bg-pc-surface px-3 py-1 text-[12px] text-pc-text-muted shadow-sm">{dayLabel(msg.timestamp)}</span></div>}
                <MessageBubble msg={msg} onRetry={retry} onReply={onReply} showAvatar={firstOfRun} renderItems={renderChips}
                  selecting={selected !== null} selected={!!selected?.has(msg.id)} onSelect={toggleSelect} />
              </div>
            );
          })}
          {outbox.map((item, i) => (
            <MessageBubble key={item.id} showAvatar={i === 0 && shown[shown.length - 1]?.role !== 'user'}
              msg={{ id: item.id, role: 'user', content: item.text, timestamp: item.queuedAt, blocks: [{ type: 'text', text: item.text || `📎 ${item.attachments.length} attachment(s)` }], sendStatus: 'sending' }} />
          ))}
          {questions.map(q => <QuestionCard key={q.id} record={q} onAnswer={answer} onSkip={skip} />)}
        </>
      )}
    </>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-pc-surface pt-[env(safe-area-inset-top)]">
        <div className="flex h-12 items-center gap-1 px-2">
          {selected !== null ? (
            <>
              <button type="button" onClick={() => setSelected(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Cancel selection"><X size={20} /></button>
              <span className="min-w-0 flex-1 px-1 text-[15px]">{selected.size} selected</span>
              <button type="button" disabled={selected.size === 0} onClick={() => void copySelected()} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-pc-accent px-4 text-[14px] font-semibold text-white disabled:opacity-50"><Copy size={15} /> Copy</button>
            </>
          ) : search !== null ? (
            <>
              <button type="button" onClick={() => setSearch(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Close search"><X size={20} /></button>
              <input autoFocus type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the conversation" aria-label="Search" enterKeyHint="search"
                className="h-10 min-w-0 flex-1 rounded-full bg-[var(--pc-hover)] px-4 text-[15px] outline-none placeholder:text-pc-text-muted" />
              <span className="w-16 shrink-0 pr-1 text-right text-[12px] text-pc-text-muted">{search.trim().length >= 2 ? (results.length === 0 ? 'No results' : `${results.length} found`) : ''}</span>
            </>
          ) : (
            <>
              <h1 className="min-w-0 flex-1 truncate px-2 text-[17px] font-semibold">{person ? (person === 'lucian' ? 'Lucian' : person === 'ludmila' ? 'Ludmila' : person) : 'ai.manager'}</h1>
              <button type="button" onClick={() => setSearch('')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Search"><Search size={20} /></button>
              <div className="relative shrink-0">
                <button type="button" onClick={() => setMenuOpen(o => !o)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--pc-hover)]" aria-label="Menu" aria-expanded={menuOpen}><MoreVertical size={20} /></button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-11 z-20 w-60 rounded-xl border border-pc-border bg-pc-elevated py-1 text-[15px] shadow-lg">
                      {pushState !== 'unsupported' && (
                        <button type="button" disabled={pushState === 'blocked' || pushState === 'busy'} onClick={() => { setMenuOpen(false); void togglePush(); }} className="w-full px-4 py-2.5 text-left hover:bg-[var(--pc-hover)] disabled:opacity-60">
                          {pushState === 'on' ? 'Notifications: on — turn off' : pushState === 'blocked' ? 'Notifications blocked in Chrome settings' : pushState === 'busy' ? 'Notifications…' : 'Turn on notifications'}
                        </button>
                      )}
                      <button type="button" onClick={() => { setMenuOpen(false); onTheme(theme === 'warm' ? 'green' : 'warm'); }} className="w-full px-4 py-2.5 text-left hover:bg-[var(--pc-hover)]">Theme: {theme === 'warm' ? 'warm → switch to green' : 'green → switch to warm'}</button>
                      <button type="button" onClick={() => switchUiMode('mobile')} className="w-full px-4 py-2.5 text-left hover:bg-[var(--pc-hover)]">Older messenger view</button>
                      <button type="button" onClick={() => switchUiMode('full')} className="w-full px-4 py-2.5 text-left hover:bg-[var(--pc-hover)]">Advanced (full PinchChat)</button>
                      <button type="button" onClick={() => { setMenuOpen(false); logout(); }} className="w-full px-4 py-2.5 text-left text-red-500 hover:bg-[var(--pc-hover)]">Log out</button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {statusLine && search === null && <div className="flex h-6 items-center justify-center bg-amber-100 text-[12px] text-amber-800" role="status">{statusLine}</div>}
        {person === '' && !isLocal() && <div className="flex h-6 items-center justify-center bg-red-100 text-[12px] text-red-800" role="status">Not signed in — <a href="/" className="ml-1 underline">sign in</a></div>}
      </header>

      <div className="flex min-h-0 flex-1 md:flex-row">
        <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-r border-pc-border md:block">{bands}</aside>
        <main ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto overflow-x-hidden pb-2 space-y-1" role="log" aria-live="polite">
          <div className="sticky top-0 z-10 max-h-[45dvh] overflow-y-auto border-b border-pc-border bg-pc-base shadow-[0_2px_4px_rgba(0,0,0,0.06)] md:hidden">{nowSection(true)}</div>
          <div className="md:hidden border-b border-pc-border bg-pc-base">
            <section aria-label="Open loops">
              <h2 className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted">Open loops</h2>
              <LoopsList loops={loops} today={now.today} onContinue={l => putInComposer(`Continue: ${l.title} ⟨${l.id}⟩`, true)} onOpen={l => setSheet(l.id)} />
            </section>
          </div>
          <div className="px-0 pt-1 md:px-2">{chat}</div>
        </main>
      </div>

      {!atBottom && search === null && (
        <button type="button" onClick={() => scrollToBottom()} className="absolute bottom-28 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-pc-border bg-pc-surface shadow-md" aria-label="Scroll to latest"><ArrowDown size={18} /></button>
      )}

      <div className="shrink-0 bg-pc-base">
        <div className="flex gap-2 overflow-x-auto px-3 pt-2 pb-1 [scrollbar-width:none]" aria-label="Quick actions">
          {QUICK.map(q => (
            <button key={q.label} type="button" onClick={() => putInComposer(q.text)} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-pc-border bg-pc-surface px-4 text-[14px] text-pc-text-secondary active:bg-[var(--pc-hover-strong)] hover:bg-[var(--pc-hover)]">
              <q.icon size={16} /> {q.label}
            </button>
          ))}
        </div>
        <Composer key={prefill?.nonce ?? 0} onSend={send} prefill={prefill} hint={hint} onHintDismiss={() => setHint(null)} replyTo={replyTo} onReplyCancel={() => setReplyTo(null)} voice placeholder="Say or type anything" />
      </div>

      {sheet && <ItemSheet id={sheet} onClose={() => setSheet(null)} onChanged={() => void refresh()} onAsk={putInComposer} />}
    </div>
  );
}
