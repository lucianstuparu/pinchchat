/**
 * One person's line. Their messages (WhatsApp, or pasted from email or another app with "They wrote…"),
 * each translated when they write in another language and readable aloud; then the dock where you say
 * what to tell them. Their own agent (relay-api on CT 113, Codex) writes it in their language and in
 * the style learned from samples, with what it remembers about them; you read it and its meaning in
 * yours, may hear it, change it or drop it. WhatsApp: Send, which waits 5 s with Undo (a sent message
 * cannot be taken back). Other channels: Copy or Share, and you paste it where they read.
 * After a message goes, the agent keeps the exchange and updates its memory.
 *
 * Said by voice (Lucian 2026-10-26: "from the car without looking too much at the phone"): the message is
 * read back aloud (to whom, the message, what it means) and the card turns into big buttons, Send the
 * biggest, at the bottom. Every time the mic stops (a tap, or a pause) the words go on by themselves (Lucian
 * 2026-10-26: "it didn't read back automatically when I clicked stop recording"); holding a face starts the mic at once.
 * On WhatsApp the read-back ends with "Trimit?" and the mic listens for a short answer (answer.ts): "da" sends
 * (the same 5 s with Undo), "nu" drops it (Lucian 2026-10-26: "if I say ok to send the message").
 * Relay's main mic opens the line with what was said (`autoSay`): it is prepared at once, by voice.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ClipboardPaste, Copy, Mic, Pencil, RotateCcw, Send, Share2, Square, Trash2, Volume2 } from 'lucide-react';
import { Composer, type ComposerPrefill } from '../mobile/Composer';
import { post, transcribeAudio } from '../app/api';
import { IconButton } from '../ui/Controls';
import { ProgressRow } from '../ui/ProgressRow';
import { CloseButton, Sheet } from '../ui/Sheet';
import { useBusy } from '../ui/draft';
import { canSpeak, speak, speakParts } from '../ui/speak';
import { useDelayedFlag } from '../ui/progress';
import { Face } from './Face';
import { answerOf, listenOnce } from './answer';
import {
  MY_LANG, act, agentProfile, channelName, compose, fetchConversation, langName, learn, theyWrote, timeOf, translate, viaWhatsApp, waDraft,
  type Contact, type Draft, type WaMessage,
} from './api';

const SEND_DELAY = 5000;
const draftKeyOf = (contact: string) => `wa:draft:${contact}`;
const keep = (k: string, v: string | null) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* not kept */ } };
const kept = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const isLocal = (d: Draft) => d.id.startsWith('local-');
const localId = () => `local-${Date.now()}`;
const clockOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
/** "Today", "Yesterday", else the date: one divider where the day changes. */
function dayOf(iso: string): string {
  const d = new Date(iso), now = new Date(), y = new Date(); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'preparing'; said: string; voice?: boolean }
  | { kind: 'failed'; said: string; error: string; voice?: boolean }
  | { kind: 'draft'; draft: Draft; said?: string; error?: string; voice?: boolean }
  | { kind: 'sending'; draft: Draft; said?: string; voice?: boolean }
  | { kind: 'sent'; draft: Draft; how: string; voice?: boolean };

export function Line({ contact, waOwner, replyTo, startVoice, autoSay, onBack, onProfile, onSent }: {
  contact: Contact; waOwner: boolean;
  /** Said or typed in Relay's bar for this person: prepared at once (read back when said). */
  autoSay?: { text: string; voice: boolean } | null;
  /** Opened by holding their face: the mic listens at once, hands-free. */
  startVoice?: boolean;
  /** Text pasted in Translate and answered from there: it opens as "they wrote". */
  replyTo?: string | null;
  onBack: () => void; onProfile: () => void; onSent: () => void;
}) {
  const wa = viaWhatsApp(contact, waOwner);
  const [inbox, setInbox] = useState<WaMessage[] | null>(wa && contact.listen ? null : []);
  const [pasted, setPasted] = useState<WaMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A message written for another channel and not used yet is kept on the phone: it opens with the screen.
  const [stage, setStage] = useState<Stage>(() => {
    const saved = kept(draftKeyOf(contact.id));
    if (saved?.startsWith('{')) { try { return { kind: 'draft', draft: JSON.parse(saved) as Draft }; } catch { /* broken: dropped */ } }
    return { kind: 'idle' };
  });
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(() => (startVoice ? { nonce: Date.now(), text: '', attachments: [], dictate: true } : null));
  const [edit, setEdit] = useState<string | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const stopSpeech = useRef<(() => void) | null>(null);
  // Listening for the spoken yes or no after a read-back.
  const [asking, setAsking] = useState(false);
  const stopAsking = useRef<(() => void) | null>(null);
  const quiet = () => { stopSpeech.current?.(); stopAsking.current?.(); stopAsking.current = null; setAsking(false); };
  const stageNow = useRef<Stage>({ kind: 'idle' });
  const endRef = useRef<HTMLDivElement>(null);
  const foreign = contact.lang !== MY_LANG;
  useBusy(`wa-line-${contact.id}`, stage.kind === 'preparing' || stage.kind === 'sending' || edit !== null || paste !== null);

  // ---- their words in mine: the newest five not yet translated, one after the other. Made once: those
  // made before come with the history and are kept on the phone, so they show at once on every load.
  const trKey = `wa:tr:${contact.id}`;
  const [translations, setTranslations] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(trKey) || '{}') as Record<string, string>; } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem(trKey, JSON.stringify(translations)); } catch { /* not kept */ } }, [trKey, translations]);
  // ---- the conversation: WhatsApp's inbox, and what was pasted or sent elsewhere (the agent's history)
  const load = useCallback(async () => {
    try {
      const [msgs, prof] = await Promise.all([wa && contact.listen ? fetchConversation(contact.id) : Promise.resolve([] as WaMessage[]), agentProfile(contact)]);
      setInbox(msgs);
      // From the agent's history: pasted messages always; for other channels also what was sent.
      if (prof.translations) setTranslations(t => ({ ...prof.translations, ...t }));
      setPasted(prof.history.filter(e => e.src === 'pasted' || (!wa && e.kind === 'mine'))
        .map(e => ({ id: `h-${e.ts}`, from: e.kind === 'mine' ? 'me' : 'them', text: e.text, ts: e.ts })));
      setLoadError(null);
    } catch (e) { setLoadError(navigator.onLine ? (e instanceof Error ? e.message : 'Could not load') : 'No connection'); }
  }, [contact, wa]);
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(first); window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);
  const msgs = useMemo(() => (inbox ? [...inbox, ...pasted].sort((a, b) => a.ts.localeCompare(b.ts)) : null), [inbox, pasted]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, stage.kind]);
  useEffect(() => () => { stopSpeech.current?.(); stopAsking.current?.(); }, []);
  const lastTheirs = msgs?.filter(m => m.from === 'them').at(-1);

  // Text answered from the Translate box: kept as theirs, once.
  const took = useRef(false);
  useEffect(() => {
    if (!replyTo || took.current) return;
    took.current = true;
    void theyWrote(contact, replyTo).then(load).catch(() => undefined);
  }, [replyTo, contact, load]);

  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!foreign || !msgs) return;
    const todo = msgs.filter(m => m.from === 'them' && !m.translation && !translations[m.id] && !asked.current.has(m.id)).slice(-5);
    if (!todo.length) return;
    todo.forEach(m => asked.current.add(m.id));
    void (async () => {
      for (const m of todo) {
        try { const t = await translate(m.transcript || m.text, contact, m.id); setTranslations(s => ({ ...s, [m.id]: t.translation })); }
        catch { asked.current.delete(m.id); }
      }
    })();
  }, [msgs, foreign, contact, translations]);

  // ---- a draft left from before (the app was closed): shown again while it is still a draft
  useEffect(() => {
    const saved = kept(draftKeyOf(contact.id));
    if (!saved || saved.startsWith('{')) return;   // none, or kept on the phone (read above)
    void post<{ drafts: Record<string, Draft> }>('/reg/wa/status', { ids: [saved] })
      .then(r => { const d = r.drafts[saved]; if (d && (d.status === 'draft' || d.status === 'failed')) setStage(s => (s.kind === 'idle' ? { kind: 'draft', draft: { ...d, id: saved } } : s)); else keep(draftKeyOf(contact.id), null); })
      .catch(() => undefined);
  }, [contact.id]);
  const keepDraft = (d: Draft | null) => keep(draftKeyOf(contact.id), d ? (isLocal(d) ? JSON.stringify(d) : d.id) : null);

  const say = (texts: string[], lang: string, key: string) => {
    if (speaking === key) { stopSpeech.current?.(); return; }
    stopSpeech.current?.();
    setSpeaking(key);
    stopSpeech.current = speak(texts, lang, () => setSpeaking(s => (s === key ? null : s)));
  };

  // ---- what you said -> the message in their language, by their agent
  // Read back aloud: to whom (in my language), the message (in theirs), what it means (in mine).
  const readBack = (d: Draft, said?: string) => {
    quiet();
    setSpeaking('draft');
    const lang = d.lang ?? contact.lang;
    let cut = false;
    const stop = speakParts([
      { text: `Pentru ${contact.label}:`, lang: MY_LANG },
      { text: d.text, lang },
      ...(lang !== MY_LANG && d.back ? [{ text: `Adică: ${d.back}`, lang: MY_LANG }] : []),
      ...(wa ? [{ text: 'Trimit?', lang: MY_LANG }] : []),
    ], () => {
      setSpeaking(s => (s === 'draft' ? null : s));
      if (!cut && wa) ask(d, said);
    });
    stopSpeech.current = () => { cut = true; stop(); };
  };
  // After "Trimit?": a short spoken answer, only while this draft is still on the card.
  const ask = (d: Draft, said?: string) => {
    const still = () => { const s = stageNow.current; return s.kind === 'draft' && s.draft.id === d.id; };
    if (!still()) return;
    const l = listenOnce();
    stopAsking.current = l.stop;
    setAsking(true);
    void l.done.then(t => {
      if (stopAsking.current !== l.stop) return;   // stopped, or another one started
      stopAsking.current = null; setAsking(false);
      if (!still()) return;
      const a = answerOf(t);
      if (a === 'yes') send(d, said, true);
      else if (a === 'no') { discard(d); speak(['Am renunțat.'], MY_LANG); }
    });
  };
  const sayAgain = () => { setPrefill({ nonce: Date.now(), text: '', attachments: [], dictate: true }); };

  const prepare = async (said: string, voice = false) => {
    if (stage.kind === 'draft' && !isLocal(stage.draft)) void act(stage.draft.id, 'cancel').catch(() => undefined);   // a new message replaces the old draft
    setStage({ kind: 'preparing', said, voice });
    setPrefill(p => (p?.dictate ? null : p));   // the mic's start was used: the box must not listen again when it comes back after Send
    keep(`draft:wa:${contact.id}`, null);   // and the words are used: the box comes back empty (Lucian 2026-10-26: "după send trebuie șters și textbox-ul")
    try {
      const w = await compose(contact, said, lastTheirs ? (lastTheirs.transcript || lastTheirs.text) : undefined);
      const d: Draft = wa ? await waDraft(contact.id, w.text, w.back)
        : { id: localId(), name: contact.name, lang: contact.lang, text: w.text, back: w.back, status: 'draft' };
      keepDraft(d);
      setStage({ kind: 'draft', draft: d, said, voice });
      if (voice) readBack(d, said);
    } catch (e) {
      const error = navigator.onLine ? (e instanceof Error ? e.message : 'Could not write it') : 'No connection';
      setStage({ kind: 'failed', said, error, voice });
      if (voice) speak(['Nu am reușit să scriu mesajul.'], MY_LANG);
    }
  };
  useEffect(() => { stageNow.current = stage; }, [stage]);
  // Said to the main mic for this person: prepared at once, as said by voice.
  const autoDone = useRef(false);
  useEffect(() => {
    // After the conversation loaded, so an answer follows their last message.
    if (!autoSay?.text.trim() || autoDone.current || (msgs === null && !loadError)) return;
    const t = window.setTimeout(() => { autoDone.current = true; void prepare(autoSay.text.trim(), autoSay.voice); }, 0);
    return () => window.clearTimeout(t);
  }, [msgs, loadError]);   // eslint-disable-line react-hooks/exhaustive-deps -- once, when the conversation is there
  const putBack = (said: string) => { setStage({ kind: 'idle' }); setPrefill({ nonce: Date.now(), text: said.trim(), attachments: [] }); };
  const discard = (d: Draft, said?: string) => {
    quiet();
    if (!isLocal(d)) void act(d.id, 'cancel').catch(() => undefined);
    keepDraft(null);
    setStage({ kind: 'idle' });
    if (said) setPrefill({ nonce: Date.now(), text: said.trim(), attachments: [] });   // your words come back to the box
  };
  const saveEdit = async (d: Draft, said?: string) => {
    const t = (edit ?? '').trim();
    if (!t) return;
    if (isLocal(d)) { const n = { ...d, text: t, back: undefined }; keepDraft(n); setStage({ kind: 'draft', draft: n, said }); setEdit(null); return; }
    try { const n = await act(d.id, 'edit', t); setStage({ kind: 'draft', draft: { ...n, id: d.id }, said }); setEdit(null); }
    catch (e) { setStage({ kind: 'draft', draft: d, said, error: e instanceof Error ? e.message : 'Could not change it' }); }
  };
  const done = (d: Draft, how: string, said?: string, voice?: boolean) => {
    keepDraft(null);
    setStage({ kind: 'sent', draft: d, how, voice });
    if (voice) speak([wa ? 'Trimis.' : 'Copiat.'], MY_LANG);
    void learn(contact, d.text, said, lastTheirs ? (lastTheirs.transcript || lastTheirs.text) : undefined).then(load).catch(() => undefined);
    onSent();
  };

  // ---- WhatsApp Send: 5 s with Undo, then it leaves
  const timer = useRef<number | null>(null);
  const [left, setLeft] = useState(0);
  const ticker = useRef<number | null>(null);
  const stopTimers = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (ticker.current) window.clearInterval(ticker.current);
    timer.current = ticker.current = null;
  };
  useEffect(() => stopTimers, []);   // leaving the screen keeps it a draft
  const send = (d: Draft, said?: string, voice?: boolean) => {
    quiet();
    if (voice) speak(['Trimit.'], MY_LANG);
    setStage({ kind: 'sending', draft: d, said, voice });
    setLeft(SEND_DELAY / 1000);
    ticker.current = window.setInterval(() => setLeft(n => Math.max(1, n - 1)), 1000);
    timer.current = window.setTimeout(async () => {
      stopTimers();
      try {
        const r = await act(d.id, 'send');
        if (r.status === 'sent') { done({ ...r, id: d.id }, `Sent ${timeOf(r.sent_at ?? new Date().toISOString())}`, said, voice); void load(); }
        else { setStage({ kind: 'draft', draft: { ...r, id: d.id }, said, voice, error: r.error || 'Not sent' }); if (voice) speak(['Nu s-a trimis.'], MY_LANG); }
      } catch (e) {
        // The send may have gone through and only the answer got lost (the phone changed network, 2026-10-25): ask
        // the server before saying it failed. A second Send of a sent draft is refused there anyway.
        const now = await post<{ drafts: Record<string, Draft> }>('/reg/wa/status', { ids: [d.id] }).then(r => r.drafts?.[d.id]).catch(() => undefined);
        if (now?.status === 'sent') { done({ ...now, id: d.id }, `Sent ${timeOf(now.sent_at ?? new Date().toISOString())}`, said, voice); void load(); return; }
        setStage({ kind: 'draft', draft: d, said, voice, error: navigator.onLine ? (e instanceof Error ? e.message : 'Not sent') : 'No connection: not sent' });
        if (voice) speak(['Nu s-a trimis.'], MY_LANG);
      }
    }, SEND_DELAY);
  };
  const undoSend = (d: Draft, said?: string, voice?: boolean) => { stopTimers(); if (voice) speak(['Oprit.'], MY_LANG); setStage({ kind: 'draft', draft: d, said, voice }); };

  // ---- other channels: Copy or Share, then paste it where they read
  const where = contact.channel === 'email' ? 'your email' : contact.channel === 'sms' ? 'Messages' : contact.channel === 'whatsapp' ? 'WhatsApp' : 'the app you use with them';
  const copy = async (d: Draft, said?: string) => {
    try { await navigator.clipboard.writeText(d.text); done(d, `Copied · paste it in ${where}`, said, stage.kind === 'draft' && stage.voice); }
    catch { setHint('Could not copy: select the text and copy it'); }
  };
  const share = async (d: Draft, said?: string) => {
    try { await navigator.share({ text: d.text }); done(d, 'Shared', said); }
    catch { /* closed without sharing: still a draft */ }
  };
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  useEffect(() => {
    if (stage.kind !== 'sent') return;
    const t = window.setTimeout(() => setStage(s => (s.kind === 'sent' ? { kind: 'idle' } : s)), 4000);
    return () => window.clearTimeout(t);
  }, [stage]);
  useEffect(() => { if (!hint) return; const t = window.setTimeout(() => setHint(null), 6000); return () => window.clearTimeout(t); }, [hint]);
  const showPreparing = useDelayedFlag(stage.kind === 'preparing', 0);

  // ---- "They wrote…": a message from email or another app, kept and translated
  const savePaste = async () => {
    const t = (paste ?? '').trim();
    if (!t) return;
    setPaste(null);
    try { await theyWrote(contact, t); await load(); }
    catch (e) { setHint(e instanceof Error ? e.message : 'Could not keep it'); }
  };

  const toneWord = contact.tone === 'formal' ? 'formal' : 'informal';
  const draft = stage.kind === 'draft' || stage.kind === 'sending' || stage.kind === 'sent' ? stage.draft : null;
  const said = stage.kind === 'draft' || stage.kind === 'sending' ? stage.said : undefined;
  // Said by voice: big buttons, Send the biggest and last, for a glance from the car.
  const big = (stage.kind === 'draft' || stage.kind === 'sending') && !!stage.voice && edit === null;
  const voiceOf = stage.kind === 'draft' || stage.kind === 'sending' ? stage.voice : undefined;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-[64px] w-full max-w-[760px] items-center gap-2 px-2">
          <IconButton label="All people" onClick={onBack}><ChevronLeft size={24} /></IconButton>
          <Face contact={contact} size={40} />
          <div className="min-w-0 flex-1 pl-1">
            <h1 className="truncate text-[19px] font-semibold leading-tight">{contact.label}</h1>
            <p className="truncate text-[13px] leading-tight text-pc-text-muted">{langName(contact.lang)} · {toneWord} · {channelName(contact.channel)}</p>
          </div>
          <IconButton label="They wrote something" onClick={() => setPaste('')}><ClipboardPaste size={20} /></IconButton>
          <IconButton label={`Profile of ${contact.label}`} onClick={onProfile}><Pencil size={19} /></IconButton>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-3" aria-live="polite">
        <div className="mx-auto w-full max-w-[760px]">
        {wa && !contact.listen && (
          <button type="button" onClick={onProfile} className="mb-3 block w-full rounded-[12px] bg-pc-surface px-4 py-3 text-left text-[15px] text-pc-text-secondary">
            Their WhatsApp messages are not kept here. Turn on <b className="font-semibold text-pc-text">Keep their messages here</b> in their profile to read and hear them.
          </button>
        )}
        {loadError && <p className="mb-2 text-[13px] text-red-500" role="alert">{loadError} · <button type="button" className="underline" onClick={() => void load()}>try again</button></p>}
        {msgs === null && !loadError && <p className="py-10 text-center text-[15px] text-pc-text-muted">Loading…</p>}
        {msgs?.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-[15px] text-pc-text-muted">{wa ? `When ${contact.label} writes on WhatsApp, it appears here.` : `Nothing yet with ${contact.label}.`}</p>
            <button type="button" onClick={() => setPaste('')} className="press mt-3 inline-flex h-12 items-center gap-2 rounded-full bg-pc-surface px-5 text-[16px] font-medium">
              <ClipboardPaste size={18} /> Paste what they wrote
            </button>
          </div>
        )}
        <div className="space-y-2.5">
          {msgs?.map((m, i) => {
            const tr = m.translation ?? translations[m.id];
            const day = dayOf(m.ts);
            const divider = i === 0 || dayOf(msgs[i - 1].ts) !== day
              ? <p className="pb-1 pt-3 text-center text-[12px] font-semibold text-pc-text-muted">{day}</p> : null;
            const own = m.transcript || m.text;
            const key = `m-${m.id}`;
            return m.from === 'me' ? (
              <div key={m.id}>{divider}<div className="flex justify-end">
                <div className="max-w-[85%] rounded-[20px] rounded-tr-[8px] bg-[rgba(var(--pc-accent-rgb),0.18)] px-3.5 py-2">
                  <p className="whitespace-pre-wrap text-[17px] leading-snug">{m.text}</p>
                  <p className="mt-0.5 text-right text-[12px] text-pc-text-muted">{clockOf(m.ts)}{m.id.startsWith('h-') ? ' · pasted' : ''}</p>
                </div>
              </div></div>
            ) : (
              <div key={m.id}>{divider}<div className="flex items-end gap-1.5">
                <div className="max-w-[80%] rounded-[20px] rounded-tl-[8px] bg-pc-surface px-3.5 py-2">
                  {m.media && !m.transcript && <p className="text-[13px] text-pc-text-muted">{m.media === 'audio' ? 'Voice message' : m.media}</p>}
                  <p className="whitespace-pre-wrap text-[17px] leading-snug">{own}</p>
                  {foreign && (tr
                    ? <p className="mt-1.5 whitespace-pre-wrap border-t border-pc-border pt-1.5 text-[15px] leading-snug text-pc-text-secondary">{tr}</p>
                    : <p className="mt-1.5 border-t border-pc-border pt-1.5 text-[13px] text-pc-text-muted">Translating…</p>)}
                  <p className="mt-0.5 text-[12px] text-pc-text-muted">{clockOf(m.ts)}{m.id.startsWith('h-') ? ' · pasted' : ''}</p>
                </div>
                {canSpeak() && (
                  <button type="button" onClick={() => say([tr ?? own], tr ? MY_LANG : contact.lang, key)} aria-label={speaking === key ? 'Stop' : 'Read aloud'}
                    className="press mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--pc-accent-ink)] active:bg-[var(--pc-hover-strong)]">
                    {speaking === key ? <Square size={16} /> : <Volume2 size={19} />}
                  </button>
                )}
              </div></div>
            );
          })}
        </div>
        <div ref={endRef} />
        </div>
      </main>

      <div className="shrink-0 border-t border-pc-border bg-pc-base pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-[760px]">
        {hint && <p className="mx-4 mt-2 text-[13px] text-red-500" role="alert">{hint}</p>}
        {showPreparing && stage.kind === 'preparing' && (
          <div className="px-3 pt-3">
            <ProgressRow tile={<Face contact={contact} size={40} />} name={`To ${contact.label}`} progress={null}
              status={foreign ? `Writing it in ${langName(contact.lang)}…` : 'Writing it as a message…'} detail={`“${stage.said.slice(0, 60)}”`} />
          </div>
        )}
        {stage.kind === 'failed' && (
          <div className="mx-3 mt-3 rounded-[12px] bg-pc-surface px-4 py-3" role="alert">
            <p className="text-[15px] text-red-500">Could not write it · {stage.error}</p>
            <p className="mt-1 text-[13px] text-pc-text-muted">You said: “{stage.said}”</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => putBack(stage.said)} className="press h-12 flex-1 rounded-[12px] bg-pc-elevated text-[16px]">Change my words</button>
              <button type="button" onClick={() => void prepare(stage.said)} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-[12px] bg-pc-accent text-[16px] font-semibold text-[var(--pc-on-accent)]"><RotateCcw size={17} /> Try again</button>
            </div>
          </div>
        )}
        {draft && (
          <section className="mx-3 mt-3 rounded-[20px] border-2 border-[var(--pc-accent)] bg-pc-elevated px-4 pb-3 pt-3" aria-label={`Message to ${contact.label}`}>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-accent-ink)]">To {contact.label} · {langName(draft.lang ?? contact.lang)}{wa ? '' : ` · ${channelName(contact.channel)}`}</p>
            {edit !== null && stage.kind === 'draft' ? (
              <textarea value={edit} onChange={e => setEdit(e.target.value)} rows={4} autoFocus aria-label="Message text"
                className="mt-1.5 w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[17px] leading-snug outline-none focus:border-pc-accent" />
            ) : (
              <p className={`mt-1 overflow-y-auto whitespace-pre-wrap font-medium leading-snug ${big ? 'max-h-[22dvh] text-[17px]' : 'max-h-[40dvh] text-[19px]'}`}>{draft.text}</p>
            )}
            {draft.back && edit === null && <p className="mt-1.5 text-[15px] leading-snug text-pc-text-muted">Means: “{draft.back}”</p>}
            {stage.kind === 'draft' && stage.error && <p className="mt-1.5 text-[13px] text-red-500" role="alert">{stage.error}</p>}

            {stage.kind === 'draft' && big && (
              <div className="mt-3">
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => discard(stage.draft)} aria-label="Drop this message" className="press flex h-14 items-center justify-center rounded-[12px] bg-pc-surface text-pc-text-muted"><Trash2 size={22} /></button>
                  <button type="button" onClick={() => { quiet(); setEdit(stage.draft.text); }} aria-label="Change the text" className="press flex h-14 items-center justify-center rounded-[12px] bg-pc-surface"><Pencil size={22} /></button>
                  <button type="button" onClick={() => (speaking === 'draft' ? quiet() : readBack(stage.draft, said))} aria-label={speaking === 'draft' ? 'Stop' : 'Hear it again'}
                    className="press flex h-14 items-center justify-center rounded-[12px] bg-pc-surface">{speaking === 'draft' ? <Square size={20} /> : <Volume2 size={24} />}</button>
                  <button type="button" onClick={() => { discard(stage.draft); sayAgain(); }} aria-label="Say it again" className="press flex h-14 items-center justify-center rounded-[12px] bg-pc-surface text-[var(--pc-accent-ink)]"><Mic size={24} /></button>
                </div>
                {asking && (
                  <button type="button" onClick={quiet} aria-label="Stop listening"
                    className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[rgba(var(--pc-accent-rgb),0.14)] text-[15px] font-semibold text-[var(--pc-accent-ink)]">
                    <Mic size={18} className="animate-pulse" /> Listening · say “da” to send, “nu” to drop it
                  </button>
                )}
                {wa ? (
                  <button type="button" onClick={() => send(stage.draft, said, true)} className="press mt-3 flex h-[88px] w-full items-center justify-center gap-3 rounded-[24px] bg-pc-accent text-[24px] font-bold text-[var(--pc-on-accent)]">
                    <Send size={28} /> Send
                  </button>
                ) : (
                  <button type="button" onClick={() => void copy(stage.draft, said)} className="press mt-3 flex h-[88px] w-full items-center justify-center gap-3 rounded-[24px] bg-pc-accent text-[24px] font-bold text-[var(--pc-on-accent)]">
                    <Copy size={28} /> Copy
                  </button>
                )}
              </div>
            )}
            {stage.kind === 'draft' && !big && (edit !== null ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setEdit(null)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px]">Cancel</button>
                <button type="button" disabled={!edit.trim()} onClick={() => void saveEdit(stage.draft, said)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px] font-semibold text-[var(--pc-accent-ink)] disabled:opacity-50">Done</button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => discard(stage.draft, said)} aria-label="Drop this message" className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-pc-surface text-pc-text-muted"><Trash2 size={19} /></button>
                <button type="button" onClick={() => setEdit(stage.draft.text)} aria-label="Change the text" className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-pc-surface"><Pencil size={19} /></button>
                {canSpeak() && (
                  <button type="button" onClick={() => say([stage.draft.text], stage.draft.lang ?? contact.lang, 'draft')} aria-label={speaking === 'draft' ? 'Stop' : 'Hear how it sounds'}
                    className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-pc-surface">{speaking === 'draft' ? <Square size={17} /> : <Volume2 size={20} />}</button>
                )}
                {wa ? (
                  <button type="button" onClick={() => send(stage.draft, said, voiceOf)} className="press flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)]">
                    <Send size={19} /> Send
                  </button>
                ) : (
                  <>
                    {canShare && <button type="button" onClick={() => void share(stage.draft, said)} aria-label="Share" className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-pc-surface"><Share2 size={19} /></button>}
                    <button type="button" onClick={() => void copy(stage.draft, said)} className="press flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)]">
                      <Copy size={19} /> Copy
                    </button>
                  </>
                )}
              </div>
            ))}
            {stage.kind === 'sending' && big && (
              <button type="button" onClick={() => undoSend(stage.draft, stage.said, true)} className="press mt-3 flex h-[88px] w-full flex-col items-center justify-center rounded-[24px] bg-pc-surface text-[var(--pc-accent-ink)]">
                <span className="text-[24px] font-bold">Undo</span>
                <span className="text-[15px] font-medium text-pc-text-muted">Sending in {left} s</span>
              </button>
            )}
            {stage.kind === 'sending' && !big && (
              <div className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">Sending in {left} s…</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-[2px] bg-[var(--pc-separator)]" aria-hidden>
                    <style>{'@keyframes wa-fill{from{width:0}to{width:100%}}'}</style>
                    <div className="h-full rounded-[2px] bg-pc-accent" style={{ animation: `wa-fill ${SEND_DELAY}ms linear forwards` }} />
                  </div>
                </div>
                <button type="button" onClick={() => undoSend(stage.draft, stage.said, stage.voice)} className="press h-14 shrink-0 rounded-full bg-pc-surface px-6 text-[17px] font-semibold text-[var(--pc-accent-ink)]">Undo</button>
              </div>
            )}
            {stage.kind === 'sent' && <p className="mt-2 text-[15px] font-semibold text-[var(--pc-accent-ink)]" role="status">{stage.how}</p>}
          </section>
        )}
        {stage.kind !== 'sending' && edit === null && !big && (
          <Composer key={prefill?.nonce ?? 0} prefill={prefill} onSend={(text, _a, meta) => void prepare(text, !!meta?.voice)} voice transcribe={transcribeAudio} handsFree
            draftKey={`wa:${contact.id}`} attach={false} sendLabel="Prepare the message"
            placeholder={stage.kind === 'draft' ? 'Say it differently' : lastTheirs ? `Your answer to ${contact.label}, in any language` : `Tell ${contact.label}, in any language`} />
        )}
        </div>
      </div>

      {paste !== null && (
        <Sheet label="They wrote" onClose={() => setPaste(null)} className="px-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">{contact.label} wrote</h2>
            <CloseButton onClick={() => setPaste(null)} />
          </div>
          <p className="mb-2 text-[13px] text-pc-text-muted">Paste their message from email or another app, or messages copied from a WhatsApp chat (both sides: each becomes its own message, at its own time). It is translated here, and your next answer follows it.</p>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={6} autoFocus aria-label="What they wrote"
            className="w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[16px] leading-snug outline-none focus:border-pc-accent" />
          <button type="button" disabled={!paste.trim()} onClick={() => void savePaste()}
            className="press mb-4 mt-3 flex h-14 w-full items-center justify-center rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
            Add to the conversation
          </button>
        </Sheet>
      )}
    </div>
  );
}
