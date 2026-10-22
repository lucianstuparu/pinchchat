import { useEffect, useRef, useState } from 'react';
import { ArrowUp, AudioLines, Check, Loader2, Mic, Paperclip, Plus, Square, Trash2, X } from 'lucide-react';
import { DICTATION_LANGS, canDictate, canRecord, dictate, getDictationLang, record, setDictationLang, type Dictation, type Recorder } from '../app/voice';
import { AttachmentChip } from './MessageBubble';
import { quoteForReply } from './messageView';
import { encodeAttachment, AttachmentTooLargeError, type OutgoingAttachment } from './attachments';

export interface ComposerPrefill {
  /** Changes whenever new content should be injected; used as the remount key */
  nonce: number;
  text: string;
  attachments: OutgoingAttachment[];
}

interface Props {
  onSend: (text: string, attachments: OutgoingAttachment[]) => void;
  /**
   * Initial content (share import, retry). The parent remounts the composer with
   * key={prefill.nonce} so each injection starts from a clean state.
   */
  prefill?: ComposerPrefill | null;
  /** Shown above the field, e.g. "Shared from another app — add a note" */
  hint?: string | null;
  onHintDismiss?: () => void;
  /** Message being replied to; its quote is prepended on send. */
  replyTo?: { text: string; mine: boolean } | null;
  onReplyCancel?: () => void;
  /**
   * Voice: the mic in the field turns speech into text you can edit (the phone's own recogniser,
   * live); "Voice message" in the + menu records audio that is sent as is (the gateway
   * transcribes it with Whisper).
   */
  voice?: boolean;
  /** Speech to text on the server (Whisper), for browsers without their own recogniser. */
  transcribe?: (audio: OutgoingAttachment) => Promise<string>;
  placeholder?: string;
}

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Composer({ onSend, prefill, hint, onHintDismiss, replyTo, onReplyCancel, voice, transcribe, placeholder = 'Message' }: Props) {
  const [text, setText] = useState(() => (prefill?.text ? prefill.text + '\n' : ''));
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>(() => prefill?.attachments ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- voice
  const [mode, setMode] = useState<'idle' | 'dictating' | 'starting' | 'recording' | 'transcribing'>('idle');
  const forText = useRef(false);   // the recording is for speech to text (server), not a voice message
  // Whisper (any language, mixed too) whenever the app gives a transcriber; the phone's own
  // recogniser (one language at a time) only without one.
  const serverStt = !!transcribe && canRecord();
  const [lang, setLang] = useState(getDictationLang);
  const dict = useRef<Dictation | null>(null);
  const rec = useRef<Recorder | null>(null);
  const base = useRef('');
  const [secs, setSecs] = useState(0);

  // stop(): the last words still land (the ref is cleared when it ends); dropDictation(): the text was
  // sent or cleared, so anything the recogniser still delivers is ignored.
  const stopDictation = () => { dict.current?.stop(); };
  const dropDictation = () => { const d = dict.current; dict.current = null; d?.abort(); };
  const startDictation = (code: string, from: string) => {
    base.current = from ? from.replace(/\s*$/, ' ') : '';
    const d = dictate(code, (t) => { if (dict.current === d) setText(base.current + t); }, (err) => {
      if (dict.current !== d) return;   // a language switch restarted it
      dict.current = null; setMode('idle');
      if (err === 'not-allowed') setError('Microphone blocked: allow it for this app in Chrome’s site settings');
      else if (err) setError(`Dictation stopped (${err})`);
    });
    if (!d) { setError('Speech to text is not available in this browser'); return; }
    setError(null); dict.current = d; setMode('dictating');
  };
  const toggleDictation = () => {
    if (mode === 'dictating') { stopDictation(); setMode('idle'); taRef.current?.focus(); return; }
    if (mode === 'idle') { const code = getDictationLang(); setLang(code); startDictation(code, text); }   // Settings may have changed it
  };
  const nextLang = () => {
    const i = DICTATION_LANGS.findIndex(l => l.code === lang);
    const code = DICTATION_LANGS[(i + 1) % DICTATION_LANGS.length].code;
    setLang(code); setDictationLang(code);
    if (mode === 'dictating') { const keep = text; dropDictation(); startDictation(code, keep); }
  };

  const startRecording = async (text = false) => {
    setPlusOpen(false);
    if (mode !== 'idle') return;
    forText.current = text;
    setError(null); setMode('starting');
    try { rec.current = await record(); setSecs(0); setMode('recording'); }
    catch { setMode('idle'); setError('Microphone not available: allow it for this app in Chrome’s site settings'); }
  };
  const stopRecording = async (keep: boolean) => {
    const r = rec.current; rec.current = null; setMode('idle');
    const note = await r?.stop();
    if (!keep) return;
    if (forText.current) {
      if (!note || !transcribe) { setError('Nothing was recorded'); return; }
      setMode('transcribing');
      try { const t = (await transcribe(note)).trim(); if (t) setText(prev => (prev ? prev.replace(/\s*$/, ' ') : '') + t); else setError('No speech recognised'); }
      catch { setError('Could not turn the recording into text'); }
      finally { setMode('idle'); }
      return;
    }
    if (note) onSend('🎤 Voice message', [note]);   // a caption, so the bubble shows and the agent knows what it is
    else setError('Nothing was recorded');
  };
  useEffect(() => {
    if (mode !== 'recording') return;
    const t = window.setInterval(() => setSecs(n => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [mode]);
  useEffect(() => () => { void rec.current?.stop(); dict.current?.stop(); }, []);

  // After a share/retry injection, focus with the cursor at the end, ready for a note
  useEffect(() => {
    if (!prefill) return;
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [prefill]);

  // Choosing Reply opens the keyboard, like WhatsApp
  useEffect(() => {
    if (replyTo) taRef.current?.focus();
  }, [replyTo]);

  // Auto-grow up to ~6 lines
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 6 * 22 + 16) + 'px';
  }, [text, mode]);

  const canSend = !busy && (text.trim().length > 0 || attachments.length > 0);

  const send = () => {
    if (!canSend) return;
    if (mode === 'dictating') { dropDictation(); setMode('idle'); }
    const body = text.trim();
    onSend(replyTo ? `${quoteForReply(replyTo.text)}\n\n${body}` : body, attachments);
    setText('');
    setAttachments([]);
    setError(null);
    onHintDismiss?.();
    onReplyCancel?.();
  };
  const clear = () => {
    if (mode === 'dictating') { dropDictation(); setMode('idle'); }
    setText(''); setError(null); taRef.current?.focus();
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const added: OutgoingAttachment[] = [];
    for (const f of Array.from(files)) {
      try {
        added.push(await encodeAttachment(f, f.name));
      } catch (e) {
        setError(e instanceof AttachmentTooLargeError ? e.message : `Could not attach ${f.name}`);
      }
    }
    setAttachments(prev => [...prev, ...added]);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const recording = mode === 'recording' || mode === 'starting' || mode === 'transcribing';
  const round = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full';
  const langShort = DICTATION_LANGS.find(l => l.code === lang)?.short ?? 'RO';

  return (
    <div className="shrink-0 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {hint && (
        <div className="mx-1 mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-[rgba(var(--pc-accent-rgb),0.1)] px-3 py-2 text-[13px] text-pc-text">
          <span>{hint}</span>
          <button type="button" onClick={onHintDismiss} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-pc-text-muted" aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}
      {replyTo && (
        <div className="mx-1 mb-1.5 flex items-start gap-2 rounded-xl border-l-[3px] border-pc-accent bg-pc-surface px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-pc-accent">{replyTo.mine ? 'You' : 'Assistant'}</p>
            <p className="line-clamp-2 text-[13px] text-pc-text-muted break-words">{replyTo.text || '📷 Photo'}</p>
          </div>
          <button type="button" onClick={onReplyCancel} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-pc-text-muted" aria-label="Cancel reply"><X size={14} /></button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="mx-1 mb-1.5 flex gap-2 overflow-x-auto">
          {attachments.map((a, i) => (
            <AttachmentChip key={i} name={a.fileName} mimeType={a.mimeType}
              preview={a.mimeType.startsWith('image/') ? `data:${a.mimeType};base64,${a.content}` : undefined}
              onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
      {error && <p className="mx-3 mb-1 text-[12px] text-red-500" role="alert">{error}</p>}

      <input ref={fileRef} type="file" multiple className="hidden" onChange={e => void addFiles(e.target.files)} />
      <div className="flex items-end gap-1.5">
        {recording ? (
          <button type="button" disabled={mode === 'transcribing'} onClick={() => void stopRecording(false)} className={`${round} text-red-500 active:bg-[var(--pc-hover-strong)] disabled:opacity-40`} aria-label="Discard recording">
            <Trash2 size={20} />
          </button>
        ) : (
          <div className="relative">
            <button type="button" onClick={() => (voice && canRecord() ? setPlusOpen(o => !o) : fileRef.current?.click())}
              className={`${round} bg-pc-surface text-pc-text-secondary transition-transform active:scale-95 ${plusOpen ? 'rotate-45' : ''}`}
              aria-label={voice && canRecord() ? 'Add' : 'Attach'} aria-expanded={plusOpen}>
              <Plus size={22} />
            </button>
            {plusOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setPlusOpen(false)} />
                <div className="absolute bottom-12 left-0 z-30 w-56 overflow-hidden rounded-2xl border border-pc-border bg-pc-elevated shadow-xl" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); fileRef.current?.click(); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-[var(--pc-hover-strong)]">
                    <Paperclip size={19} className="text-pc-accent" /> Photo or file
                  </button>
                  <div className="mx-4 h-px bg-[var(--pc-separator)]" />
                  <button type="button" role="menuitem" onClick={() => void startRecording(false)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-[var(--pc-hover-strong)]">
                    <AudioLines size={19} className="text-pc-accent" />
                    <span>Voice message<span className="block text-[12px] text-pc-text-muted">sent as audio</span></span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {recording ? (
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[20px] bg-pc-surface px-4" role="status" aria-live="polite">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="text-[15px] tabular-nums">{mode === 'starting' ? 'Starting…' : mode === 'transcribing' ? 'Turning it into text…' : clock(secs)}</span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
              {Array.from({ length: 18 }).map((_, i) => (
                <span key={i} className="w-[3px] rounded-full bg-[rgba(var(--pc-accent-rgb),0.55)]"
                  style={{ height: `${6 + ((i * 7 + secs * 5) % 14)}px`, transition: 'height 300ms' }} />
              ))}
            </span>
          </div>
        ) : (
          <div className={`flex min-w-0 flex-1 items-end rounded-[20px] border bg-pc-surface pl-3.5 pr-1 transition-colors ${mode === 'dictating' ? 'border-[rgba(var(--pc-accent-rgb),0.6)]' : 'border-transparent'}`}>
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !isTouch()) { e.preventDefault(); send(); }
              }}
              placeholder={mode === 'dictating' ? 'Listening…' : placeholder}
              enterKeyHint={isTouch() ? 'enter' : 'send'}
              className="min-w-0 flex-1 resize-none bg-transparent py-[9px] text-[16px] leading-[22px] text-pc-text placeholder:text-pc-text-muted outline-none focus:outline-none focus-visible:outline-none"
              aria-label="Message"
            />
            {text.length > 0 && mode !== 'dictating' && (
              <button type="button" onClick={clear} className="flex h-10 w-8 shrink-0 items-center justify-center text-pc-text-faint active:text-pc-text-muted" aria-label="Clear">
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-pc-text-faint text-pc-surface"><X size={12} strokeWidth={3} /></span>
              </button>
            )}
            {voice && canDictate() && mode === 'dictating' && (
              <button type="button" onClick={nextLang} className="mb-[7px] mr-0.5 h-[26px] shrink-0 rounded-full border border-pc-border px-2 text-[12px] font-semibold text-pc-text-secondary" aria-label={`Dictation language ${langShort}, tap to change`}>
                {langShort}
              </button>
            )}
            {voice && serverStt && mode === 'idle' && (
              <button type="button" onClick={() => void startRecording(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted" aria-label="Speak to type" title="Speak to type">
                <Mic size={21} />
              </button>
            )}
            {voice && canDictate() && !serverStt && (
              <button type="button" onClick={toggleDictation}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${mode === 'dictating' ? 'text-red-500' : 'text-pc-text-muted active:text-pc-text'}`}
                aria-label={mode === 'dictating' ? 'Stop dictation' : 'Speak to type'} title={mode === 'dictating' ? 'Stop' : 'Speak to type'}>
                {mode === 'dictating'
                  ? <span className="relative flex h-7 w-7 items-center justify-center"><span className="absolute inset-0 animate-ping rounded-full bg-red-500/25" /><Square size={14} fill="currentColor" /></span>
                  : <Mic size={21} />}
              </button>
            )}
          </div>
        )}

        {recording ? (
          <button type="button" disabled={mode !== 'recording'} onClick={() => void stopRecording(true)}
            className={`${round} bg-pc-accent text-white transition-transform active:scale-95 disabled:opacity-50`} aria-label={forText.current ? 'Done speaking' : 'Send voice message'}>
            {mode === 'transcribing' ? <Loader2 size={20} className="animate-spin" /> : forText.current ? <Check size={21} strokeWidth={2.5} /> : <ArrowUp size={21} strokeWidth={2.5} />}
          </button>
        ) : (canSend || !voice) && (
          <button type="button" onClick={send} disabled={!canSend}
            className={`${round} bg-pc-accent text-white transition-transform active:scale-95 disabled:opacity-40`} aria-label="Send">
            <ArrowUp size={21} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
