import { useEffect, useRef, useState } from 'react';
import { AudioLines, Mic, Plus, SendHorizontal, Square, X } from 'lucide-react';
import { canDictate, canRecord, dictate, record, type Dictation, type Recorder } from '../app/voice';
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
  /** Mic in the field = dictate into the box; the send button, when the box is empty, records a voice note. */
  voice?: boolean;
  lang?: string;
  placeholder?: string;
}

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export function Composer({ onSend, prefill, hint, onHintDismiss, replyTo, onReplyCancel, voice, lang = 'ro-RO', placeholder = 'Message' }: Props) {
  const [text, setText] = useState(() => (prefill?.text ? prefill.text + '\n' : ''));
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>(() => prefill?.attachments ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- voice: the mic in the field dictates (tap to start/stop); the round button records a
  // voice note when the box is empty (tap to start, tap again to send, X to throw it away).
  const [mode, setMode] = useState<'idle' | 'dictating' | 'starting' | 'recording'>('idle');
  const dict = useRef<Dictation | null>(null);
  const rec = useRef<Recorder | null>(null);
  const base = useRef('');
  const [secs, setSecs] = useState(0);

  const stopDictation = () => { dict.current?.stop(); dict.current = null; };
  const toggleDictation = () => {
    if (mode === 'dictating') { stopDictation(); setMode('idle'); return; }
    if (mode !== 'idle') return;
    base.current = text ? text.replace(/\s*$/, ' ') : '';
    const d = dictate(lang, (final, interim) => setText(base.current + final + interim), (err) => {
      dict.current = null; setMode('idle');
      if (err && err !== 'aborted') setError(`Dictation: ${err}`);
    });
    if (!d) { setError('Dictation is not available in this browser'); return; }
    setError(null); dict.current = d; setMode('dictating');
  };
  const startRecording = async () => {
    if (mode !== 'idle') return;
    setError(null); setMode('starting');
    try { rec.current = await record(); setSecs(0); setMode('recording'); }
    catch { setMode('idle'); setError('Microphone not available (check the app\'s microphone permission)'); }
  };
  const stopRecording = async (keep: boolean) => {
    const r = rec.current; rec.current = null; setMode('idle');
    const note = await r?.stop();
    if (!keep) return;
    if (note) onSend('🎤 Voice note', [note]);   // a caption, so the bubble shows and the agent knows what it is
    else setError('Too short, nothing sent');
  };
  useEffect(() => {
    if (mode !== 'recording') return;
    const t = window.setInterval(() => setSecs(n => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [mode]);
  useEffect(() => () => { void rec.current?.stop(); }, []);
  useEffect(() => () => { stopDictation(); }, []);

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
  }, [text]);

  const canSend = !busy && (text.trim().length > 0 || attachments.length > 0);

  const send = () => {
    if (!canSend) return;
    const body = text.trim();
    onSend(replyTo ? `${quoteForReply(replyTo.text)}\n\n${body}` : body, attachments);
    setText('');
    setAttachments([]);
    setError(null);
    onHintDismiss?.();
    onReplyCancel?.();
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

  return (
    <div className="shrink-0 bg-pc-base px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {hint && (
        <div className="mx-1 mb-1.5 flex items-center justify-between rounded-lg bg-[rgba(var(--pc-accent-rgb),0.12)] px-3 py-1.5 text-xs text-pc-text">
          <span>{hint}</span>
          <button type="button" onClick={onHintDismiss} className="text-pc-text-muted" aria-label="Dismiss">×</button>
        </div>
      )}
      {replyTo && (
        <div className="mx-1 mb-1.5 flex items-start gap-2 rounded-xl border-l-4 border-pc-accent bg-pc-surface px-3 py-1.5 shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-pc-accent">{replyTo.mine ? 'You' : 'OpenClaw'}</p>
            <p className="line-clamp-2 text-[13px] text-pc-text-muted break-words">{replyTo.text || '📷 Photo'}</p>
          </div>
          <button type="button" onClick={onReplyCancel} className="h-6 w-6 shrink-0 rounded-full text-pc-text-muted hover:bg-[var(--pc-hover-strong)]" aria-label="Cancel reply">×</button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="mx-1 mb-1.5 flex gap-2 overflow-x-auto">
          {attachments.map((a, i) => (
            <AttachmentChip
              key={i}
              name={a.fileName}
              mimeType={a.mimeType}
              preview={a.mimeType.startsWith('image/') ? `data:${a.mimeType};base64,${a.content}` : undefined}
              onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}
      {error && <p className="mx-2 mb-1 text-xs text-red-500">{error}</p>}

      <div className="flex items-end gap-1.5">
        <div className="flex flex-1 items-end rounded-3xl bg-pc-surface border border-pc-border pl-1 pr-3 py-1 shadow-sm">
          {mode === 'recording' || mode === 'starting' ? (
            <button
              type="button"
              onClick={() => void stopRecording(false)}
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-pc-text-muted hover:bg-[var(--pc-hover)]"
              aria-label="Cancel voice note"
            >
              <X size={22} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-pc-text-muted hover:bg-[var(--pc-hover)]"
              aria-label="Attach"
            >
              <Plus size={22} />
            </button>
          )}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => void addFiles(e.target.files)} />
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            readOnly={mode === 'recording' || mode === 'starting' || mode === 'dictating'}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !isTouch()) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={mode === 'recording' ? `● Recording ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : mode === 'starting' ? 'Starting microphone…' : mode === 'dictating' ? 'Listening… tap the mic to stop' : placeholder}
            enterKeyHint={isTouch() ? 'enter' : 'send'}
            className="flex-1 resize-none bg-transparent py-2 pl-1 text-[16px] leading-[22px] text-pc-text placeholder:text-pc-text-faint outline-none"
            aria-label="Message"
          />
          {voice && canDictate() && mode !== 'recording' && mode !== 'starting' && (
            <button
              type="button"
              onClick={toggleDictation}
              className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center select-none ${mode === 'idle' ? 'text-pc-text-muted hover:bg-[var(--pc-hover)]' : 'bg-red-500 text-white animate-pulse'}`}
              aria-label={mode === 'dictating' ? 'Stop dictation' : 'Dictate'}
              title={mode === 'dictating' ? 'Stop dictation' : 'Dictate (speech to text)'}
            >
              {mode === 'idle' ? <Mic size={20} /> : <Square size={16} />}
            </button>
          )}
        </div>
        {mode === 'recording' || mode === 'starting' ? (
          <button
            type="button"
            onClick={() => void stopRecording(true)}
            disabled={mode === 'starting'}
            className="h-11 w-11 shrink-0 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm animate-pulse disabled:opacity-60"
            aria-label="Send voice note"
          >
            <SendHorizontal size={20} />
          </button>
        ) : voice && canRecord() && !canSend && mode === 'idle' ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="h-11 w-11 shrink-0 rounded-full bg-pc-accent text-white flex items-center justify-center shadow-sm"
            aria-label="Record a voice note"
            title="Record a voice note"
          >
            <AudioLines size={20} />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="h-11 w-11 shrink-0 rounded-full bg-pc-accent text-white flex items-center justify-center shadow-sm disabled:opacity-40 transition-opacity"
            aria-label="Send"
          >
            <SendHorizontal size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
