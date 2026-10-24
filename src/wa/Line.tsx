/**
 * One person's line: what they wrote (with its translation when they write in another language, each
 * readable aloud), and the dock where you say what to tell them. What you say, in any language, is
 * written as the message in their language and tone; you read it (and its meaning in yours), may hear
 * it, change it or drop it, and Send. Send waits 5 seconds with Undo before the message leaves
 * (my.design: every change offers Undo; a sent WhatsApp cannot be taken back).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Pencil, RotateCcw, Send, Square, Trash2, Volume2 } from 'lucide-react';
import { Composer, type ComposerPrefill } from '../mobile/Composer';
import { post, transcribeAudio } from '../app/api';
import { IconButton } from '../ui/Controls';
import { ProgressRow } from '../ui/ProgressRow';
import { useBusy } from '../ui/draft';
import { canSpeak, speak } from '../ui/speak';
import { useDelayedFlag } from '../ui/progress';
import { Face } from './Face';
import { MY_LANG, act, compose, fetchConversation, langName, timeOf, translate, type Contact, type Draft, type WaMessage } from './api';

const SEND_DELAY = 5000;
const draftKeyOf = (contact: string) => `wa:draft:${contact}`;
const keep = (k: string, v: string | null) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* not kept */ } };
const kept = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

type Stage =
  | { kind: 'idle' }
  | { kind: 'preparing'; said: string }
  | { kind: 'failed'; said: string; error: string }
  | { kind: 'draft'; draft: Draft; said?: string; error?: string }
  | { kind: 'sending'; draft: Draft }
  | { kind: 'sent'; draft: Draft };

export function Line({ contact, onBack, onProfile, onSent }: { contact: Contact; onBack: () => void; onProfile: () => void; onSent: () => void }) {
  const [msgs, setMsgs] = useState<WaMessage[] | null>(contact.listen ? null : []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const stopSpeech = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const foreign = contact.lang !== MY_LANG;
  useBusy(`wa-line-${contact.id}`, stage.kind === 'preparing' || stage.kind === 'sending' || edit !== null);

  // ---- the conversation: now, when the app comes back, and every 20 s while open
  const load = useCallback(async () => {
    if (!contact.listen) return;   // nothing kept: the list stays empty
    try { setMsgs(await fetchConversation(contact.id)); setLoadError(null); }
    catch (e) { setLoadError(navigator.onLine ? (e instanceof Error ? e.message : 'Could not load') : 'No connection'); }
  }, [contact.id, contact.listen]);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, stage.kind]);
  useEffect(() => () => stopSpeech.current?.(), []);

  // ---- their words in mine: the newest five not yet translated, one after the other
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!foreign || !msgs) return;
    const todo = msgs.filter(m => m.from === 'them' && !m.translation && !asked.current.has(m.id)).slice(-5);
    if (!todo.length) return;
    todo.forEach(m => asked.current.add(m.id));
    void (async () => {
      for (const m of todo) {
        try { const t = await translate(m.id); setTranslations(s => ({ ...s, [m.id]: t })); }
        catch { asked.current.delete(m.id); }
      }
    })();
  }, [msgs, foreign]);

  // ---- a draft left from before (the app was closed): shown again while it is still a draft
  useEffect(() => {
    const id = kept(draftKeyOf(contact.id));
    if (!id) return;
    void post<{ drafts: Record<string, Draft> }>('/reg/wa/status', { ids: [id] })
      .then(r => { const d = r.drafts[id]; if (d && (d.status === 'draft' || d.status === 'failed')) setStage(s => (s.kind === 'idle' ? { kind: 'draft', draft: { ...d, id } } : s)); else keep(draftKeyOf(contact.id), null); })
      .catch(() => undefined);
  }, [contact.id]);

  const say = (texts: string[], lang: string, key: string) => {
    if (speaking === key) { stopSpeech.current?.(); return; }
    stopSpeech.current?.();
    setSpeaking(key);
    stopSpeech.current = speak(texts, lang, () => setSpeaking(s => (s === key ? null : s)));
  };

  // ---- what you said -> the message in their language
  const prepare = async (said: string) => {
    if (stage.kind === 'draft') void act(stage.draft.id, 'cancel').catch(() => undefined);   // a new message replaces the old draft
    setStage({ kind: 'preparing', said });
    try {
      const d = await compose(contact.id, said);
      keep(draftKeyOf(contact.id), d.id);
      setStage({ kind: 'draft', draft: d, said });
    } catch (e) {
      setStage({ kind: 'failed', said, error: navigator.onLine ? (e instanceof Error ? e.message : 'Could not write it') : 'No connection' });
    }
  };
  const putBack = (said: string) => { setStage({ kind: 'idle' }); setPrefill({ nonce: Date.now(), text: said.trim(), attachments: [] }); };
  const discard = (d: Draft, said?: string) => {
    void act(d.id, 'cancel').catch(() => undefined);
    keep(draftKeyOf(contact.id), null);
    setStage({ kind: 'idle' });
    if (said) setPrefill({ nonce: Date.now(), text: said.trim(), attachments: [] });   // your words come back to the box
  };
  const saveEdit = async (d: Draft) => {
    const t = (edit ?? '').trim();
    if (!t) return;
    try { const n = await act(d.id, 'edit', t); setStage({ kind: 'draft', draft: { ...n, id: d.id } }); setEdit(null); }
    catch (e) { setStage({ kind: 'draft', draft: d, error: e instanceof Error ? e.message : 'Could not change it' }); }
  };

  // ---- Send: 5 s with Undo, then it leaves
  const timer = useRef<number | null>(null);
  const [left, setLeft] = useState(0);   // seconds before it leaves
  const ticker = useRef<number | null>(null);
  const stopTimers = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (ticker.current) window.clearInterval(ticker.current);
    timer.current = ticker.current = null;
  };
  useEffect(() => stopTimers, []);   // leaving the screen keeps it a draft
  const send = (d: Draft) => {
    stopSpeech.current?.();
    setStage({ kind: 'sending', draft: d });
    setLeft(SEND_DELAY / 1000);
    ticker.current = window.setInterval(() => setLeft(n => Math.max(1, n - 1)), 1000);
    timer.current = window.setTimeout(async () => {
      stopTimers();
      try {
        const r = await act(d.id, 'send');
        if (r.status === 'sent') { keep(draftKeyOf(contact.id), null); setStage({ kind: 'sent', draft: { ...r, id: d.id } }); onSent(); void load(); }
        else setStage({ kind: 'draft', draft: { ...r, id: d.id }, error: r.error || 'Not sent' });
      } catch (e) {
        setStage({ kind: 'draft', draft: d, error: navigator.onLine ? (e instanceof Error ? e.message : 'Not sent') : 'No connection: not sent' });
      }
    }, SEND_DELAY);
  };
  const undoSend = (d: Draft) => { stopTimers(); setStage({ kind: 'draft', draft: d }); };
  useEffect(() => {
    if (stage.kind !== 'sent') return;
    const t = window.setTimeout(() => setStage(s => (s.kind === 'sent' ? { kind: 'idle' } : s)), 2500);
    return () => window.clearTimeout(t);
  }, [stage]);
  const showPreparing = useDelayedFlag(stage.kind === 'preparing', 0);

  const toneWord = contact.tone === 'formal' ? 'formal' : 'informal';
  const draft = stage.kind === 'draft' || stage.kind === 'sending' || stage.kind === 'sent' ? stage.draft : null;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border pt-[env(safe-area-inset-top)]">
        <div className="flex h-[64px] items-center gap-2 px-2">
          <IconButton label="All people" onClick={onBack}><ChevronLeft size={24} /></IconButton>
          <Face contact={contact} size={40} />
          <div className="min-w-0 flex-1 pl-1">
            <h1 className="truncate text-[19px] font-semibold leading-tight">{contact.label}</h1>
            <p className="truncate text-[13px] leading-tight text-pc-text-muted">{langName(contact.lang)} · {toneWord}{foreign ? ` · translated to ${langName(MY_LANG)}` : ''}</p>
          </div>
          <IconButton label={`Profile of ${contact.label}`} onClick={onProfile}><Pencil size={19} /></IconButton>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-3" aria-live="polite">
        {!contact.listen && (
          <button type="button" onClick={onProfile} className="mb-3 block w-full rounded-[12px] bg-pc-surface px-4 py-3 text-left text-[15px] text-pc-text-secondary">
            Their messages are not kept here. Turn on <b className="font-semibold text-pc-text">Keep their messages here</b> in their profile to read and hear them.
          </button>
        )}
        {loadError && <p className="mb-2 text-[13px] text-red-500" role="alert">{loadError} · <button type="button" className="underline" onClick={() => void load()}>try again</button></p>}
        {contact.listen && msgs === null && !loadError && <p className="py-10 text-center text-[15px] text-pc-text-muted">Loading…</p>}
        {contact.listen && msgs?.length === 0 && <p className="py-10 text-center text-[15px] text-pc-text-muted">Nothing yet. When {contact.label} writes, it appears here.</p>}
        <div className="space-y-2.5">
          {msgs?.map(m => {
            const tr = m.translation ?? translations[m.id];
            const own = m.transcript || m.text;
            const key = `m-${m.id}`;
            return m.from === 'me' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-[20px] rounded-tr-[8px] bg-[rgba(var(--pc-accent-rgb),0.18)] px-3.5 py-2">
                  <p className="whitespace-pre-wrap text-[17px] leading-snug">{m.text}</p>
                  <p className="mt-0.5 text-right text-[12px] text-pc-text-muted">{timeOf(m.ts)}</p>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex items-end gap-1.5">
                <div className="max-w-[80%] rounded-[20px] rounded-tl-[8px] bg-pc-surface px-3.5 py-2">
                  {m.media && !m.transcript && <p className="text-[13px] text-pc-text-muted">{m.media === 'audio' ? 'Voice message' : m.media}</p>}
                  <p className="whitespace-pre-wrap text-[17px] leading-snug">{own}</p>
                  {foreign && (tr
                    ? <p className="mt-1.5 whitespace-pre-wrap border-t border-pc-border pt-1.5 text-[15px] leading-snug text-pc-text-secondary">{tr}</p>
                    : <p className="mt-1.5 border-t border-pc-border pt-1.5 text-[13px] text-pc-text-muted">Translating…</p>)}
                  <p className="mt-0.5 text-[12px] text-pc-text-muted">{timeOf(m.ts)}</p>
                </div>
                {canSpeak() && (
                  <button type="button" onClick={() => say([tr ?? own], tr ? MY_LANG : contact.lang, key)} aria-label={speaking === key ? 'Stop' : 'Read aloud'}
                    className="press mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--pc-accent-ink)] active:bg-[var(--pc-hover-strong)]">
                    {speaking === key ? <Square size={16} /> : <Volume2 size={19} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div ref={endRef} />
      </main>

      <div className="shrink-0 border-t border-pc-border bg-pc-base pb-[env(safe-area-inset-bottom)]">
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
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-accent-ink)]">To {contact.label} · {langName(draft.lang ?? contact.lang)}</p>
            {edit !== null && stage.kind === 'draft' ? (
              <textarea value={edit} onChange={e => setEdit(e.target.value)} rows={3} autoFocus aria-label="Message text"
                className="mt-1.5 w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[17px] leading-snug outline-none focus:border-pc-accent" />
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-[19px] font-medium leading-snug">{draft.text}</p>
            )}
            {draft.back && edit === null && <p className="mt-1.5 text-[15px] leading-snug text-pc-text-muted">Means: “{draft.back}”</p>}
            {stage.kind === 'draft' && stage.error && <p className="mt-1.5 text-[13px] text-red-500" role="alert">{stage.error}</p>}

            {stage.kind === 'draft' && (edit !== null ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setEdit(null)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px]">Cancel</button>
                <button type="button" disabled={!edit.trim()} onClick={() => void saveEdit(stage.draft)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px] font-semibold text-[var(--pc-accent-ink)] disabled:opacity-50">Done</button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => discard(stage.draft, stage.said)} aria-label="Drop this message" className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-pc-surface text-pc-text-muted"><Trash2 size={19} /></button>
                <button type="button" onClick={() => setEdit(stage.draft.text)} aria-label="Change the text" className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-pc-surface"><Pencil size={19} /></button>
                {canSpeak() && (
                  <button type="button" onClick={() => say([stage.draft.text], stage.draft.lang ?? contact.lang, 'draft')} aria-label={speaking === 'draft' ? 'Stop' : 'Hear how it sounds'}
                    className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-pc-surface">{speaking === 'draft' ? <Square size={17} /> : <Volume2 size={20} />}</button>
                )}
                <button type="button" onClick={() => send(stage.draft)} className="press flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)]">
                  <Send size={19} /> Send
                </button>
              </div>
            ))}
            {stage.kind === 'sending' && (
              <div className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">Sending in {left} s…</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-[2px] bg-[var(--pc-separator)]" aria-hidden>
                    <style>{'@keyframes wa-fill{from{width:0}to{width:100%}}'}</style>
                    <div className="h-full rounded-[2px] bg-pc-accent" style={{ animation: `wa-fill ${SEND_DELAY}ms linear forwards` }} />
                  </div>
                </div>
                <button type="button" onClick={() => undoSend(stage.draft)} className="press h-14 shrink-0 rounded-full bg-pc-surface px-6 text-[17px] font-semibold text-[var(--pc-accent-ink)]">Undo</button>
              </div>
            )}
            {stage.kind === 'sent' && <p className="mt-2 text-[15px] font-semibold text-[var(--pc-accent-ink)]" role="status">Sent {timeOf(stage.draft.sent_at ?? new Date().toISOString())}</p>}
          </section>
        )}
        {stage.kind !== 'sending' && edit === null && (
          <Composer key={prefill?.nonce ?? 0} prefill={prefill} onSend={text => void prepare(text)} voice transcribe={transcribeAudio}
            draftKey={`wa:${contact.id}`} attach={false} sendLabel="Prepare the message"
            placeholder={stage.kind === 'draft' ? 'Say it differently' : `Tell ${contact.label}, in any language`} />
        )}
      </div>
    </div>
  );
}
