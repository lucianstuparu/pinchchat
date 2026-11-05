/**
 * Kids, the kids app (kids.stuparu.eu; ai.manager kids-app.md): one chat shared by Lucian and
 * Ludmila with the kids assistant (agent `kids`, session agent:kids:main), the children's list beside
 * it (Săptămâna · Activități · Idei · Planuri) and the item sheet. Romanian, French school terms kept.
 * Built like Casa Artlia from oc's parts: the input bar, the bubbles, the sheet, the undo bar.
 *
 * Each message goes out as "[Name] text", so both see who said what; the bubbles show the other
 * person's messages on the left with their initial.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, CalendarDays, ChevronRight, Languages, Lightbulb, ListChecks, MessageSquare, Plus, RefreshCw, type LucideIcon } from 'lucide-react';
import { getLook, lookVars, setLook, useMode, useThemeChrome, type Look } from '../app/themes';
import { useGateway } from '../hooks/useGateway';
import { LoginScreen } from '../components/LoginScreen';
import { getStoredCredentials } from '../lib/credentials';
import type { ChatMessage } from '../types';
import { MessageBubble } from '../mobile/MessageBubble';
import { collapseCliTurns, isShownInMessenger, senderOf, visibleText, withoutLeadingQuote } from '../mobile/messageView';
import { extractItems } from '../mobile/messageItems';
import { dropRepeatedFailures, failedTurn } from '../mobile/notice';
import { Composer, type ComposerPrefill, type Intent } from '../mobile/Composer';
import { QuestionCard } from '../mobile/QuestionCard';
import { useQuestions } from '../mobile/useQuestions';
import type { OutgoingAttachment } from '../mobile/attachments';
import { useNotifications, setBaseTitle } from '../hooks/useNotifications';
import { SessionExpired, transcribeAudio, whoami } from '../app/api';
import { UndoBar, type UndoInfo } from '../app/UndoBar';
import { Sheet, CloseButton } from '../ui/Sheet';
import { AppHeader, IconButton, Segmented } from '../ui/Controls';
import { useBackLayer, useExactSizes } from '../ui/useBackLayer';
import { useDelayedFlag } from '../ui/progress';
import { actOn, cachedList, fetchList, roError, type KidAction, type KidItem, type KidList } from './api';
import { ActivitiesView, ChildNames, IdeasView, NextBand, PlansView, WeekView } from './Lists';
import { KidSheet } from './KidSheet';
import { isOpen, topOf, withSender } from './rules';

const SESSION = 'agent:kids:main';
const OUTBOX_KEY = 'kids:outbox';
const isLocal = () => ['127.0.0.1', 'localhost'].includes(window.location.hostname);

interface OutboxItem { id: string; text: string; attachments: OutgoingAttachment[]; queuedAt: number }
function loadOutbox(): OutboxItem[] {
  try { return (JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') as OutboxItem[]).map(r => ({ ...r, attachments: [] })); } catch { return []; }
}
function saveOutbox(items: OutboxItem[]) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.map(i => ({ id: i.id, text: i.text, queuedAt: i.queuedAt })))); } catch { /* storage unavailable */ }
}
function dayLabel(ts: number): string {
  const d = new Date(ts), today = new Date(), y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Azi';
  if (d.toDateString() === y.toDateString()) return 'Ieri';
  return d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
}

const short = (i: KidItem) => `${i.n != null ? `${i.n} · ` : ''}${i.title.replace(/\*\*/g, '')}`;

/** Quick starts: what the next message is, as a coloured label in the box. */
type Tone = { rail: string; bg: string; ink: string; inkDark: string };
const QUICK: Array<{ key: string; label: string; icon: LucideIcon; prefix: string; tone: Tone; placeholder: string }> = [
  { key: 'todo', label: 'De făcut', icon: ListChecks, prefix: 'De făcut: ', tone: { rail: '#1d9e75', bg: '#e1f5ee', ink: '#0f6e56', inkDark: '#5fd3a9' }, placeholder: 'Ce trebuie făcut, pentru cine, până când?' },
  { key: 'activity', label: 'Activitate', icon: CalendarDays, prefix: 'Activitate: ', tone: { rail: '#378add', bg: '#e6f1fb', ink: '#0c447c', inkDark: '#8cc0f5' }, placeholder: 'Ce, pentru cine, ce zi și oră, unde?' },
  { key: 'translate', label: 'Traduce', icon: Languages, prefix: 'Traduce și explică: ', tone: { rail: '#ba7517', bg: '#faeeda', ink: '#854f0b', inkDark: '#e9b467' }, placeholder: 'Lipește mesajul sau adaugă o poză' },
  { key: 'idea', label: 'Idee', icon: Lightbulb, prefix: 'Idee: ', tone: { rail: '#7c5cd6', bg: '#efeafd', ink: '#5b3fb5', inkDark: '#b9a6f5' }, placeholder: 'Ce idee, și ce trebuie pentru ea?' },
];
const quickStyle = (t: Tone, mode: string) => (mode === 'dark' ? { background: `${t.rail}33`, color: t.inkDark } : { background: t.bg, color: t.ink });

export default function KidsApp() {
  // The kids app's own colour (green); the appearance (auto / light / dark) is kept per phone.
  const [look, setLookState] = useState<Look>(() => ({ ...getLook(), accent: 'green' }));
  useExactSizes();
  const mode = useMode(look.appearance);
  useThemeChrome(mode);
  const gw = useGateway();
  const savedLogin = getStoredCredentials() !== null;
  const networkOnly = !gw.connectError || gw.connectError.startsWith('Connection failed');
  const chooseLook = (l: Look) => { setLook(l); setLookState({ ...l, accent: 'green' }); };
  return (
    <div lang="ro" style={lookVars(mode, look.accent)} className="h-dvh bg-pc-base text-pc-text antialiased">
      {!gw.authenticated && !(savedLogin && networkOnly)
        ? <LoginScreen onConnect={gw.login} error={gw.connectError} isConnecting={gw.isConnecting} />
        : <Desk gw={gw} look={look} mode={mode} onLook={chooseLook} />}
    </div>
  );
}

type Tab = 'week' | 'acts' | 'ideas' | 'plans';

function Desk({ gw, look, mode, onLook }: { gw: ReturnType<typeof useGateway>; look: Look; mode: 'light' | 'dark'; onLook: (l: Look) => void }) {
  const { status, messages, isLoadingHistory, activeSession, sendMessage, logout, getClient, addEventListener, switchSession } = gw;
  const [person, setPerson] = useState<string | null>(null);
  // Who is signed in: asked again when the phone comes back online or the app comes to the front.
  // An empty answer counts only while online (offline, the request fails the same way).
  const askWho = useCallback(() => {
    void whoami().then(p => setPerson(prev => (p ? p : navigator.onLine ? (prev || '') : prev)));
  }, []);
  useEffect(() => {
    askWho();
    const onVisible = () => { if (document.visibilityState === 'visible') askWho(); };
    window.addEventListener('online', askWho);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('online', askWho); document.removeEventListener('visibilitychange', onVisible); };
  }, [askWho]);
  const name = person ? person[0].toUpperCase() + person.slice(1) : (person === '' && isLocal() ? 'Lucian' : '');

  // One shared chat; fail closed without an identity (except in local dev).
  const allowed = !!person || (person === '' && isLocal());
  const ready = status === 'connected' && allowed && gw.agents.includes('kids');
  useEffect(() => { if (ready && activeSession !== SESSION) switchSession(SESSION); }, [ready, activeSession, switchSession]);
  // Only the shared kids chat is ever shown, sent to or notified from (never another session).
  const onKids = ready && activeSession === SESSION;

  // ---- the list (last copy first, then the server)
  const [list, setList] = useState<KidList | null>(cachedList);
  const [loadState, setLoadState] = useState<'ok' | 'offline' | 'expired'>('ok');
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++latest.current;   // answers can arrive out of order: only the latest one counts
    setRefreshing(true);
    try { const l = await fetchList(); if (mine === latest.current) { setList(l); setLoadState('ok'); } }
    catch (e) { if (mine === latest.current) setLoadState(e instanceof SessionExpired && navigator.onLine ? 'expired' : 'offline'); }
    finally { if (mine === latest.current) setRefreshing(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5 * 60_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(t); };
  }, [refresh]);
  const spinning = useDelayedFlag(refreshing && !list);

  // ---- panel, sheet, undo
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('week');
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  useBackLayer(panelOpen, closePanel);
  const sheetItem = list?.items.find(i => i.id === sheetId) ?? null;
  // A sheet opens only for an item in the list; one that leaves the list closes its sheet.
  const openSheet = useCallback((id: string) => {
    if (list?.items.some(i => i.id === id)) setSheetId(id); else setHint('Nu mai e în listă');
  }, [list]);
  useEffect(() => { if (sheetId && list && !list.items.some(i => i.id === sheetId)) setSheetId(null); }, [sheetId, list]);

  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const closeUndo = useCallback(() => setUndo(null), []);
  const SAID: Partial<Record<KidAction, string>> = { done: 'Făcut', snooze: 'Amânat 3 zile', drop: 'Nu mai e nevoie', reopen: 'Redeschis', edit: 'Salvat', note: 'Notă adăugată', calendar: 'Pus în calendar', uncalendar: 'Scos din calendar' };
  // Undo of a calendar change is the opposite change; of the rest, the item's own undo.
  const BACK: Partial<Record<KidAction, KidAction>> = { calendar: 'uncalendar', uncalendar: 'calendar' };
  const swap = (id: string, next: KidItem) => setList(l => (l ? { ...l, items: l.items.map(i => (i.id === id ? next : i)) } : l));
  const doAct = async (item: KidItem, action: KidAction, extra?: Record<string, unknown>) => {
    if (action === 'done') swap(item.id, { ...item, status: 'done' });   // optimistic; put back if it fails
    try {
      const r = await actOn(item.id, action, extra);
      if (r.item) swap(item.id, r.item);
      const said = SAID[action];
      if (said) setUndo({ key: Date.now(), label: `${said}: ${short(item)}`,
        undo: () => { void actOn(item.id, BACK[action] ?? 'undo').catch(e => setHint(roError(e))).finally(() => void refresh()); } });
    } catch (e) {
      swap(item.id, item);
      setHint(roError(e));
      throw e;
    } finally { void refresh(); }
  };
  const undoBar = <UndoBar info={undo} onClose={closeUndo} />;

  // ---- chat plumbing
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null);
  const [outbox, setOutbox] = useState<OutboxItem[]>(loadOutbox);
  const [replyTo, setReplyTo] = useState<{ text: string; mine: boolean } | null>(null);
  const sentAttachments = useRef(new Map<string, OutgoingAttachment[]>());
  const flushing = useRef(false);
  const { questions, answer, skip } = useQuestions({ status, activeSession, getClient, addEventListener });
  const { notify } = useNotifications();
  useEffect(() => setBaseTitle(), []);
  useEffect(() => saveOutbox(outbox), [outbox]);
  useEffect(() => {
    if (!onKids || !name || outbox.length === 0 || flushing.current) return;
    flushing.current = true;
    void (async () => {
      for (const item of outbox) {
        const signed = withSender(name, item.text);
        if (item.attachments.length > 0) sentAttachments.current.set(signed, item.attachments);
        await sendMessage(signed, item.attachments);
        setOutbox(prev => prev.filter(p => p.id !== item.id));
      }
      flushing.current = false;
      setOutbox(prev => (prev.length > 0 ? [...prev] : prev));
    })();
  }, [onKids, name, outbox, sendMessage]);
  // Every message carries its writer's name; until the name is known it waits in the outbox.
  const send = useCallback((text: string, attachments: OutgoingAttachment[]) => {
    if (!onKids || !name) { setOutbox(prev => [...prev, { id: 'q-' + Date.now(), text, attachments, queuedAt: Date.now() }]); return; }
    const signed = withSender(name, text);
    if (attachments.length > 0) sentAttachments.current.set(signed, attachments);
    void sendMessage(signed, attachments);
  }, [onKids, sendMessage, name]);
  const retry = useCallback((msg: ChatMessage) => { void sendMessage(msg.content, sentAttachments.current.get(msg.content) ?? []); }, [sendMessage]);
  const onReply = useCallback((msg: ChatMessage) => {
    const s = msg.role === 'user' ? senderOf(visibleText(msg)) : { name: null, text: visibleText(msg) };
    setReplyTo({ text: extractItems(withoutLeadingQuote(s.text)).text || 'Fotografie', mine: msg.role === 'user' && (!s.name || s.name === name) });
  }, [name]);
  const putIntent = (intent: Intent) => { closePanel(); setSheetId(null); setPrefill({ nonce: Date.now(), text: '', attachments: [], intent }); };
  const quick = (key: string) => { const q = QUICK.find(x => x.key === key)!; putIntent({ label: q.label, prefix: q.prefix, icon: q.icon, style: quickStyle(q.tone, mode), placeholder: q.placeholder }); };
  const askAbout = (item: KidItem) => {
    const label = short(item);
    putIntent({ label: `Despre ${label.length > 28 ? `${label.slice(0, 27)}…` : label}`, prefix: `Despre ⟨${item.id}⟩: `, icon: MessageSquare,
      style: quickStyle(QUICK[0].tone, mode), placeholder: 'Întrebarea ta' });
  };
  const addFor: Record<Tab, () => void> = {
    week: () => quick('todo'), acts: () => quick('activity'), ideas: () => quick('idea'),
    plans: () => putIntent({ label: 'Plan', prefix: 'Plan nou: ', icon: Plus, style: quickStyle(QUICK[1].tone, mode), placeholder: 'Ce plan, până când, ce pași știm?' }),
  };

  const shown = useMemo(() => (onKids ? dropRepeatedFailures(collapseCliTurns(messages).filter(isShownInMessenger), visibleText) : []), [messages, onKids]);
  const prevCount = useRef(messages.length);
  useEffect(() => {
    const before = prevCount.current; prevCount.current = messages.length;
    if (messages.length <= before) return;
    const last = messages[messages.length - 1];
    if (onKids && last?.role === 'assistant' && !last.isStreaming && isShownInMessenger(last)) {
      const t = extractItems(visibleText(last)).text;
      notify('Kids', failedTurn(t)?.summary ?? (t.slice(0, 120) || 'Mesaj nou'));
      void refresh();
    }
  }, [messages, notify, refresh, onKids]);

  // ---- scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollToBottom = useCallback((smooth = true) => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); }, []);
  useEffect(() => { if (atBottom) scrollToBottom(false); }, [shown, outbox, questions, atBottom, scrollToBottom]);
  const onScroll = () => { const el = scrollRef.current; if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };

  // ---- swipe right on the chat opens the list; left on the list closes it (edges are Back)
  const [drag, setDrag] = useState<number | null>(null);
  const gesture = useRef<{ x: number; y: number; horizontal: boolean | null; from: 'chat' | 'panel' } | null>(null);
  const swipeStart = (from: 'chat' | 'panel') => (e: React.TouchEvent) => {
    if (wide || (from === 'chat') === panelOpen) return;
    const x = e.touches[0].clientX;
    if (x < 28 || x > window.innerWidth - 28) return;
    gesture.current = { x, y: e.touches[0].clientY, horizontal: null, from };
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
      if (g.from === 'chat' && drag > 70) setPanelOpen(true);
      if (g.from === 'panel' && drag < -70) closePanel();
    }
    setDrag(null);
  };

  const [settings, setSettings] = useState(false);
  const statusLine = status === 'connected' ? (allowed && gw.agents.length > 0 && !gw.agents.includes('kids') ? 'Asistentul Kids nu e pornit încă' : null)
    : status === 'connecting' ? 'Se conectează…' : outbox.length > 0 ? `Fără conexiune · ${outbox.length} de trimis` : 'Fără conexiune';
  const today = list?.today ?? new Date().toISOString().slice(0, 10);
  const items = useMemo(() => list?.items ?? [], [list]);
  const kids = useMemo(() => list?.children ?? [], [list]);
  const { top } = topOf(items, today);
  const renderChips = useCallback((its: Array<{ id: string; label: string }>) => (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {its.map(c => {
        const it = items.find(i => i.id === c.id);
        return (
          <button key={c.id} type="button" onClick={() => openSheet(c.id)}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-pc-border bg-pc-elevated px-2.5 py-1 text-[13px] ${it && !isOpen(it) ? 'text-pc-text-muted line-through' : ''}`}>
            {it && <ChildNames item={it} kids={kids} mode={mode} />}
            <span className="truncate">{it ? short(it) : c.label}</span>
          </button>
        );
      })}
    </div>
  ), [items, kids, mode, openSheet]);
  useEffect(() => { if (!hint) return; const t = window.setTimeout(() => setHint(null), 6000); return () => window.clearTimeout(t); }, [hint]);

  // ---- above the chat: what comes first, small, on its tint; a tap opens the list
  const pinned = (
    <div className="relative z-10 bg-pc-base px-3 pb-2 pt-2 md:hidden">
      {list && top ? <NextBand small items={items} kids={kids} today={today} mode={mode} onOpen={() => setPanelOpen(true)} />
        : (
          <button type="button" onClick={() => setPanelOpen(true)} aria-label="Deschide lista"
            className="flex h-14 w-full items-center gap-3 rounded-[20px] bg-pc-surface px-4 text-left text-[16px] font-medium">
            <span className="min-w-0 flex-1 truncate">{!list ? (spinning ? 'Se încarcă…' : 'Săptămâna copiilor') : 'Săptămână liberă · vezi lista'}</span>
            <ChevronRight size={18} className="shrink-0 text-pc-text-muted" />
          </button>
        )}
    </div>
  );

  // ---- the list panel
  const listProps = { items, kids, today, mode, onOpen: (i: KidItem) => openSheet(i.id), onDone: (i: KidItem) => void doAct(i, 'done').catch(() => undefined), onAdd: addFor[tab] };
  const panel = (onClose?: () => void) => (
    <div className="flex h-full flex-col bg-pc-base" onTouchStart={swipeStart('panel')} onTouchMove={swipeMove} onTouchEnd={swipeEnd}>
      <div className="shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex h-[52px] items-center gap-1 px-2">
          {onClose && <IconButton label="Înapoi la chat" onClick={onClose}><ArrowLeft size={22} /></IconButton>}
          <h2 className="min-w-0 flex-1 truncate px-1 text-[17px] font-semibold">Kids · listă</h2>
          <IconButton label="Adaugă" onClick={addFor[tab]}><Plus size={22} /></IconButton>
          <IconButton label="Reîncarcă" onClick={() => void refresh()}><RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} /></IconButton>
        </div>
        <div className="px-3 pb-2">
          <Segmented<Tab> label="Ce arată lista" value={tab} onChange={setTab}
            options={[{ value: 'week', label: 'Săptămâna' }, { value: 'acts', label: 'Activități' }, { value: 'ideas', label: 'Idei' }, { value: 'plans', label: 'Planuri' }]} />
        </div>
        {loadState !== 'ok' && (
          <p className="mx-3 mb-2 rounded-[8px] bg-amber-500/15 px-3 py-1.5 text-[13px] text-amber-800 dark:text-amber-300" role="status">
            {loadState === 'expired' ? 'Deconectat · ' : 'Fără conexiune · arată ultima copie · '}
            <button type="button" onClick={() => (loadState === 'expired' ? window.location.reload() : void refresh())} className="font-semibold underline">{loadState === 'expired' ? 'intră din nou' : 'reîncearcă'}</button>
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3" style={{ background: mode === 'dark' ? 'var(--pc-bg-base)' : 'var(--pc-bg-surface)' }}>
        {!list ? <p className="py-16 text-center text-[15px] text-pc-text-muted">{spinning ? 'Se încarcă…' : ''}</p>
          : tab === 'week' ? <WeekView {...listProps} />
          : tab === 'acts' ? <ActivitiesView {...listProps} />
          : tab === 'ideas' ? <IdeasView {...listProps} />
          : <PlansView {...listProps} />}
      </div>
      {onClose && panelOpen && !sheetId && undo && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">{undoBar}</div>}
    </div>
  );

  const chat = (
    <>
      {isLoadingHistory && shown.length === 0 && <p className="py-6 text-center text-[12px] text-pc-text-muted">Se încarcă…</p>}
      {!isLoadingHistory && shown.length === 0 && outbox.length === 0 && (
        <div className="px-10 py-16 text-center">
          <p className="text-[17px] font-semibold">Ce avem pentru copii?</p>
          <p className="mt-1 text-[15px] text-pc-text-muted">O activitate, o invitație, ce trebuie făcut. Sau un mesaj de la școală de înțeles și de răspuns: lipește-l sau fă-i o poză.</p>
        </div>
      )}
      {shown.map((msg, i) => {
        const prev = shown[i - 1];
        const newDay = !prev || new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
        const firstOfRun = newDay || prev.role !== msg.role || (msg.role === 'user' && senderOf(visibleText(prev)).name !== senderOf(visibleText(msg)).name);
        return (
          <div key={msg.id} className={firstOfRun && i > 0 ? 'pt-2' : ''}>
            {newDay && <div className="flex justify-center pb-2 pt-3"><span className="text-[12px] font-medium text-pc-text-muted">{dayLabel(msg.timestamp)}</span></div>}
            <MessageBubble msg={msg} shared me={name || undefined} onRetry={retry} onReply={onReply} showAvatar={firstOfRun} renderItems={renderChips} />
          </div>
        );
      })}
      {outbox.map((item, i) => (
        <MessageBubble key={item.id} shared me={name || undefined} showAvatar={i === 0 && shown[shown.length - 1]?.role !== 'user'}
          msg={{ id: item.id, role: 'user', content: item.text, timestamp: item.queuedAt, blocks: [{ type: 'text', text: item.text || `${item.attachments.length} atașamente` }], sendStatus: 'sending' }} />
      ))}
      {onKids && questions.map(qq => <QuestionCard key={qq.id} record={qq} onAnswer={answer} onSkip={skip} />)}
    </>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[color-mix(in_srgb,var(--pc-bg-base)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <AppHeader title="Kids" subtitle={kids.length ? kids.map(c => `${c.name}${c.class ? ` ${c.class}` : ''}`).join(' · ') : 'Carla și Lia'}
          initial={name ? name[0] : '…'} onSettings={() => setSettings(true)} />
        {statusLine && <div className="flex h-6 items-center justify-center bg-amber-500/15 text-[12px] text-amber-700" role="status">{statusLine}</div>}
        {person === '' && !isLocal() && <div className="flex h-6 items-center justify-center bg-red-500/15 text-[12px] text-red-600" role="status">Neautentificat · <a href="/" className="ml-1 underline">intră</a></div>}
      </header>

      <div className="flex min-h-0 flex-1 md:flex-row">
        {wide && <aside className="flex w-[440px] shrink-0 flex-col border-r border-pc-border">{panel()}</aside>}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {pinned}
          <main ref={scrollRef} onScroll={onScroll} onTouchStart={swipeStart('chat')} onTouchMove={swipeMove} onTouchEnd={swipeEnd}
            className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2" role="log" aria-live="polite">
            <div className="space-y-1 pt-1 md:px-2">{chat}</div>
          </main>
          {!atBottom && (
            <button type="button" onClick={() => scrollToBottom()} className="absolute bottom-3 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-pc-border bg-pc-elevated shadow-lg" aria-label="La ultimul mesaj"><ArrowDown size={18} /></button>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-pc-border bg-pc-base">
        {!sheetId && !panelOpen && undoBar}
        {hint && <button type="button" className="mx-3 mt-2 flex min-h-10 w-[calc(100%-1.5rem)] items-center text-left text-[13px] text-red-500" role="alert" onClick={() => setHint(null)}>{hint}</button>}
        <div className="flex gap-2 overflow-x-auto px-3 pt-2 [&::-webkit-scrollbar]:hidden" aria-label="Începuturi rapide" style={{ scrollbarWidth: 'none' }}>
          {QUICK.map(qq => (
            <button key={qq.key} type="button" onClick={() => quick(qq.key)}
              className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-pc-surface px-3.5 text-[15px] text-pc-text-secondary active:bg-[var(--pc-hover-strong)]">
              <qq.icon size={16} style={{ color: mode === 'dark' ? qq.tone.inkDark : qq.tone.rail }} /> {qq.label}
            </button>
          ))}
        </div>
        <Composer key={prefill && !prefill.intent ? prefill.nonce : 0} onSend={send} prefill={prefill} replyTo={replyTo} onReplyCancel={() => setReplyTo(null)} voice transcribe={transcribeAudio} placeholder="Scrie sau spune" />
      </div>

      {!wide && (
        <div className="fixed inset-0 z-30 shadow-2xl md:hidden" role="dialog" aria-modal="true" aria-label="Lista copiilor" inert={!panelOpen}
          style={{
            transform: panelOpen ? `translateX(${drag !== null && drag < 0 ? drag : 0}px)` : `translateX(calc(-100% - 24px + ${drag !== null && drag > 0 ? drag : 0}px))`,
            transition: drag !== null ? 'none' : 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}>
          {panel(() => setPanelOpen(false))}
        </div>
      )}

      {sheetItem && list && (
        <KidSheet key={sheetItem.id} item={sheetItem} list={list} mode={mode} footer={undo ? undoBar : null}
          onClose={() => setSheetId(null)} onAct={doAct} onAsk={askAbout} onOpen={i => openSheet(i.id)} />
      )}
      {settings && (
        <Sheet label="Setări" onClose={() => setSettings(false)} className="px-4 pt-2">
          <div className="flex justify-end"><CloseButton onClick={() => setSettings(false)} label="Închide" /></div>
          <p className="-mt-2 mb-4 text-[17px] font-semibold">{name || 'Kids'}</p>
          <p className="mb-1.5 px-1 text-[13px] text-pc-text-muted">Aspect</p>
          <Segmented choice label="Aspect" value={look.appearance} onChange={a => onLook({ ...look, appearance: a })}
            options={[{ value: 'auto', label: 'Automat' }, { value: 'light', label: 'Luminos' }, { value: 'dark', label: 'Întunecat' }]} />
          <button type="button" onClick={() => { setSettings(false); logout(); }} className="press mt-6 h-12 w-full rounded-[12px] bg-pc-surface text-[16px] text-red-500">Deconectare</button>
          <p className="mt-4 text-center text-[12px] text-pc-text-muted">Datele sunt pe serverul de acasă · nimic nu se trimite din aplicație</p>
        </Sheet>
      )}
    </div>
  );
}

