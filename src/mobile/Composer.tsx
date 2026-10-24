import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SpeechStatus } from '../app/SpeechStatus';
import { useBusy, useDraft } from '../ui/draft';
import { ArrowUp, AudioLines, Paperclip, Plus, Trash2, X, type LucideIcon } from 'lucide-react';
import { SILENT, canRecord, record, type Recorder } from '../app/voice';
import { FieldControls, PrimaryButton } from '../app/MicButton';
import { speechPlaceholder, useSpeech } from '../app/speech';
import { AttachmentChip } from './MessageBubble';
import { quoteForReply } from './messageView';
import { encodeAttachment, AttachmentTooLargeError, type OutgoingAttachment } from './attachments';

/**
 * What the next message is (Task, Remind me, Note, a question about an item): a coloured label in
 * the box, not text the person has to read past; its prefix is added when the message is sent.
 */
export interface Intent {
  label: string;
  prefix: string;
  icon: LucideIcon;
  /** Label colours (soft background, ink), already chosen for light or dark. */
  style: CSSProperties;
  placeholder: string;
}

export interface ComposerPrefill {
  /** Changes whenever new content should be injected; used as the remount key */
  nonce: number;
  text: string;
  attachments: OutgoingAttachment[];
  intent?: Intent;
  /** Start a voice message right away (the "Voice message" shortcut on the app icon). */
  voice?: boolean;
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
  const [intent, setIntent] = useState<Intent | null>(prefill?.intent ?? null);
  // A draft that is only a bare "Task:" / "Note:" / "Remind me" is left from before these were
  // labels (2026-10-24): it would sit under the label as text, so it goes.
  useEffect(() => {
    if (/^(Task:|Remind me|Note:|Translate:|Let’s think through:|Buy)$/i.test(text.trim())) setText('');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const speech = useSpeech(text, setText, transcribe ?? noTranscriber);

  // ---- a voice message: audio sent as is (the + menu)
  const [vm, setVm] = useState<'idle' | 'starting' | 'recording' | 'writing'>('idle');
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
    const r = rec.current; rec.current = null;
    const silent = !!r && r.peak() < SILENT;
    const note = await r?.stop();
    if (!keep) { setVm('idle'); return; }
    if (silent) { setVm('idle'); setError(`The microphone recorded only silence${r?.device ? ` (${r.device})` : ''}. With a Bluetooth headset or watch connected, try again with it off.`); return; }
    if (!note) { setVm('idle'); setError('Nothing was recorded'); return; }
    // The bubble shows the words said, so Whisper writes them first; the audio goes along. If
    // Whisper fails, the audio goes alone and the gateway transcribes it for the assistant.
    let said = '';
    if (transcribe) {
      setVm('writing');
      try { said = (await transcribe(note)).trim(); } catch { said = ''; }
    }
    setVm('idle');
    onSend(said ? `Voice message: ${intent ? intent.prefix : ''}${said}` : 'Voice message', [note]);
    setIntent(null);
  };
  useEffect(() => {
    if (vm !== 'recording') return;
    const t = window.setInterval(() => setSecs(n => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [vm]);
  useEffect(() => () => { void rec.current?.stop(); }, []);
  const autoVoice = useRef(!!prefill?.voice);
  useEffect(() => {
    if (!autoVoice.current) return;
    autoVoice.current = false;
    void startVoiceMessage();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when opened from the shortcut
  }, []);

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
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, intent ? 40 : 56), 6 * 22 + 20)}px`;
  }, [text, intent]);

  const canSend = !busy && (text.trim().length > 0 || attachments.length > 0);
  useBusy('chat', busy || !!text.trim() || attachments.length > 0 || vm !== 'idle' || speech.listening || speech.state === 'writing');

  const send = () => {
    if (!canSend) return;
    speech.cancel();
    const body = text.trim();
    const said = intent ? `${intent.prefix}${body}` : body;
    onSend(replyTo ? `${quoteForReply(replyTo.text)}\n\n${said}` : said, attachments);
    setText('');
    setIntent(null);
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
            <p className="text-[12px] font-semibold text-[var(--pc-accent-ink)]">{replyTo.mine ? 'You' : 'Assistant'}</p>
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
      {vm === 'writing' && (
        <div className="mx-2 mb-1.5" role="status" aria-live="polite">
          <p className="text-[13px] text-pc-text-muted">Writing down your voice message…</p>
          <div className="mt-1 h-1 overflow-hidden rounded-[2px] bg-[var(--pc-separator)]" aria-hidden><div className="progress-indeterminate h-full w-1/3 rounded-[2px] bg-pc-accent" /></div>
        </div>
      )}
      {shownError && <p className="mx-3 mb-1 text-[13px] text-red-500" role="alert">{shownError}</p>}

      <input ref={fileRef} type="file" multiple className="hidden" onChange={e => void addFiles(e.target.files)} />
      <div className="flex items-end gap-2">
        {vm !== 'idle' ? (
          <button type="button" disabled={vm === 'writing'} onClick={() => void stopVoiceMessage(false)} className={`${round} mb-[6px] text-red-500 disabled:opacity-40 active:bg-[var(--pc-hover-strong)]`} aria-label="Discard voice message">
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
            <span className="text-[15px] tabular-nums">{vm === 'starting' ? 'Starting…' : vm === 'writing' ? 'Writing it down…' : `Voice message ${clock(secs)}`}</span>
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
            <div className="flex min-w-0 flex-1 flex-col">
            {intent && (
              <button type="button" onClick={() => { setIntent(null); taRef.current?.focus(); }} style={intent.style}
                className="press relative mt-2 inline-flex h-8 items-center gap-1.5 self-start rounded-[8px] pl-2 pr-1.5 text-[13px] font-semibold before:absolute before:-inset-1 before:content-['']"
                aria-label={`${intent.label}, tap to remove`}>
                <intent.icon size={15} aria-hidden /> {intent.label} <X size={14} className="opacity-70" aria-hidden />
              </button>
            )}
            <textarea
              ref={taRef}
              rows={intent ? 1 : 2}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !isTouch()) { e.preventDefault(); send(); }
              }}
              readOnly={speech.state === 'writing'}
              placeholder={speechPlaceholder(speech, intent?.placeholder ?? placeholder)}
              enterKeyHint={isTouch() ? 'enter' : 'send'}
              className={`${intent ? 'min-h-[40px]' : 'min-h-[56px]'} w-full resize-none border-0 bg-transparent py-[9px] text-[16px] leading-[22px] text-pc-text shadow-none placeholder:text-pc-text-muted outline-none focus:outline-none focus-visible:outline-none`}
              aria-label="Message"
            />
            </div>
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
