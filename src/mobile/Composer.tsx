import { useEffect, useRef, useState } from 'react';
import { SpeechStatus } from '../app/SpeechStatus';
import { useBusy, useDraft } from '../ui/draft';
import { ArrowUp, AudioLines, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { SILENT, canRecord, record, type Recorder } from '../app/voice';
import { FieldControls, PrimaryButton } from '../app/MicButton';
import { speechPlaceholder, useSpeech } from '../app/speech';
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
   * Voice: the big mic writes into the box (Live or Whisper, chosen in Settings; oc-app-design.md
   * §6), and "Voice message" in the + menu records audio that is sent as is.
   */
  voice?: boolean;
  /** Speech to text on the server (Whisper). */
  transcribe?: (audio: OutgoingAttachment) => Promise<string>;
  placeholder?: string;
}

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const noTranscriber = () => Promise.reject(new Error('no transcriber'));

export function Composer({ onSend, prefill, hint, onHintDismiss, replyTo, onReplyCancel, voice, transcribe, placeholder = 'Message' }: Props) {
  // The draft comes back after a reload; shared or retried content replaces it.
  const [text, setText] = useDraft('chat', prefill?.text ? prefill.text + '\n' : undefined);
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>(() => prefill?.attachments ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const speech = useSpeech(text, setText, transcribe ?? noTranscriber);

  // ---- a voice message: audio sent as is (the + menu)
  const [vm, setVm] = useState<'idle' | 'starting' | 'recording'>('idle');
  const rec = useRef<Recorder | null>(null);
  const [secs, setSecs] = useState(0);
  const startVoiceMessage = async () => {
    setPlusOpen(false);
    if (vm !== 'idle') return;
    speech.cancel();
    setError(null); setVm('starting');
    try { rec.current = await record(); setSecs(0); setVm('recording'); }
    catch { setVm('idle'); setError('Microphone not available: allow it for this app in Chrome’s site settings'); }
  };
  const stopVoiceMessage = async (keep: boolean) => {
    const r = rec.current; rec.current = null; setVm('idle');
    const silent = !!r && r.peak() < SILENT;
    const note = await r?.stop();
    if (!keep) return;
    if (silent) { setError(`The microphone recorded only silence${r?.device ? ` (${r.device})` : ''}. With a Bluetooth headset or watch connected, try again with it off.`); return; }
    if (note) onSend('Voice message', [note]);   // a caption, so the bubble shows and the agent knows what it is
    else setError('Nothing was recorded');
  };
  useEffect(() => {
    if (vm !== 'recording') return;
    const t = window.setInterval(() => setSecs(n => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [vm]);
  useEffect(() => () => { void rec.current?.stop(); }, []);

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

  // The box grows with the text, from two lines up to six.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 56), 6 * 22 + 20)}px`;
  }, [text]);

  const canSend = !busy && (text.trim().length > 0 || attachments.length > 0);
  useBusy('chat', busy || !!text.trim() || attachments.length > 0 || vm !== 'idle' || speech.listening || speech.state === 'writing');

  const send = () => {
    if (!canSend) return;
    speech.cancel();
    const body = text.trim();
    onSend(replyTo ? `${quoteForReply(replyTo.text)}\n\n${body}` : body, attachments);
    setText('');
    setAttachments([]);
    setError(null);
    onHintDismiss?.();
    onReplyCancel?.();
  };
  const clear = () => { speech.cancel(); setText(''); setError(null); taRef.current?.focus(); };

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

  const shownError = error ?? speech.error;
  const round = 'press flex h-12 w-12 shrink-0 items-center justify-center rounded-full';

  return (
    <div className="shrink-0 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {hint && (
        <div className="mx-1 mb-1.5 flex items-center justify-between gap-2 rounded-[12px] bg-[rgba(var(--pc-accent-rgb),0.1)] px-3 py-2 text-[13px] text-pc-text">
          <span>{hint}</span>
          <button type="button" onClick={onHintDismiss} className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted" aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}
      {replyTo && (
        <div className="mx-1 mb-1.5 flex items-start gap-2 rounded-[12px] border-l-[3px] border-pc-accent bg-pc-surface px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--pc-accent-ink)]">{replyTo.mine ? 'You' : 'Assistant'}</p>
            <p className="line-clamp-2 text-[13px] text-pc-text-muted break-words">{replyTo.text || 'Photo'}</p>
          </div>
          <button type="button" onClick={onReplyCancel} className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted" aria-label="Cancel reply"><X size={14} /></button>
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
      <SpeechStatus speech={speech} />
      {shownError && <p className="mx-3 mb-1 text-[13px] text-red-500" role="alert">{shownError}</p>}

      <input ref={fileRef} type="file" multiple className="hidden" onChange={e => void addFiles(e.target.files)} />
      <div className="flex items-end gap-2">
        {vm !== 'idle' ? (
          <button type="button" onClick={() => void stopVoiceMessage(false)} className={`${round} mb-[6px] text-red-500 active:bg-[var(--pc-hover-strong)]`} aria-label="Discard voice message">
            <Trash2 size={20} />
          </button>
        ) : (
          <div className="relative mb-[6px] shrink-0">
            <button type="button" onClick={() => (voice && canRecord() ? setPlusOpen(o => !o) : fileRef.current?.click())}
              className={`${round} bg-pc-surface text-pc-text-secondary press ${plusOpen ? 'rotate-45' : ''}`}
              aria-label={voice && canRecord() ? 'Add' : 'Attach'} aria-expanded={plusOpen}>
              <Plus size={22} />
            </button>
            {plusOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setPlusOpen(false)} />
                <div className="absolute bottom-12 left-0 z-30 w-56 overflow-hidden rounded-[12px] border border-pc-border bg-pc-elevated shadow-xl" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); fileRef.current?.click(); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-[var(--pc-hover-strong)]">
                    <Paperclip size={19} className="text-[var(--pc-accent-ink)]" /> Photo or file
                  </button>
                  <div className="mx-4 h-px bg-[var(--pc-separator)]" />
                  <button type="button" role="menuitem" onClick={() => void startVoiceMessage()}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-[var(--pc-hover-strong)]">
                    <AudioLines size={19} className="text-[var(--pc-accent-ink)]" />
                    <span>Voice message<span className="block text-[12px] text-pc-text-muted">sent as audio</span></span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {vm !== 'idle' ? (
          <div className="mb-[4px] flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[20px] bg-pc-surface px-4" role="status" aria-live="polite">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="text-[15px] tabular-nums">{vm === 'starting' ? 'Starting…' : `Voice message ${clock(secs)}`}</span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={i} className="w-[3px] rounded-full bg-[rgba(var(--pc-accent-rgb),0.55)]"
                  style={{ height: `${6 + ((i * 7 + secs * 5) % 14)}px`, transition: 'height 300ms' }} />
              ))}
            </span>
            <button type="button" disabled={vm !== 'recording'} onClick={() => void stopVoiceMessage(true)}
              className="press -mr-2.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pc-accent text-[var(--pc-on-accent)] disabled:opacity-50" aria-label="Send voice message">
              <ArrowUp size={19} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className={`flex min-w-0 flex-1 items-end rounded-[20px] border bg-pc-surface pl-4 pr-1.5 transition-colors ${speech.listening ? 'border-[rgba(var(--pc-accent-rgb),0.8)]' : 'border-transparent'}`}>
            <textarea
              ref={taRef}
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !isTouch()) { e.preventDefault(); send(); }
              }}
              readOnly={speech.state === 'writing'}
              placeholder={speechPlaceholder(speech, placeholder)}
              enterKeyHint={isTouch() ? 'enter' : 'send'}
              className="min-h-[56px] min-w-0 flex-1 resize-none border-0 bg-transparent py-[9px] text-[16px] leading-[22px] text-pc-text shadow-none placeholder:text-pc-text-muted outline-none focus:outline-none focus-visible:outline-none"
              aria-label="Message"
            />
            {voice ? <FieldControls speech={speech} hasText={text.length > 0} onClear={clear} />
              : text.length > 0 && (
                <button type="button" onClick={clear} className="mb-[8px] flex h-10 w-10 shrink-0 items-center justify-center" aria-label="Clear">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-pc-text-faint text-pc-surface"><X size={14} strokeWidth={3} /></span>
                </button>
              )}
          </div>
        )}

        {voice && vm === 'idle' ? <div className="shrink-0"><PrimaryButton speech={speech} canSend={canSend} onSend={send} size={56} /></div>
          : !voice && (
            <button type="button" onClick={send} disabled={!canSend} className={`${round} mb-[6px] bg-pc-accent text-[var(--pc-on-accent)] disabled:opacity-40`} aria-label="Send">
              <ArrowUp size={21} strokeWidth={2.5} />
            </button>
          )}
      </div>
    </div>
  );
}
