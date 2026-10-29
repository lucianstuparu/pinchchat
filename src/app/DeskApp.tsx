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
import { dropRepeatedFailures, failedTurn } from '../mobile/notice';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Bell, CalendarClock, History, ShoppingCart, ChevronRight, Copy, Languages, ListChecks, Lightbulb, MessageSquare, Search, StickyNote, X, type LucideIcon } from 'lucide-react';
import { getLook, lookVars, setLook, useMode, useThemeChrome, type Look } from './themes';
import { useGateway } from '../hooks/useGateway';
import { useNotifications, setBaseTitle } from '../hooks/useNotifications';
import { LoginScreen } from '../components/LoginScreen';
import { getStoredCredentials } from '../lib/credentials';
import type { ChatMessage } from '../types';
import { MessageBubble } from '../mobile/MessageBubble';
import { collapseCliTurns, isShownInMessenger, visibleText, withoutLeadingQuote } from '../mobile/messageView';
import { Composer, type ComposerPrefill, type Intent } from '../mobile/Composer';
import { QuestionCard } from '../mobile/QuestionCard';
import { useQuestions } from '../mobile/useQuestions';
import { switchUiMode } from '../mobile/uiMode';
import { disablePush, enablePush, getPushState, type PushState } from '../mobile/pushNotifications';
import type { OutgoingAttachment } from '../mobile/attachments';
import { KeepNote } from '../notes/KeepNote';
import { clearShareParam, pendingShareId, takeSharedContent } from '../share/shareInbox';
import { searchMessages, snippet } from '../mobile/searchMessages';
import { useDeepSearch } from '../ui/useDeepSearch';
import { AskRow, Marked, SearchGroup, SearchRow, SearchingLine } from '../ui/SearchParts';
import { loadedMatch, markedParts, plainOf, wordParts } from '../ui/searchText';
import { useDelayedFlag } from '../ui/progress';
import { act, fetchLoops, fetchNow, transcribeAudio, whoami, SessionExpired, type Loop, type NowItem } from './api';
import { DueChip, Title, TodoPanel, type TodoTab } from './Todo';
import { TOPIC_COLORS, groupTodo, matches, plainTitle, railOf } from './todoRules';
import { opsFor, type Move } from '../ui/dragRules';
import { ItemSheet } from './ItemSheet';
import { ItemChips } from './ItemChips';
import { WaCards } from './WaCard';
import { SettingsSheet } from './SettingsSheet';
import { RulesSheet } from './RulesSheet';
import { NotificationsSheet } from './NotificationsSheet';
import { UndoBar, type UndoInfo } from './UndoBar';
import { useBackLayer, useExactSizes } from '../ui/useBackLayer';
import { AppHeader, IconButton, SearchHeader } from '../ui/Controls';
import { useNotice } from './notice';

const OUTBOX_KEY = 'openclaw-pwa:outbox';
/** Relay, the messages app: msg.stuparu.eu since 2026-10-25 (VITE_WA_URL; /wa/ on this host redirects there). */
const WA_APP = import.meta.env.VITE_WA_URL || 'https://msg.stuparu.eu/';
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

/** Quick starts: they set the intent of the next message (app v2 §2), shown as a coloured label. */
type Tone = { bg: string; ink: string; inkDark: string; rail: string };
const VIOLET: Tone = { rail: '#7c5cd6', bg: '#efeafd', ink: '#5b3fb5', inkDark: '#b9a6f5' };
const GOLD: Tone = { rail: '#c48a00', bg: '#fbf1d0', ink: '#7a5a00', inkDark: '#f0c94a' };
const QUICK: Array<{ key: string; label: string; icon: LucideIcon; prefix: string; tone: Tone; placeholder: string }> = [
  { key: 'task', label: 'Task', icon: ListChecks, prefix: 'Task: ', tone: TOPIC_COLORS.Admin, placeholder: 'What needs doing?' },
  { key: 'remind', label: 'Remind me', icon: Bell, prefix: 'Remind me ', tone: TOPIC_COLORS.People, placeholder: 'What, and when?' },
  { key: 'buy', label: 'Buy', icon: ShoppingCart, prefix: 'Buy ', tone: GOLD, placeholder: 'What to buy, and where?' },
  { key: 'note', label: 'Note', icon: StickyNote, prefix: 'Note: ', tone: TOPIC_COLORS.Money, placeholder: 'What to keep?' },
  { key: 'translate', label: 'Translate', icon: Languages, prefix: 'Translate: ', tone: VIOLET, placeholder: 'Text to translate' },
  { key: 'think', label: 'Think through', icon: Lightbulb, prefix: 'Let’s think through: ', tone: TOPIC_COLORS.Errands, placeholder: 'What’s on your mind?' },
];
const toneStyle = (t: Tone, mode: string) => (mode === 'dark' ? { background: `${t.rail}33`, color: t.inkDark } : { background: t.bg, color: t.ink });

export default function DeskApp() {
  const [look, setLookState] = useState<Look>(getLook);
  useExactSizes();
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

function Desk({ gw, look, mode, onLook }: { gw: ReturnType<typeof useGateway>; look: Look; mode: 'light' | 'dark'; onLook: (l: Look) => void }) {
  const { status, messages, isLoadingHistory, activeSession, sendMessage, logout, getClient, addEventListener, switchSession, hasFullHistory, loadFullHistory } = gw;
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
  const [todoOpen, setTodoOpen] = useState(false);
  // Notes: a share waiting for "Keep as a note", the list to reload, a note to open.
  const [keeping, setKeeping] = useState<{ text: string; attachments: OutgoingAttachment[] } | null>(null);
  const [notesKey, setNotesKey] = useState(0);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  // Laptop: To do is a column beside the chat; phone: a full-screen panel. Only one is mounted, so
  // the New task box (its draft, its busy state) exists once.
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);          // To do, full screen (phone)
  const [tab, setTab] = useState<TodoTab>('todo');
  const [selected, setSelected] = useState<Set<string> | null>(null);   // multi-select for copying
  const [sheet, setSheet] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, dismissNotice] = useNotice();
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

  // Undo (the bar at the bottom): the server keeps each item's previous state and puts it back.
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const closeUndo = useCallback(() => setUndo(null), []);
  const offerUndo = (id: string, label: string) => setUndo({
    key: Date.now(), label,
    undo: () => { void act(id, 'undo').catch(e => setHint(e instanceof Error ? e.message : 'Could not undo')).finally(() => void refresh()); },
  });
  const undoBar = <UndoBar info={undo} onClose={closeUndo} />;
  const short = (i: { n?: number; title: string }) => `${i.n != null ? `${i.n} · ` : ''}${plainTitle(i.title)}`;
  const doAct = async (item: NowItem, action: 'done' | 'snooze') => {
    setNow(n => ({ ...n, items: n.items.filter(i => i.id !== item.id) }));   // optimistic
    try {
      const r = await act(item.id, action);
      const next = r.next_due ? ` · next ${new Date(`${r.next_due}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : '';
      offerUndo(item.id, `${action === 'done' ? (item.kind === 'bill' ? 'Paid' : 'Done') : 'Put off 3 days'}: ${short(item)}${next}`);
    }
    catch (e) { setHint(e instanceof Error ? e.message : 'Could not change it'); }
    finally { void refresh(); }
  };
  // ★ = priority (P1); taking the star off makes it normal (P3).
  const star = async (item: NowItem) => {
    const priority = item.priority === 'P1' ? 'P3' : 'P1';
    setNow(n => ({ ...n, items: n.items.map(i => (i.id === item.id ? { ...i, priority } : i)) }));
    try { await act(item.id, 'priority', { priority }); offerUndo(item.id, `${priority === 'P1' ? 'Priority' : 'No longer a priority'}: ${short(item)}`); }
    catch (e) { setHint(e instanceof Error ? e.message : 'Could not change it'); }
    finally { void refresh(); }
  };

  // A drag in To do: into or out of the Now box, or a new order. One Undo puts everything back.
  const move = async (m: Move<NowItem>) => {
    const { ops, undo: back, patch } = opsFor(m, now.items, now.today);
    if (!ops.length) return;
    setNow(n => ({ ...n, items: patch(n.items) }));
    const run = (o: typeof ops) => Promise.all(o.map(x => act(x.id, x.action, x.extra)));
    try {
      await run(ops);
      if (m.focus === undefined) return;   // a new order needs no Undo (Lucian 2026-10-26)
      const label = m.focus ? 'Put in Now' : 'Taken out of Now';
      setUndo({ key: Date.now(), label: `${label}: ${short(m.item)}`, undo: () => { void run(back).catch(e => setHint(e instanceof Error ? e.message : 'Could not undo')).finally(() => void refresh()); } });
    } catch (e) { setHint(e instanceof Error ? e.message : 'Could not change it'); }
    finally { void refresh(); }
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

  // WhatsApp has its own app since 2026-10-25 (Relay; Lucian: "a separate scope"). A WhatsApp
  // notification ("Bunica: …", ?wa=<contact id>) and the icon's WhatsApp shortcut open it there; the
  // assistant here still prepares a WhatsApp when asked in the chat (the card with Send).
  useEffect(() => {
    const url = new URL(window.location.href);
    const wa = url.searchParams.get('wa');
    if (wa) window.location.replace(`${WA_APP}?c=${encodeURIComponent(wa)}`);
  }, []);

  // A shortcut on the app icon (manifest "shortcuts", long-press): ?quick=task|remind|buy|… opens
  // straight into the box with that label; ?quick=voice starts a voice message.
  useEffect(() => {
    const url = new URL(window.location.href);
    const quick = url.searchParams.get('quick');
    if (!quick) return;
    url.searchParams.delete('quick');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    if (quick === 'wa') { window.location.replace(WA_APP); return; }
    const q = QUICK.find(x => x.key === quick);
    if (q) setPrefill({ nonce: Date.now(), text: '', attachments: [], intent: { label: q.label, prefix: q.prefix, icon: q.icon, style: toneStyle(q.tone, mode), placeholder: q.placeholder } });
    else if (quick === 'voice') setPrefill({ nonce: Date.now(), text: '', attachments: [], voice: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, at launch
  }, []);

  useEffect(() => {
    const id = pendingShareId();
    if (!id) return;
    clearShareParam();
    if (id === 'failed') return;
    // A share asks first: keep it as a note (Lucian 2026-10-29), or send it in the chat as before.
    void takeSharedContent(id).then(shared => {
      if (!shared) { setHint('The shared content has expired.'); return; }
      setKeeping({ text: shared.text, attachments: shared.attachments });
      if (shared.rejected.length > 0) setHint(`Shared, but could not attach: ${shared.rejected.join(', ')}`);
    });
  }, []);
  const toChat = () => {
    if (!keeping) return;
    setPrefill({ nonce: Date.now(), text: keeping.text, attachments: keeping.attachments });
    setHint('Shared. Add a note if you like, then send.');
    setKeeping(null);
  };
  const kept = () => { setKeeping(null); setNotesKey(k => k + 1); setTab('notes'); setTodoOpen(true); setHint('Kept. The assistant is reading it.'); };
  const openNote = (id: string) => { setSearch(null); setTab('notes'); setTodoOpen(true); setNoteOpen(id); };

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
  const onReply = useCallback((msg: ChatMessage) => { setReplyTo({ text: withoutLeadingQuote(visibleText(msg)) || 'Photo', mine: msg.role === 'user' }); }, []);
  const putInComposer = (text: string, sendNow = false) => {
    setTodoOpen(false);
    if (sendNow) { send(text, []); return; }
    // A question about an item: a label naming it (number and title), never its id in the text.
    const about = text.match(/^(About|Schedule) ⟨([^⟩]+)⟩(: | for )$/);
    if (about) {
      const it = now.items.find(i => i.id === about[2]);
      const name = it ? `${it.n != null ? `${it.n} ` : ''}${plainTitle(it.title)}` : 'this item';
      const tone = TOPIC_COLORS[it?.topics?.[0] ?? ''];
      setPrefill({ nonce: Date.now(), text: '', attachments: [], intent: {
        label: `${about[1]} ${name.length > 28 ? `${name.slice(0, 27)}…` : name}`, prefix: text,
        icon: about[1] === 'About' ? MessageSquare : CalendarClock,
        style: tone ? toneStyle(tone, mode) : { background: 'var(--pc-hover-strong)', color: 'var(--pc-text)' },
        placeholder: about[1] === 'About' ? 'Your question' : 'When?',
      } });
      return;
    }
    setPrefill({ nonce: Date.now(), text, attachments: [] });
  };
  const putIntent = (q: typeof QUICK[number]) => {
    const intent: Intent = { label: q.label, prefix: q.prefix, icon: q.icon, style: toneStyle(q.tone, mode), placeholder: q.placeholder };
    setPrefill({ nonce: Date.now(), text: '', attachments: [], intent });
  };

  // A new reply may have filed or closed something: refresh the lists.
  const shown = useMemo(() => dropRepeatedFailures(collapseCliTurns(messages).filter(isShownInMessenger), visibleText), [messages]);
  const prevCount = useRef(messages.length);
  useEffect(() => {
    const before = prevCount.current; prevCount.current = messages.length;
    if (messages.length <= before) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !last.isStreaming && isShownInMessenger(last)) {
      const t = visibleText(last);
      notify(import.meta.env.VITE_APP_NAME || 'Chat', failedTurn(t)?.summary ?? (t.slice(0, 120) || 'New message'));
      void refresh();
    }
  }, [messages, notify, refresh]);

  // ---- scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollToBottom = useCallback((smooth = true) => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); }, []);
  useEffect(() => { if (atBottom && search === null) scrollToBottom(false); }, [shown, outbox, questions, atBottom, search, scrollToBottom]);
  // Going back in time (Lucian 2026-10-29: "see the full history of chat ... a button to switch to
  // progressive backward scroll"): the chat shows the newest WINDOW messages; scrolling near the top
  // shows WINDOW more, keeping what is on screen in place. At the top of the last 100, a button loads
  // the whole conversation from the gateway (up to 1000 messages) and scrolling goes on from there.
  const WINDOW = 60;
  const [windowSize, setWindowSize] = useState(WINDOW * 2);
  const [loadingAll, setLoadingAll] = useState(false);
  const visible = shown.length > windowSize ? shown.slice(-windowSize) : shown;
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const showOlder = useCallback(() => {
    const el = scrollRef.current;
    if (el) anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    setWindowSize(w => w + WINDOW);
  }, []);
  useLayoutEffect(() => {
    const el = scrollRef.current, a = anchor.current;
    if (!el || !a) return;
    anchor.current = null;
    el.scrollTop = a.top + (el.scrollHeight - a.height);
  }, [windowSize, shown.length]);
  const loadWhole = async () => {
    setLoadingAll(true);
    const el = scrollRef.current;
    if (el) anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    try { await loadFullHistory(); } finally { setLoadingAll(false); }
    setWindowSize(w => w + WINDOW);
  };
  const onScroll = () => {
    const el = scrollRef.current; if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    if (el.scrollTop < 400 && shown.length > windowSize && !anchor.current) showOlder();
  };

  // ---- search: To do, In progress and the conversation, together
  useBackLayer(search !== null, () => setSearch(null));   // Back leaves search, like any overlay

  const q = (search ?? '').trim().toLowerCase();
  const searching = search !== null && q.length >= 2;
  const found = useMemo(() => {
    if (!searching) return { todo: [] as NowItem[], progress: [] as Loop[], msgs: [] as ChatMessage[] };
    return {
      todo: now.items.filter(i => matches(i, q)),
      progress: loops.filter(l => has(q, l.title, l.state, l.next_step, l.domain)),
      msgs: searchMessages(shown, search ?? ''),
    };
  }, [searching, q, now.items, loops, shown, search]);
  // Then further: the server (closed items too, and by meaning) and the whole conversation (gateway).
  const deep = useDeepSearch(searching ? search : null, { path: '/reg/search', sessionKey: frontSession, getClient });
  const moreItems = useMemo(() => deep.server.filter(h => h.kind !== 'note' && !found.todo.some(i => i.id === h.ref) && !found.progress.some(l => l.id === h.ref)),
    [deep.server, found.todo, found.progress]);
  const noteHits = useMemo(() => deep.server.filter(h => h.kind === 'note'), [deep.server]);
  const olderMsgs = useMemo(() => deep.chat.filter(h => !loadedMatch(h, found.msgs)), [deep.chat, found.msgs]);
  const [openHit, setOpenHit] = useState<string | null>(null);
  const searchingFurther = useDelayedFlag(searching && deep.busy);
  const foundCount = found.todo.length + found.progress.length + found.msgs.length + moreItems.length + noteHits.length + olderMsgs.length;
  const jumpTo = (id: string) => {
    // A message above the window: widen it first, so the message is on screen to scroll to.
    const at = shown.findIndex(m => m.id === id);
    if (at >= 0 && shown.length - at > windowSize) setWindowSize(shown.length - at + 10);
    setSearch(null); setFlash(id);
    window.setTimeout(() => document.getElementById(`d-${id}`)?.scrollIntoView({ block: 'center' }), 50);
    window.setTimeout(() => setFlash(null), 1800);
  };
  const pendingHit = useRef<Parameters<typeof loadedMatch>[0] | null>(null);
  const openInWhole = async (h: Parameters<typeof loadedMatch>[0]) => {
    pendingHit.current = h;
    setLoadingAll(true);
    try { await loadFullHistory(); } finally { setLoadingAll(false); }
  };
  useEffect(() => {
    const h = pendingHit.current;
    if (!h || !hasFullHistory) return;
    const m = loadedMatch(h, shown);
    pendingHit.current = null;
    if (m) jumpTo(m.id); else setOpenHit(h.messageId);
  }, [shown, hasFullHistory]); // eslint-disable-line react-hooks/exhaustive-deps
  const askAssistant = () => { const text = (search ?? '').trim(); setSearch(null); setPrefill({ nonce: Date.now(), text, attachments: [] }); };

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
  // Items a message names become chips; a WhatsApp draft becomes its send card.
  const renderChips = useCallback((items: Array<{ id: string; label: string }>) => {
    const wa = items.filter(i => i.id.startsWith('wa-')), rest = items.filter(i => !i.id.startsWith('wa-'));
    return <>{wa.length > 0 && <WaCards ids={wa.map(i => i.id)} />}{rest.length > 0 && <ItemChips items={rest} onOpen={setSheet} />}</>;
  }, []);
  const name = person ? person[0].toUpperCase() + person.slice(1) : '';
  const dateTitle = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  // The bar leads with what To do leads with: the due box, then priorities, then the rest.
  // Put-off tasks wait out of the way: they do not count on the bar until their day.
  const active = useMemo(() => now.items.filter(i => !i.hidden), [now.items]);
  const top = useMemo(() => { const g = groupTodo(active, now.today); return g.due[0] ?? g.priority[0] ?? g.areas[0]?.items[0] ?? g.waiting[0]; }, [active, now.today]);
  const overdue = active.filter(i => i.section === 'overdue').length;

  // Adding from the To do screen: the text goes to the assistant as a task; its answer shows under the box.
  const [asked, setAsked] = useState<{ text: string; ts: number } | null>(null);
  const addTask = (text: string) => { send(`Task: ${text}`, []); setAsked({ text, ts: Date.now() }); };
  const taskReply = useMemo(() => {
    if (!asked) return null;
    const m = shown.find(x => x.role === 'assistant' && !x.isStreaming && x.timestamp > asked.ts);
    return { asked: asked.text, since: asked.ts, text: m ? visibleText(m) : null };
  }, [asked, shown]);

  // Swipe right on the chat opens To do; swipe left on To do closes it (phone only). A swipe on a
  // message (left = reply) or a task (right = done) is theirs: the direction tells them apart.
  const [drag, setDrag] = useState<number | null>(null);
  const gesture = useRef<{ x: number; y: number; horizontal: boolean | null; from: 'chat' | 'panel' } | null>(null);
  const swipeStart = (from: 'chat' | 'panel') => (e: React.TouchEvent) => {
    if (window.matchMedia('(min-width: 768px)').matches || (from === 'chat') === todoOpen) return;
    const x = e.touches[0].clientX;
    if (x < 28 || x > window.innerWidth - 28) return;   // the edges are the phone's Back gesture
    gesture.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null, from };
  };
  const swipeMove = (e: React.TouchEvent) => {
    const g = gesture.current; if (!g) return;
    const dx = e.touches[0].clientX - g.x, dy = e.touches[0].clientY - g.y;
    if (g.horizontal === null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) g.horizontal = Math.abs(dx) > Math.abs(dy) * 1.3 && (g.from === 'chat' ? dx > 0 : dx < 0);
    if (g.horizontal) setDrag(g.from === 'chat' ? Math.max(0, dx) : Math.min(0, dx));
  };
  const swipeEnd = () => {
    const g = gesture.current; gesture.current = null;
    if (g?.horizontal && drag !== null) {
      if (g.from === 'chat' && drag > 70) { setTab('todo'); setTodoOpen(true); }
      if (g.from === 'panel' && drag < -70) setTodoOpen(false);
    }
    setDrag(null);
  };
  // The phone's Back (the edge swipes, which the system owns) closes To do, as any top layer
  // (ui/useBackLayer.ts); on the chat Back leaves the app.
  useBackLayer(todoOpen, () => setTodoOpen(false));

  const panel = (onClose?: () => void) => (
    <TodoPanel mode={mode} tab={tab} onTab={setTab} items={now.items} loops={loops} today={now.today}
      loaded={loaded} expired={expired} refreshing={refreshing} onRefresh={() => void refresh()}
      onDone={i => void doAct(i, 'done')} onStar={i => void star(i)} onOpen={setSheet} onMove={m => void move(m)}
      onContinue={l => putInComposer(`Continue: ${l.title} ⟨${l.id}⟩`, true)}
      onAdd={addTask} transcribe={transcribeAudio} reply={taskReply} onDismissReply={() => setAsked(null)} onClose={onClose}
      footer={onClose && todoOpen && !sheet && undo ? undoBar : null}
      notesKey={notesKey} noteOpen={noteOpen} onNoteOpened={() => setNoteOpen(null)} />
  );

  // The pinned card over the chat (phone): the most pressing thing, and how much else is waiting.
  // It sits on a band with a shadow edge, so the chat clearly scrolls under it.
  const moreOverdue = overdue - (top?.section === 'overdue' ? 1 : 0);
  const pinnedBar = (
    <div className="relative z-10 bg-pc-base px-3 pb-2 pt-2 shadow-[0_10px_12px_-12px_rgba(0,0,0,0.35)] md:hidden">
      <button type="button" onClick={() => { setTab('todo'); setTodoOpen(true); }} aria-label="Open To do"
        className="flex w-full items-center gap-3 rounded-[12px] bg-pc-elevated px-4 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_14px_rgba(0,0,0,0.10)] ring-1 ring-[var(--pc-separator)] active:scale-[0.99]">
        <span className="min-w-0 flex-1">
          {!loaded ? <span className="block text-[16px] text-pc-text-muted">{expired ? 'Signed out of the lists' : 'To do'}</span>
            : top ? (
              <>
                <span className="flex items-baseline gap-1.5 text-[16px] leading-tight">
                  {top.n != null && <span className="shrink-0 font-bold tabular-nums" style={{ color: railOf(top) }}>{top.n}</span>}
                  <Title text={top.title} className="min-w-0 truncate" />
                </span>
                <span className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-tight text-pc-text-muted">
                  <DueChip item={top} today={now.today} mode={mode} />
                  <span className="truncate">
                    {[moreOverdue > 0 ? `${moreOverdue} more overdue` : active.length > 1 ? `${active.length - 1} more to do` : '', loops.length > 0 ? `${loops.length} in progress` : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="block text-[16px] font-medium leading-tight">All clear</span>
                <span className="mt-1 block text-[13px] leading-tight text-pc-text-muted">{loops.length > 0 ? `${loops.length} in progress` : 'Nothing needs you right now'}</span>
              </>
            )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-pc-text-faint" />
      </button>
    </div>
  );

  const searchResults = (
    <div className="px-3 pb-4 pt-2">
      {!searching && <p className="px-2 py-10 text-center text-[15px] text-pc-text-muted">Search your to-dos, what’s in progress and the conversation.</p>}
      {searching && foundCount === 0 && !deep.busy && <p className="px-2 py-10 text-center text-[15px] text-pc-text-muted">Nothing matches “{search?.trim()}”</p>}
      {found.todo.length > 0 && (
        <section className="mb-4">
          <h3 className="px-2 pb-1 text-[13px] font-semibold text-pc-text-muted">To do</h3>
          <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-surface">
            {found.todo.map(i => (
              <button key={i.id} type="button" onClick={() => setSheet(i.id)} className="flex w-full items-baseline gap-2 px-4 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
                <span className="w-6 shrink-0 text-right text-[15px] font-bold tabular-nums" style={{ color: railOf(i) }}>{i.n ?? ''}</span>
                <span className="min-w-0 flex-1">
                  <Title text={i.title} className="block truncate text-[15px]" />
                  <span className="mt-1 block"><DueChip item={i} today={now.today} mode={mode} /></span>
                </span>
              </button>))}
          </div>
        </section>
      )}
      {found.progress.length > 0 && (
        <section className="mb-4">
          <h3 className="px-2 pb-1 text-[13px] font-semibold text-pc-text-muted">In progress</h3>
          <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-surface">
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
          <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-surface">
            {found.msgs.map(m => { const sn = snippet(visibleText(m), search ?? ''); return (
              <button key={m.id} type="button" onClick={() => jumpTo(m.id)} className="block w-full px-4 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
                <span className="mb-0.5 block text-[12px] text-pc-text-muted">{m.role === 'user' ? 'You' : 'Assistant'} · {dayLabel(m.timestamp)}</span>
                <span className="line-clamp-2 text-[15px] leading-snug">{sn.before}<mark className="rounded bg-[rgba(var(--pc-accent-rgb),0.25)] px-0.5 text-pc-text-primary">{sn.match}</mark>{sn.after}</span>
              </button>); })}
          </div>
        </section>
      )}
      {moreItems.length > 0 && (
        <SearchGroup title={found.todo.length + found.progress.length > 0 ? 'More, including done' : 'To-dos, including done'}>
          {moreItems.map(h => (
            <SearchRow key={h.id} onOpen={() => setSheet(h.ref)} title={h.title} byMeaning={!h.via.includes('words')}
              excerpt={h.snippet && plainOf(h.snippet) !== h.title ? <Marked parts={markedParts(h.snippet)} /> : undefined} />
          ))}
        </SearchGroup>
      )}
      {noteHits.length > 0 && (
        <SearchGroup title="Notes">
          {noteHits.map(h => (
            <SearchRow key={h.id} onOpen={() => openNote(h.ref)} icon={<StickyNote size={18} />} title={h.title} byMeaning={!h.via.includes('words')}
              excerpt={h.snippet && plainOf(h.snippet) !== h.title ? <Marked parts={markedParts(h.snippet)} /> : undefined} />
          ))}
        </SearchGroup>
      )}
      {olderMsgs.length > 0 && (
        <SearchGroup title={found.msgs.length > 0 ? 'Earlier in the conversation' : 'Conversation'}>
          {olderMsgs.map(h => {
            const onScreen = loadedMatch(h, shown);
            const open = openHit === h.messageId;
            return (
              <button key={h.messageId} type="button" onClick={() => (onScreen ? jumpTo(onScreen.id) : !hasFullHistory ? void openInWhole(h) : setOpenHit(open ? null : h.messageId))}
                className="block w-full px-4 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
                <span className="mb-0.5 block text-[12px] text-pc-text-muted">{h.role === 'user' ? 'You' : 'Assistant'} · {dayLabel(h.timestamp)}</span>
                <Marked parts={wordParts(h.snippet.trim(), search ?? '')} className={`text-[15px] leading-snug ${open ? 'whitespace-pre-wrap' : 'line-clamp-2'}`} />
              </button>
            );
          })}
        </SearchGroup>
      )}
      {searching && <SearchingLine show={searchingFurther} />}
      {searching && <AskRow query={(search ?? '').trim()} onAsk={askAssistant} />}
    </div>
  );

  const chat = (
    <>
      {isLoadingHistory && shown.length === 0 && <p className="py-6 text-center text-[12px] text-pc-text-muted">Loading…</p>}
      {!isLoadingHistory && shown.length === 0 && outbox.length === 0 && (
        <div className="px-10 py-16 text-center">
          <p className="text-[17px] font-semibold">What’s on your mind?</p>
          <p className="mt-1 text-[15px] text-pc-text-muted">A task, a note, a link, a photo, a question. Type it or tap the mic and say it.</p>
        </div>
      )}
      {shown.length > visible.length ? (
        <div className="flex justify-center py-3"><span className="text-[12px] text-pc-text-muted">Scroll up for earlier messages</span></div>
      ) : shown.length > 0 && !hasFullHistory ? (
        <div className="flex justify-center py-3">
          <button type="button" onClick={() => void loadWhole()} disabled={loadingAll}
            className="press inline-flex h-10 items-center gap-2 rounded-full bg-pc-surface px-4 text-[14px] font-medium text-pc-text-secondary disabled:opacity-60">
            <History size={16} aria-hidden /> {loadingAll ? 'Loading the whole conversation…' : 'Show the whole conversation'}
          </button>
        </div>
      ) : shown.length > 0 ? (
        <div className="flex justify-center py-3"><span className="text-[12px] text-pc-text-muted">Start of the conversation</span></div>
      ) : null}
      {visible.map((msg, i) => {
        const prev = visible[i - 1];
        const newDay = !prev || new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
        const firstOfRun = newDay || prev.role !== msg.role;
        return (
          <div key={msg.id} id={`d-${msg.id}`} className={`transition-colors duration-1000 ${firstOfRun && i > 0 ? 'pt-2' : ''} ${flash === msg.id ? 'rounded-[12px] bg-[rgba(var(--pc-accent-rgb),0.12)]' : ''}`}>
            {newDay && <div className="flex justify-center pb-2 pt-3"><span className="text-[12px] font-medium text-pc-text-muted">{dayLabel(msg.timestamp)}</span></div>}
            <MessageBubble msg={msg} onRetry={retry} onReply={onReply} showAvatar={firstOfRun} renderItems={renderChips}
              selecting={selected !== null} selected={!!selected?.has(msg.id)} onSelect={toggleSelect} />
          </div>
        );
      })}
      {outbox.map((item, i) => (
        <MessageBubble key={item.id} showAvatar={i === 0 && shown[shown.length - 1]?.role !== 'user'}
          msg={{ id: item.id, role: 'user', content: item.text, timestamp: item.queuedAt, blocks: [{ type: 'text', text: item.text || `${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}` }], sendStatus: 'sending' }} />
      ))}
      {questions.map(qq => <QuestionCard key={qq.id} record={qq} onAnswer={answer} onSkip={skip} />)}
    </>
  );


  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[color-mix(in_srgb,var(--pc-bg-base)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        {selected !== null ? (
          <div className="flex h-[52px] items-center gap-1 px-2">
            <IconButton label="Cancel selection" onClick={() => setSelected(null)}><X size={22} /></IconButton>
            <span className="min-w-0 flex-1 px-1 text-[16px] font-medium">{selected.size} selected</span>
            <button type="button" disabled={selected.size === 0} onClick={() => void copySelected()} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-pc-accent px-4 text-[15px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50"><Copy size={16} /> Copy</button>
          </div>
        ) : search !== null ? (
          <SearchHeader value={search} onChange={setSearch} onCancel={() => setSearch(null)} placeholder="Search to-dos and messages" />
        ) : (
          <AppHeader title={name ? `Hi, ${name}` : 'Chat'} subtitle={dateTitle} initial={name ? name[0] : '…'} onSettings={() => setSettings(true)}
            actions={<IconButton label="Search" onClick={() => setSearch('')}><Search size={22} /></IconButton>} />
        )}
        {statusLine && search === null && <div className="flex h-6 items-center justify-center bg-amber-500/15 text-[12px] text-amber-700" role="status">{statusLine}</div>}
        {person === '' && !isLocal() && <div className="flex h-6 items-center justify-center bg-red-500/15 text-[12px] text-red-600" role="status">Not signed in · <a href="/" className="ml-1 underline">sign in</a></div>}
      </header>

      <div className="flex min-h-0 flex-1 md:flex-row">
        {wide && <aside className="flex w-[420px] shrink-0 flex-col border-r border-pc-border">{panel()}</aside>}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {search === null && notice && (
            <div className="mx-3 mt-2 flex items-start gap-3 rounded-[12px] border border-[rgba(var(--pc-accent-rgb),0.35)] bg-[rgba(var(--pc-accent-rgb),0.08)] px-3.5 py-3" role="status" aria-label="Notification">
              <Bell size={18} className="mt-0.5 shrink-0 text-pc-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">{notice.title}</p>
                {notice.body && <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-snug text-pc-text-secondary">{notice.body}</p>}
                <p className="mt-1 text-[12px] text-pc-text-muted">
                  Notification · {new Date(notice.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  {notice.item && <> · <button type="button" onClick={() => { setSheet(notice.item!); dismissNotice(); }} className="font-medium text-pc-accent">Open it</button></>}
                </p>
              </div>
              <button type="button" onClick={dismissNotice} className="-m-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted active:bg-[var(--pc-hover-strong)]" aria-label="Dismiss"><X size={16} /></button>
            </div>
          )}
          {search === null && pinnedBar}
          <main ref={scrollRef} onScroll={onScroll} onTouchStart={swipeStart('chat')} onTouchMove={swipeMove} onTouchEnd={swipeEnd} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2" role="log" aria-live="polite">
            {search !== null ? searchResults : <div className="space-y-1 pt-1 md:px-2">{chat}</div>}
          </main>
          {!atBottom && search === null && (
            <button type="button" onClick={() => scrollToBottom()} className="absolute bottom-3 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-pc-border bg-pc-elevated shadow-lg" aria-label="Scroll to latest"><ArrowDown size={18} /></button>
          )}
        </div>
      </div>

      {search === null && (
        <div className="shrink-0 border-t border-pc-border bg-pc-base">
          {!sheet && !todoOpen && undoBar}
          <div className="flex gap-2 overflow-x-auto px-3 pt-2 [&::-webkit-scrollbar]:hidden" aria-label="Quick starts" style={{ scrollbarWidth: 'none' }}>
            {QUICK.map(qq => (
              <button key={qq.label} type="button" onClick={() => putIntent(qq)}
                className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-pc-surface px-3.5 text-[15px] text-pc-text-secondary active:bg-[var(--pc-hover-strong)]">
                <qq.icon size={16} style={{ color: mode === 'dark' ? qq.tone.inkDark : qq.tone.rail }} /> {qq.label}
              </button>
            ))}
          </div>
          <Composer key={prefill && !prefill.intent ? prefill.nonce : 0} onSend={send} prefill={prefill} hint={hint} onHintDismiss={() => setHint(null)} replyTo={replyTo} onReplyCancel={() => setReplyTo(null)} voice transcribe={transcribeAudio} placeholder="Message" />
        </div>
      )}

      {/* To do, full screen (phone): slides in from the left, follows the finger. */}
      {!wide && (
        <div className="fixed inset-0 z-30 shadow-2xl md:hidden" role="dialog" aria-modal="true" aria-label="To do" inert={!todoOpen}
          onTouchStart={swipeStart('panel')} onTouchMove={swipeMove} onTouchEnd={swipeEnd}
          style={{
            transform: todoOpen ? `translateX(${drag !== null && drag < 0 ? drag : 0}px)` : `translateX(calc(-100% - 24px + ${drag !== null && drag > 0 ? drag : 0}px))`,
            transition: drag !== null ? 'none' : 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}>
          {panel(() => setTodoOpen(false))}
        </div>
      )}

      {sheet && <ItemSheet id={sheet} footer={undo ? undoBar : null} onClose={() => setSheet(null)} onChanged={() => void refresh()} onAsk={(t, s) => { setSheet(null); putInComposer(t, s); }}
        onActed={(id, action, title) => {
          const said: Partial<Record<string, string>> = { done: 'Done', drop: 'Not needed', snooze: 'Reminder in 3 days', reopen: 'Reopened', priority: 'Priority changed', edit: 'Saved', 'loop-close': 'Settled' };
          if (said[action]) offerUndo(id, `${said[action]}: ${plainTitle(title)}`);
        }} />}
      {settings && (
        <SettingsSheet person={person} mode={mode} look={look} onLook={onLook} push={pushState} onTogglePush={() => void togglePush()}
          onRules={() => { setSettings(false); setRulesOpen(true); }}
          onHistory={() => { setSettings(false); setHistoryOpen(true); }}
          onView={v => switchUiMode(v)} onLogout={() => { setSettings(false); logout(); }} onClose={() => setSettings(false)} />
      )}
      {rulesOpen && <RulesSheet mode={mode} onClose={() => setRulesOpen(false)} />}
      {keeping && <KeepNote base="/reg" shared={keeping} onKept={kept} onChat={toChat} onClose={() => setKeeping(null)} />}
      {historyOpen && <NotificationsSheet mode={mode} onOpenItem={id => { setHistoryOpen(false); setSheet(id); }} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

