/**
 * The desk (ai.manager app v2): one place for everything. One chat with the person's front agent
 * fills the screen; a slim pinned "To do" bar above it opens the lists (To do, In progress) in a
 * sheet, so the chat never loses its space. On a laptop the lists sit in a side column.
 * The default view since 2026-10-21; the classic messenger (?view=mobile) stays reachable from
 * Settings. Protocol work comes from the upstream useGateway hook; the fork's mobile layer provides
 * the bubbles, composer, question cards and share import.
 *
 * 2026-10-22 redesign (Lucian's review): neutral look with one accent and dark mode, the lists
 * folded into a pinned bar, a real Settings sheet, one mic for speaking to type, search across
 * tasks, topics and messages, and no programmer words ("loop" is "In progress" on screen).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Bell, ChevronDown, Copy, Languages, ListChecks, Lightbulb, RefreshCw, Search, StickyNote, X } from 'lucide-react';
import { getLook, lookVars, setLook, useMode, useThemeChrome, type Look } from './themes';
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
import { act, domainEmoji, fetchLoops, fetchNow, whenLabel, whoami, SessionExpired, type Loop, type NowItem } from './api';
import { NowList } from './NowList';
import { LoopsList } from './LoopsList';
import { ItemSheet } from './ItemSheet';
import { ItemChips } from './ItemChips';
import { SettingsSheet } from './SettingsSheet';

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
const has = (q: string, ...fields: Array<string | undefined>) => fields.some(f => f && f.toLowerCase().includes(q));

/** Quick starts: they set the intent of the next message (app v2 §2). */
const QUICK = [
  { label: 'Task', icon: ListChecks, text: 'Task: ' },
  { label: 'Remind me', icon: Bell, text: 'Remind me ' },
  { label: 'Note', icon: StickyNote, text: 'Note: ' },
  { label: 'Translate', icon: Languages, text: 'Translate: ' },
  { label: 'Think through', icon: Lightbulb, text: 'Let’s think through: ' },
];

export default function DeskApp() {
  const [look, setLookState] = useState<Look>(getLook);
  const mode = useMode(look.appearance);
  useThemeChrome(mode);
  const gw = useGateway();
  const savedLogin = getStoredCredentials() !== null;
  const networkOnly = !gw.connectError || gw.connectError.startsWith('Connection failed');
  const chooseLook = (l: Look) => { setLook(l); setLookState(l); };
  return (
    <div style={lookVars(mode, look.accent)} className="h-dvh bg-pc-base text-pc-text antialiased">
      {!gw.authenticated && !(savedLogin && networkOnly)
        ? <LoginScreen onConnect={gw.login} error={gw.connectError} isConnecting={gw.isConnecting} />
        : <Desk gw={gw} look={look} mode={mode} onLook={chooseLook} />}
    </div>
  );
}

type Tab = 'todo' | 'progress';

function Desk({ gw, look, mode, onLook }: { gw: ReturnType<typeof useGateway>; look: Look; mode: 'light' | 'dark'; onLook: (l: Look) => void }) {
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

  // ---- To do and In progress
  const [now, setNow] = useState<{ today: string; items: NowItem[] }>({ today: '', items: [] });
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expired, setExpired] = useState(false);
  const [lists, setLists] = useState<Tab | null>(null);     // the lists sheet (phone)
  const [tab, setTab] = useState<Tab>('todo');               // the side column (laptop)
  const [selected, setSelected] = useState<Set<string> | null>(null);   // multi-select for copying
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [hint, setHint] = useState<string | null>(() => (pendingShareId() === 'failed' ? 'Could not read the shared content.' : null));
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [n, l] = await Promise.all([fetchNow(), fetchLoops()]);
      setNow(n); setLoops(l.loops); setExpired(false); setLoaded(true);
    } catch (e) {
      if (e instanceof SessionExpired) setExpired(true);
    } finally { setRefreshing(false); }
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
      setHint(shared.rejected.length > 0 ? `Shared, but could not attach: ${shared.rejected.join(', ')}` : 'Shared. Add a note if you like, then send.');
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
    setLists(null);
    if (sendNow) { send(text, []); return; }
    setPrefill({ nonce: Date.now(), text, attachments: [] });
  };

  // A new reply may have filed or closed something: refresh the lists.
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

  // ---- search: To do, In progress and the conversation, together
  const q = (search ?? '').trim().toLowerCase();
  const searching = search !== null && q.length >= 2;
  const found = useMemo(() => {
    if (!searching) return { todo: [] as NowItem[], progress: [] as Loop[], msgs: [] as ChatMessage[] };
    return {
      todo: now.items.filter(i => has(q, i.title, i.consequence, i.payee, i.domain)),
      progress: loops.filter(l => has(q, l.title, l.state, l.next_step, l.domain)),
      msgs: searchMessages(shown, search ?? ''),
    };
  }, [searching, q, now.items, loops, shown, search]);
  const foundCount = found.todo.length + found.progress.length + found.msgs.length;
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

  const statusLine = status === 'connected' ? null : status === 'connecting' ? 'Connecting…' : status === 'pairing' ? 'Waiting for pairing approval' : outbox.length > 0 ? `Offline · ${outbox.length} waiting to send` : 'Offline';
  const renderChips = useCallback((items: Array<{ id: string; label: string }>) => <ItemChips items={items} onOpen={setSheet} />, []);
  const name = person ? person[0].toUpperCase() + person.slice(1) : '';
  const dateTitle = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const top = now.items[0];
  const topWhen = top ? whenLabel(top, now.today) : null;
  const urgentCount = now.items.filter(i => i.section === 'overdue' || i.section === 'today').length;

  const listBody = (t: Tab) => expired
    ? <p className="px-4 py-6 text-[15px] text-pc-text-muted">Signed out of the lists. <a href="/" className="text-pc-accent">Sign in again</a></p>
    : t === 'todo'
      ? <NowList items={now.items} today={now.today} busy={busy} onDone={i => void doAct(i, 'done')} onSnooze={i => void doAct(i, 'snooze')} onOpen={i => setSheet(i.id)} />
      : <LoopsList loops={loops} today={now.today} onContinue={l => putInComposer(`Continue: ${l.title} ⟨${l.id}⟩`, true)} onOpen={l => setSheet(l.id)} />;
  const tabs = (value: Tab, onChange: (t: Tab) => void) => (
    <div className="grid flex-1 grid-cols-2 gap-1 rounded-[10px] bg-pc-surface p-[3px]" role="tablist">
      {([['todo', 'To do', now.items.length], ['progress', 'In progress', loops.length]] as const).map(([v, label, n]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={`h-8 rounded-[8px] text-[14px] font-medium transition-colors ${value === v ? 'bg-pc-elevated text-pc-text shadow-sm' : 'text-pc-text-muted'}`}>
          {label}{n > 0 ? <span className="ml-1 text-pc-text-muted">{n}</span> : null}
        </button>
      ))}
    </div>
  );

  // The pinned bar over the chat (phone): the most pressing thing, and how much else is waiting.
  const pinnedBar = (
    <button type="button" onClick={() => setLists('todo')} aria-label="Open To do"
      className="mx-3 mt-2 mb-1 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-pc-border bg-pc-elevated px-3 py-2 text-left shadow-[0_2px_10px_rgba(0,0,0,0.06)] active:scale-[0.99] md:hidden">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${
        now.items.length === 0 ? 'bg-[rgba(var(--pc-accent-rgb),0.12)] text-pc-accent' : urgentCount > 0 ? 'bg-red-500 text-white' : 'bg-pc-accent text-white'}`}>
        {now.items.length === 0 ? <ListChecks size={18} /> : now.items.length}
      </span>
      <span className="min-w-0 flex-1">
        {!loaded ? <span className="block text-[15px] text-pc-text-muted">{expired ? 'Signed out of the lists' : 'To do'}</span>
          : top ? (
            <>
              <span className="block truncate text-[15px] font-medium leading-tight">{domainEmoji(top.domain) ? `${domainEmoji(top.domain)} ` : ''}{top.title}</span>
              <span className="mt-0.5 block truncate text-[12px] leading-tight text-pc-text-muted">
                {topWhen && <span className={topWhen.cls}>{topWhen.text}</span>}
                {now.items.length > 1 && <>{topWhen ? ' · ' : ''}{now.items.length - 1} more to do</>}
                {loops.length > 0 && <> · {loops.length} in progress</>}
              </span>
            </>
          ) : (
            <>
              <span className="block text-[15px] font-medium leading-tight">All clear</span>
              <span className="mt-0.5 block text-[12px] leading-tight text-pc-text-muted">{loops.length > 0 ? `${loops.length} in progress` : 'Nothing needs you right now'}</span>
            </>
          )}
      </span>
      <ChevronDown size={18} className="shrink-0 text-pc-text-faint" />
    </button>
  );

  const searchResults = (
    <div className="px-3 pb-4 pt-2">
      {!searching && <p className="px-2 py-10 text-center text-[15px] text-pc-text-muted">Search your to-dos, what’s in progress and the conversation.</p>}
      {searching && foundCount === 0 && <p className="px-2 py-10 text-center text-[15px] text-pc-text-muted">Nothing matches “{search?.trim()}”</p>}
      {found.todo.length > 0 && (
        <section className="mb-4">
          <h3 className="px-2 pb-1 text-[13px] font-semibold text-pc-text-muted">To do</h3>
          <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-2xl bg-pc-surface">
            {found.todo.map(i => { const w = whenLabel(i, now.today); return (
              <button key={i.id} type="button" onClick={() => setSheet(i.id)} className="block w-full px-4 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
                <span className="block truncate text-[15px]">{domainEmoji(i.domain) ? `${domainEmoji(i.domain)} ` : ''}{i.title}</span>
                {w && <span className={`text-[12px] ${w.cls}`}>{w.text}</span>}
              </button>); })}
          </div>
        </section>
      )}
      {found.progress.length > 0 && (
        <section className="mb-4">
          <h3 className="px-2 pb-1 text-[13px] font-semibold text-pc-text-muted">In progress</h3>
          <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-2xl bg-pc-surface">
            {found.progress.map(l => (
              <button key={l.id} type="button" onClick={() => setSheet(l.id)} className="block w-full px-4 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
                <span className="block truncate text-[15px]">{l.title}</span>
                <span className="block truncate text-[12px] text-pc-text-muted">{l.next_step ? `Next: ${l.next_step}` : l.state}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {found.msgs.length > 0 && (
        <section>
          <h3 className="px-2 pb-1 text-[13px] font-semibold text-pc-text-muted">Conversation</h3>
          <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-2xl bg-pc-surface">
            {found.msgs.map(m => { const sn = snippet(visibleText(m), search ?? ''); return (
              <button key={m.id} type="button" onClick={() => jumpTo(m.id)} className="block w-full px-4 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
                <span className="mb-0.5 block text-[12px] text-pc-text-muted">{m.role === 'user' ? 'You' : 'Assistant'} · {dayLabel(m.timestamp)}</span>
                <span className="line-clamp-2 text-[14px] leading-snug">{sn.before}<mark className="rounded bg-[rgba(var(--pc-accent-rgb),0.25)] px-0.5 text-pc-text-primary">{sn.match}</mark>{sn.after}</span>
              </button>); })}
          </div>
        </section>
      )}
    </div>
  );

  const chat = (
    <>
      {isLoadingHistory && shown.length === 0 && <p className="py-6 text-center text-xs text-pc-text-muted">Loading…</p>}
      {!isLoadingHistory && shown.length === 0 && outbox.length === 0 && (
        <div className="px-10 py-16 text-center">
          <p className="text-[17px] font-semibold">What’s on your mind?</p>
          <p className="mt-1 text-[15px] text-pc-text-muted">A task, a note, a link, a photo, a question. Type it or tap the mic and say it.</p>
        </div>
      )}
      {shown.map((msg, i) => {
        const prev = shown[i - 1];
        const newDay = !prev || new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
        const firstOfRun = newDay || prev.role !== msg.role;
        return (
          <div key={msg.id} id={`d-${msg.id}`} className={`transition-colors duration-1000 ${firstOfRun && i > 0 ? 'pt-2' : ''} ${flash === msg.id ? 'rounded-2xl bg-[rgba(var(--pc-accent-rgb),0.12)]' : ''}`}>
            {newDay && <div className="flex justify-center pb-2 pt-3"><span className="text-[12px] font-medium text-pc-text-muted">{dayLabel(msg.timestamp)}</span></div>}
            <MessageBubble msg={msg} onRetry={retry} onReply={onReply} showAvatar={firstOfRun} renderItems={renderChips}
              selecting={selected !== null} selected={!!selected?.has(msg.id)} onSelect={toggleSelect} />
          </div>
        );
      })}
      {outbox.map((item, i) => (
        <MessageBubble key={item.id} showAvatar={i === 0 && shown[shown.length - 1]?.role !== 'user'}
          msg={{ id: item.id, role: 'user', content: item.text, timestamp: item.queuedAt, blocks: [{ type: 'text', text: item.text || `📎 ${item.attachments.length} attachment(s)` }], sendStatus: 'sending' }} />
      ))}
      {questions.map(qq => <QuestionCard key={qq.id} record={qq} onAnswer={answer} onSkip={skip} />)}
    </>
  );

  const iconBtn = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-[var(--pc-hover-strong)]';

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[color-mix(in_srgb,var(--pc-bg-base)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-[52px] items-center gap-1 px-2">
          {selected !== null ? (
            <>
              <button type="button" onClick={() => setSelected(null)} className={iconBtn} aria-label="Cancel selection"><X size={21} /></button>
              <span className="min-w-0 flex-1 px-1 text-[16px] font-medium">{selected.size} selected</span>
              <button type="button" disabled={selected.size === 0} onClick={() => void copySelected()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-pc-accent px-4 text-[15px] font-semibold text-white disabled:opacity-50"><Copy size={15} /> Copy</button>
            </>
          ) : search !== null ? (
            <>
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-pc-surface px-2.5">
                <Search size={16} className="shrink-0 text-pc-text-muted" />
                <input autoFocus type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" aria-label="Search" enterKeyHint="search"
                  className="min-w-0 flex-1 bg-transparent text-[16px] outline-none focus:outline-none focus-visible:outline-none focus:ring-0 border-0 shadow-none placeholder:text-pc-text-muted [&::-webkit-search-cancel-button]:hidden" />
                {search && <button type="button" onClick={() => setSearch('')} className="flex h-5 w-5 items-center justify-center rounded-full bg-pc-text-faint text-pc-surface" aria-label="Clear search"><X size={11} strokeWidth={3} /></button>}
              </div>
              <button type="button" onClick={() => setSearch(null)} className="px-2 text-[16px] text-pc-accent">Cancel</button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1 px-2">
                <h1 className="truncate text-[17px] font-semibold leading-tight">{name ? `Hi, ${name}` : 'OpenClaw'}</h1>
                <p className="truncate text-[12px] leading-tight text-pc-text-muted">{dateTitle}</p>
              </div>
              <button type="button" onClick={() => setSearch('')} className={iconBtn} aria-label="Search"><Search size={21} /></button>
              <button type="button" onClick={() => setSettings(true)} className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pc-accent text-[15px] font-semibold text-white active:opacity-80" aria-label="Settings">
                {name ? name[0] : '⋯'}
              </button>
            </>
          )}
        </div>
        {statusLine && search === null && <div className="flex h-6 items-center justify-center bg-amber-500/15 text-[12px] text-amber-700" role="status">{statusLine}</div>}
        {person === '' && !isLocal() && <div className="flex h-6 items-center justify-center bg-red-500/15 text-[12px] text-red-600" role="status">Not signed in · <a href="/" className="ml-1 underline">sign in</a></div>}
      </header>

      <div className="flex min-h-0 flex-1 md:flex-row">
        <aside className="hidden w-[400px] shrink-0 flex-col border-r border-pc-border bg-pc-elevated md:flex">
          <div className="flex items-center gap-2 px-3 py-2">
            {tabs(tab, setTab)}
            <button type="button" onClick={() => void refresh()} className={iconBtn} aria-label="Refresh"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{listBody(tab)}</div>
        </aside>
        <div className="relative flex min-w-0 flex-1 flex-col">
          {search === null && pinnedBar}
          <main ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2" role="log" aria-live="polite">
            {search !== null ? searchResults : <div className="space-y-1 pt-1 md:px-2">{chat}</div>}
          </main>
          {!atBottom && search === null && (
            <button type="button" onClick={() => scrollToBottom()} className="absolute bottom-3 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-pc-border bg-pc-elevated shadow-lg" aria-label="Scroll to latest"><ArrowDown size={18} /></button>
          )}
        </div>
      </div>

      {search === null && (
        <div className="shrink-0 border-t border-pc-border bg-pc-base">
          <div className="flex gap-2 overflow-x-auto px-3 pt-2 [&::-webkit-scrollbar]:hidden" aria-label="Quick starts" style={{ scrollbarWidth: 'none' }}>
            {QUICK.map(qq => (
              <button key={qq.label} type="button" onClick={() => putInComposer(qq.text)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-pc-surface px-3.5 text-[14px] text-pc-text-secondary active:bg-[var(--pc-hover-strong)]">
                <qq.icon size={15} className="text-pc-accent" /> {qq.label}
              </button>
            ))}
          </div>
          <Composer key={prefill?.nonce ?? 0} onSend={send} prefill={prefill} hint={hint} onHintDismiss={() => setHint(null)} replyTo={replyTo} onReplyCancel={() => setReplyTo(null)} voice placeholder="Type or tap the mic" />
        </div>
      )}

      {lists && (
        <div className="fixed inset-0 z-30 flex items-end md:hidden" role="dialog" aria-modal="true" aria-label="Lists">
          <div className="absolute inset-0 bg-[var(--pc-scrim,rgba(0,0,0,0.3))]" onClick={() => setLists(null)} />
          <div className="relative flex h-[82dvh] w-full flex-col rounded-t-[22px] bg-pc-elevated pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-pc-text-faint/50" />
            <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-2">
              {tabs(lists, setLists)}
              <button type="button" onClick={() => void refresh()} className={iconBtn} aria-label="Refresh"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
              <button type="button" onClick={() => setLists(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pc-surface text-pc-text-muted" aria-label="Close"><X size={16} strokeWidth={2.5} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{listBody(lists)}</div>
          </div>
        </div>
      )}

      {sheet && <ItemSheet id={sheet} onClose={() => setSheet(null)} onChanged={() => void refresh()} onAsk={(t, s) => { setSheet(null); putInComposer(t, s); }} />}
      {settings && (
        <SettingsSheet person={person} mode={mode} look={look} onLook={onLook} push={pushState} onTogglePush={() => void togglePush()}
          onView={v => switchUiMode(v)} onLogout={() => { setSettings(false); logout(); }} onClose={() => setSettings(false)} />
      )}
    </div>
  );
}

