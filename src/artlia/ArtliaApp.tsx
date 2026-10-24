/**
 * Casa Artlia (artlia.stuparu.eu; ai.manager casa-artlia-app.md): one chat shared by Lucian and
 * Ludmila with the Casa Artlia assistant (agent `artlia`, session agent:artlia:main), the project's
 * to-do list beside it (Acum · Plan · Categorii) and the item sheet. Romanian, French terms kept.
 * Built from oc's parts: the input bar, the bubbles, the task row, the sheet, the undo bar.
 *
 * Each message goes out as "[Name] text", so both see who said what; the bubbles show others'
 * messages on the left with their name.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ChevronRight, FolderSearch, HelpCircle, ListChecks, MessageSquare, Plus, RefreshCw, StickyNote, type LucideIcon } from 'lucide-react';
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
import { DueChip, Title } from '../app/Todo';
import { ItemChips } from '../app/ItemChips';
import { UndoBar, type UndoInfo } from '../app/UndoBar';
import { Sheet, CloseButton } from '../ui/Sheet';
import { AppHeader, IconButton, Segmented } from '../ui/Controls';
import { useBackLayer, useExactSizes } from '../ui/useBackLayer';
import { useDelayedFlag } from '../ui/progress';
import { actOn, cachedList, fetchList, roError, uploadFile, type ArtAction, type ArtItem, type ArtList, type Category } from './api';
import { CatsView, CategoryView, NowView, PlanView } from './Lists';
import { ArtSheet } from './ArtSheet';
import { toneOf, toneStyle, topOf, withSender } from './rules';

const SESSION = 'agent:artlia:main';
const OUTBOX_KEY = 'artlia:outbox';
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

/** Quick starts: what the next message is, as a coloured label in the box. */
type Tone = { rail: string; bg: string; ink: string; inkDark: string };
const QUICK: Array<{ key: string; label: string; icon: LucideIcon; prefix: string; tone: Tone; placeholder: string }> = [
  { key: 'todo', label: 'De făcut', icon: ListChecks, prefix: 'De făcut: ', tone: { rail: '#1d9e75', bg: '#e1f5ee', ink: '#0f6e56', inkDark: '#5fd3a9' }, placeholder: 'Ce trebuie făcut, și până când?' },
  { key: 'check', label: 'De verificat', icon: HelpCircle, prefix: 'De verificat: ', tone: { rail: '#ba7517', bg: '#faeeda', ink: '#854f0b', inkDark: '#e9b467' }, placeholder: 'Ce trebuie verificat?' },
  { key: 'drive', label: 'Caută în Drive', icon: FolderSearch, prefix: 'Caută în Drive: ', tone: { rail: '#378add', bg: '#e6f1fb', ink: '#0c447c', inkDark: '#8cc0f5' }, placeholder: 'Ce cauți în documente?' },
  { key: 'note', label: 'Notă', icon: StickyNote, prefix: 'Notă: ', tone: { rail: '#7c5cd6', bg: '#efeafd', ink: '#5b3fb5', inkDark: '#b9a6f5' }, placeholder: 'Ce de păstrat?' },
];
const quickStyle = (t: Tone, mode: string) => (mode === 'dark' ? { background: `${t.rail}33`, color: t.inkDark } : { background: t.bg, color: t.ink });

export default function ArtliaApp() {
  // Casa Artlia's own colour (coral); the appearance (auto / light / dark) is kept per phone.
  const [look, setLookState] = useState<Look>(() => ({ ...getLook(), accent: 'coral' }));
  useExactSizes();
  const mode = useMode(look.appearance);
  useThemeChrome(mode);
  const gw = useGateway();
  const savedLogin = getStoredCredentials() !== null;
  const networkOnly = !gw.connectError || gw.connectError.startsWith('Connection failed');
  const chooseLook = (l: Look) => { setLook(l); setLookState({ ...l, accent: 'coral' }); };
  return (
    <div lang="ro" style={lookVars(mode, look.accent)} className="h-dvh bg-pc-base text-pc-text antialiased">
      {!gw.authenticated && !(savedLogin && networkOnly)
        ? <LoginScreen onConnect={gw.login} error={gw.connectError} isConnecting={gw.isConnecting} />
        : <Desk gw={gw} look={look} mode={mode} onLook={chooseLook} />}
    </div>
  );
}

type Tab = 'now' | 'plan' | 'cats';

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
  const ready = status === 'connected' && allowed && gw.agents.includes('artlia');
  useEffect(() => { if (ready && activeSession !== SESSION) switchSession(SESSION); }, [ready, activeSession, switchSession]);
  // Only the shared Casa Artlia chat is ever shown, sent to or notified from (never another session).
  const onArtlia = ready && activeSession === SESSION;

  // ---- the list (last copy first, then the server)
  const [list, setList] = useState<ArtList | null>(cachedList);
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
  const [tab, setTab] = useState<Tab>('now');
  const [cat, setCat] = useState<Category | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // Closing the list closes its category too, in the same step, so no Back step is left behind.
  const closePanel = useCallback(() => { setPanelOpen(false); setCat(null); }, []);
  useBackLayer(panelOpen, closePanel);
  useBackLayer(!!cat, () => setCat(null));
  const sheetItem = list?.items.find(i => i.id === sheetId) ?? null;
  // A sheet opens only for an item in the list; one that leaves the list closes its sheet.
  const openSheet = useCallback((id: string) => {
    if (list?.items.some(i => i.id === id)) setSheetId(id); else setHint('Nu mai e în lista Casa Artlia');
  }, [list]);
  useEffect(() => { if (sheetId && list && !list.items.some(i => i.id === sheetId)) setSheetId(null); }, [sheetId, list]);

  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const closeUndo = useCallback(() => setUndo(null), []);
  const short = (i: ArtItem) => `${i.n != null ? `${i.n} · ` : ''}${i.title.replace(/\*\*/g, '')}`;
  const SAID: Partial<Record<ArtAction, string>> = { done: 'Făcut', snooze: 'Amânat 3 zile', drop: 'Nu mai e nevoie', reopen: 'Redeschis', edit: 'Salvat', status: 'Stare schimbată', note: 'Notă adăugată' };
  const swap = (id: string, next: ArtItem) => setList(l => (l ? { ...l, items: l.items.map(i => (i.id === id ? next : i)) } : l));
  const offerUndo = (item: ArtItem, label: string) => setUndo({ key: Date.now(), label: `${label}: ${short(item)}`,
    undo: () => { void actOn(item.id, 'undo').catch(e => setHint(roError(e))).finally(() => void refresh()); } });
  const doAct = async (item: ArtItem, action: ArtAction, extra?: Record<string, unknown>) => {
    if (action === 'done') swap(item.id, { ...item, status: 'done' });   // optimistic; put back if it fails
    try {
      const r = await actOn(item.id, action, extra);
      if (r.item) swap(item.id, r.item);
      if (SAID[action]) offerUndo(item, SAID[action]!);
    } catch (e) {
      swap(item.id, item);
      setHint(roError(e));
      throw e;
    } finally { void refresh(); }
  };
  const upload = async (item: ArtItem, f: File) => {
    const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(new Error('read')); r.readAsDataURL(f); });
    const r = await uploadFile(item.id, { name: f.name, mimeType: f.type || 'application/octet-stream', data });
    if (r.item) swap(item.id, r.item);
    offerUndo(item, 'Dovadă adăugată');
    void refresh();
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
    if (!onArtlia || !name || outbox.length === 0 || flushing.current) return;
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
  }, [onArtlia, name, outbox, sendMessage]);
  // Every message carries its writer's name; until the name is known it waits in the outbox.
  const send = useCallback((text: string, attachments: OutgoingAttachment[]) => {
    if (!onArtlia || !name) { setOutbox(prev => [...prev, { id: 'q-' + Date.now(), text, attachments, queuedAt: Date.now() }]); return; }
    const signed = withSender(name, text);
    if (attachments.length > 0) sentAttachments.current.set(signed, attachments);
    void sendMessage(signed, attachments);
  }, [onArtlia, sendMessage, name]);
  const retry = useCallback((msg: ChatMessage) => { void sendMessage(msg.content, sentAttachments.current.get(msg.content) ?? []); }, [sendMessage]);
  const onReply = useCallback((msg: ChatMessage) => {
    const s = msg.role === 'user' ? senderOf(visibleText(msg)) : { name: null, text: visibleText(msg) };
    setReplyTo({ text: extractItems(withoutLeadingQuote(s.text)).text || 'Fotografie', mine: msg.role === 'user' && (!s.name || s.name === name) });
  }, [name]);
  const putIntent = (intent: Intent) => { closePanel(); setSheetId(null); setPrefill({ nonce: Date.now(), text: '', attachments: [], intent }); };
  const askAbout = (item: ArtItem) => {
    const label = short(item);
    putIntent({ label: `Despre ${label.length > 28 ? `${label.slice(0, 27)}…` : label}`, prefix: `Despre ⟨${item.id}⟩: `, icon: MessageSquare,
      style: list ? toneStyle(toneOf(item.cat, list.categories), mode) : {}, placeholder: 'Întrebarea ta' });
  };
  const addIn = (c: Category) => putIntent({ label: `De făcut · ${c.label}`, prefix: `De făcut în ${c.label}: `, icon: Plus,
    style: list ? toneStyle(toneOf(c.id, list.categories), mode) : {}, placeholder: 'Ce trebuie făcut, și până când?' });

  const shown = useMemo(() => (onArtlia ? dropRepeatedFailures(collapseCliTurns(messages).filter(isShownInMessenger), visibleText) : []), [messages, onArtlia]);
  const prevCount = useRef(messages.length);
  useEffect(() => {
    const before = prevCount.current; prevCount.current = messages.length;
    if (messages.length <= before) return;
    const last = messages[messages.length - 1];
    if (onArtlia && last?.role === 'assistant' && !last.isStreaming && isShownInMessenger(last)) {
      const t = extractItems(visibleText(last)).text;
      notify('Casa Artlia', failedTurn(t)?.summary ?? (t.slice(0, 120) || 'Mesaj nou'));
      void refresh();
    }
  }, [messages, notify, refresh, onArtlia]);

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
  const statusLine = status === 'connected' ? (allowed && gw.agents.length > 0 && !gw.agents.includes('artlia') ? 'Asistentul Casa Artlia nu e pornit încă' : null)
    : status === 'connecting' ? 'Se conectează…' : outbox.length > 0 ? `Fără conexiune · ${outbox.length} de trimis` : 'Fără conexiune';
  const today = list?.today ?? new Date().toISOString().slice(0, 10);
  const items = list?.items ?? [];
  const cats = list?.categories ?? [];
  const { top, overdue, week } = topOf(items, today);
  const renderChips = useCallback((its: Array<{ id: string; label: string }>) => <ItemChips items={its} onOpen={openSheet} />, [openSheet]);
  useEffect(() => { if (!hint) return; const t = window.setTimeout(() => setHint(null), 6000); return () => window.clearTimeout(t); }, [hint]);

  // ---- the pinned card: the most pressing thing, on a band with a shadow edge
  const pinned = (
    <div className="relative z-10 bg-pc-base px-3 pb-2 pt-2 shadow-[0_10px_12px_-12px_rgba(0,0,0,0.35)] md:hidden">
      <button type="button" onClick={() => setPanelOpen(true)} aria-label="Deschide lista"
        className="flex w-full items-center gap-3 rounded-[12px] bg-pc-elevated px-4 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_14px_rgba(0,0,0,0.10)] ring-1 ring-[var(--pc-separator)] active:scale-[0.99]">
        <span className="min-w-0 flex-1">
          {!list ? <span className="block text-[16px] text-pc-text-muted">{spinning ? 'Se încarcă lista…' : 'Lista Casa Artlia'}</span>
            : top ? (
              <>
                <span className="flex items-baseline gap-1.5 text-[16px] leading-tight">
                  {top.n != null && <span className="shrink-0 font-bold tabular-nums" style={{ color: toneOf(top.cat, cats).rail }}>{top.n}</span>}
                  <Title text={top.title} className="min-w-0 truncate" />
                </span>
                <span className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-tight text-pc-text-muted">
                  <DueChip item={top} today={today} mode={mode} />
                  <span className="truncate">{[overdue > 1 ? `încă ${overdue - 1} întârziate` : '', week ? `${week} săptămâna asta` : ''].filter(Boolean).join(' · ') || `${items.filter(i => i.status !== 'done' && i.status !== 'cancelled').length} deschise în total`}</span>
                </span>
              </>
            ) : <span className="block text-[16px] font-medium">Nimic urgent · vezi Planul</span>}
        </span>
        <ChevronRight size={18} className="shrink-0 text-pc-text-faint" />
      </button>
    </div>
  );

  // ---- the list panel
  const panel = (onClose?: () => void) => (
    <div className="flex h-full flex-col bg-pc-base" onTouchStart={swipeStart('panel')} onTouchMove={swipeMove} onTouchEnd={swipeEnd}>
      <div className="shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex h-[52px] items-center gap-1 px-2">
          {cat ? <IconButton label="Înapoi la categorii" onClick={() => setCat(null)}><ArrowLeft size={22} /></IconButton>
            : onClose && <IconButton label="Înapoi la chat" onClick={onClose}><ArrowLeft size={22} /></IconButton>}
          <h2 className="min-w-0 flex-1 truncate px-1 text-[17px] font-semibold">{cat ? cat.label : 'Casa Artlia · listă'}</h2>
          {cat && <IconButton label={`Adaugă în ${cat.label}`} onClick={() => addIn(cat)}><Plus size={22} /></IconButton>}
          <IconButton label="Reîncarcă" onClick={() => void refresh()}><RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} /></IconButton>
        </div>
        {!cat && (
          <div className="px-3 pb-2">
            <Segmented<Tab> label="Ce arată lista" value={tab} onChange={setTab}
              options={[{ value: 'now', label: 'Acum' }, { value: 'plan', label: 'Plan' }, { value: 'cats', label: 'Categorii' }]} />
          </div>
        )}
        {loadState !== 'ok' && (
          <p className="mx-3 mb-2 rounded-[8px] bg-amber-500/15 px-3 py-1.5 text-[13px] text-amber-800 dark:text-amber-300" role="status">
            {loadState === 'expired' ? 'Deconectat · ' : 'Fără conexiune · arată ultima copie · '}
            <button type="button" onClick={() => (loadState === 'expired' ? window.location.reload() : void refresh())} className="font-semibold underline">{loadState === 'expired' ? 'intră din nou' : 'reîncearcă'}</button>
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6 pt-1">
        {!list ? <p className="py-16 text-center text-[15px] text-pc-text-muted">{spinning ? 'Se încarcă…' : ''}</p>
          : cat ? <CategoryView cat={cat} items={items} today={today} mode={mode} cats={cats} onDone={i => void doAct(i, 'done').catch(() => undefined)} onOpen={i => openSheet(i.id)} />
          : tab === 'now' ? <NowView items={items} today={today} mode={mode} cats={cats} onDone={i => void doAct(i, 'done').catch(() => undefined)} onOpen={i => openSheet(i.id)} />
          : tab === 'plan' ? <PlanView items={items} today={today} mode={mode} cats={cats} onDone={i => void doAct(i, 'done').catch(() => undefined)} onOpen={i => openSheet(i.id)} />
          : <CatsView items={items} today={today} mode={mode} cats={cats} onPick={setCat} />}
      </div>
      {onClose && panelOpen && !sheetId && undo && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">{undoBar}</div>}
    </div>
  );

  const chat = (
    <>
      {isLoadingHistory && shown.length === 0 && <p className="py-6 text-center text-[12px] text-pc-text-muted">Se încarcă…</p>}
      {!isLoadingHistory && shown.length === 0 && outbox.length === 0 && (
        <div className="px-10 py-16 text-center">
          <p className="text-[17px] font-semibold">Ce facem azi pentru Casa Artlia?</p>
          <p className="mt-1 text-[15px] text-pc-text-muted">Un lucru de făcut, o întrebare, o poză cu un devis. Scrie sau apasă microfonul.</p>
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
      {onArtlia && questions.map(qq => <QuestionCard key={qq.id} record={qq} onAnswer={answer} onSkip={skip} />)}
    </>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[color-mix(in_srgb,var(--pc-bg-base)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <AppHeader title="Casa Artlia" subtitle={top?.due_date || items.length ? `${items.filter(i => i.status !== 'done' && i.status !== 'cancelled' && i.kind !== 'milestone').length} deschise · deschidere sept. 2027` : 'Ferney-Voltaire'}
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
        <div className="flex gap-2 overflow-x-auto px-3 pt-2 [&::-webkit-scrollbar]:hidden" aria-label="Quick starts" style={{ scrollbarWidth: 'none' }}>
          {QUICK.map(qq => (
            <button key={qq.key} type="button" onClick={() => putIntent({ label: qq.label, prefix: qq.prefix, icon: qq.icon, style: quickStyle(qq.tone, mode), placeholder: qq.placeholder })}
              className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-pc-surface px-3.5 text-[15px] text-pc-text-secondary active:bg-[var(--pc-hover-strong)]">
              <qq.icon size={16} style={{ color: mode === 'dark' ? qq.tone.inkDark : qq.tone.rail }} /> {qq.label}
            </button>
          ))}
        </div>
        <Composer key={prefill && !prefill.intent ? prefill.nonce : 0} onSend={send} prefill={prefill} replyTo={replyTo} onReplyCancel={() => setReplyTo(null)} voice transcribe={transcribeAudio} placeholder="Scrie sau spune" />
      </div>

      {!wide && (
        <div className="fixed inset-0 z-30 shadow-2xl md:hidden" role="dialog" aria-modal="true" aria-label="Lista Casa Artlia" inert={!panelOpen}
          style={{
            transform: panelOpen ? `translateX(${drag !== null && drag < 0 ? drag : 0}px)` : `translateX(calc(-100% - 24px + ${drag !== null && drag > 0 ? drag : 0}px))`,
            transition: drag !== null ? 'none' : 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}>
          {panel(() => setPanelOpen(false))}
        </div>
      )}

      {sheetItem && list && (
        <ArtSheet key={sheetItem.id} item={sheetItem} list={list} mode={mode} footer={undo ? undoBar : null}
          onClose={() => setSheetId(null)} onAct={doAct} onAsk={askAbout} onUpload={upload} />
      )}
      {settings && (
        <Sheet label="Setări" onClose={() => setSettings(false)} className="px-4 pt-2">
          <div className="flex justify-end"><CloseButton onClick={() => setSettings(false)} label="Închide" /></div>
          <p className="-mt-2 mb-4 text-[17px] font-semibold">{name || 'Casa Artlia'}</p>
          <p className="mb-1.5 px-1 text-[13px] text-pc-text-muted">Aspect</p>
          <Segmented choice label="Aspect" value={look.appearance} onChange={a => onLook({ ...look, appearance: a })}
            options={[{ value: 'auto', label: 'Automat' }, { value: 'light', label: 'Luminos' }, { value: 'dark', label: 'Întunecat' }]} />
          <button type="button" onClick={() => { setSettings(false); logout(); }} className="press mt-6 h-12 w-full rounded-[12px] bg-pc-surface text-[16px] text-red-500">Deconectare</button>
          <p className="mt-4 text-center text-[12px] text-pc-text-muted">Datele sunt pe serverul de acasă · documentele din Drive doar se citesc</p>
        </Sheet>
      )}
    </div>
  );
}
