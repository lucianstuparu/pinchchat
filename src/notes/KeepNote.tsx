/**
 * Keep as a note: what was shared to the app (screenshots, a link, text), or a new note from the Notes
 * list (a line, a link, photos). A line can be added, typed or said (the mic writes, never sends).
 * Keep saves it at once; the assistant reads it in the background and guesses where it belongs.
 * From a share, "Send in the chat instead" puts it in the chat's input bar as before.
 */
import { useMemo, useRef, useState } from 'react';
import { Camera, Link2, MessageSquare, StickyNote, X } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { L } from '../ui/lang';
import { useBusy } from '../ui/draft';
import { FieldControls, MicButton } from '../app/MicButton';
import { SpeechStatus } from '../app/SpeechStatus';
import { speechPlaceholder, useSpeech } from '../app/speech';
import { transcribeAudio } from '../app/api';
import { encodeAttachment, type OutgoingAttachment } from '../mobile/attachments';
import { addNote, splitLink, type Note, type NotesBase } from './api';

export function KeepNote({ base, shared, onKept, onChat, onClose }: {
  base: NotesBase;
  shared?: { text: string; attachments: OutgoingAttachment[] };
  onKept: (n: Note) => void;
  onChat?: () => void;
  onClose: () => void;
}) {
  const first = useMemo(() => splitLink(shared?.text ?? ''), [shared]);
  const [link, setLink] = useState(first.link);
  const [text, setText] = useState(first.rest);
  const [files, setFiles] = useState<OutgoingAttachment[]>(() => (shared?.attachments ?? []).filter(a => /^image\/|^application\/pdf$/.test(a.mimeType)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const speech = useSpeech(text, setText, a => transcribeAudio(a));
  useBusy('keep-note', true);
  const canKeep = !!(text.trim() || link.trim() || files.length);

  const pick = async (list: FileList | null) => {
    for (const f of Array.from(list ?? []).slice(0, 6 - files.length)) {
      try { const a = await encodeAttachment(f, f.name); setFiles(x => [...x, a]); }
      catch { setError(L('Could not add {n}', { n: f.name })); }
    }
  };
  const keep = async () => {
    if (!canKeep || busy) return;
    speech.cancel();
    setBusy(true); setError(null);
    // A link typed into the line counts as the link.
    const typed = link.trim() ? { link: link.trim(), rest: text.trim() } : splitLink(text);
    try { onKept(await addNote(base, { said: typed.rest, link: typed.link, files })); }
    catch (e) { setError(navigator.onLine ? (e instanceof Error ? e.message : L('Could not keep it')) : L('No connection')); }
    finally { setBusy(false); }
  };

  return (
    <Sheet label={L('Keep as a note')} onClose={onClose} className="flex max-h-[92dvh] flex-col px-4 pt-2">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-[17px] font-semibold">{shared ? L('Keep as a note') : L('New note')}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        <p className="mb-2 text-[13px] leading-snug text-pc-text-muted">{L('The assistant reads it, writes down the details and tags, and guesses where it belongs. You can change it after.')}</p>
        {files.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {files.map((f, i) => (
              <div key={i} className="relative h-28 shrink-0 overflow-hidden rounded-[12px] bg-pc-surface">
                {f.mimeType.startsWith('image/') ? <img src={`data:${f.mimeType};base64,${f.content}`} alt="" className="h-full w-auto max-w-[200px] object-cover" />
                  : <span className="flex h-full w-28 items-center justify-center px-2 text-center text-[12px]">{f.fileName}</span>}
                <button type="button" onClick={() => setFiles(x => x.filter((_, j) => j !== i))} aria-label={L('Remove {n}', { n: f.fileName })}
                  className="press absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"><X size={16} /></button>
              </div>
            ))}
          </div>
        )}
        {(link || !shared) && (
          <label className="mb-3 flex h-12 items-center gap-2 rounded-[12px] bg-pc-surface px-3">
            <Link2 size={17} className="shrink-0 text-pc-text-muted" />
            <input type="url" inputMode="url" value={link} onChange={e => setLink(e.target.value)} placeholder={L('Link (optional)')} aria-label={L('Link')}
              className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none focus:outline-none placeholder:text-pc-text-muted" />
          </label>
        )}
        <div className={`flex items-end rounded-[12px] border bg-pc-surface pl-3 pr-1 ${speech.listening ? 'border-[rgba(var(--pc-accent-rgb),0.8)]' : 'border-transparent'}`}>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} readOnly={speech.state === 'writing'} aria-label={L('A line with it')}
            placeholder={speechPlaceholder(speech, shared ? L('A line with it (optional): “for the Artlia kitchen?”') : L('What to keep'))}
            className="min-h-[96px] min-w-0 flex-1 resize-none border-0 bg-transparent py-2.5 text-[16px] leading-snug shadow-none outline-none focus:outline-none placeholder:text-pc-text-muted" />
          {text.trim() ? <FieldControls speech={speech} hasText onClear={() => { speech.cancel(); setText(''); }} />
            : speech.available && <div className="self-end pb-1"><MicButton speech={speech} size={40} /></div>}
        </div>
        <SpeechStatus speech={speech} />
        {speech.error && <p className="mt-1 text-[13px] text-red-500" role="alert">{speech.error}</p>}
        {files.length < 6 && (
          <button type="button" onClick={() => picker.current?.click()} className="press mt-3 flex h-11 items-center gap-2 rounded-[12px] px-2 text-[15px] font-medium text-[var(--pc-accent-ink)]">
            <Camera size={19} /> {L('Add a photo or screenshot')}
          </button>
        )}
        <input ref={picker} type="file" accept="image/*,application/pdf" multiple hidden onChange={e => { void pick(e.target.files); e.target.value = ''; }} />
        {error && <p className="mt-2 text-[15px] text-red-500" role="alert">{error}</p>}
      </div>
      <div className="shrink-0 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={() => void keep()} disabled={!canKeep || busy}
          className="press flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
          <StickyNote size={19} /> {busy ? L('Keeping…') : L('Keep as a note')}
        </button>
        {onChat && (
          <button type="button" onClick={onChat} className="press flex h-12 w-full items-center justify-center gap-2 rounded-[12px] text-[16px] font-medium text-pc-text-secondary">
            <MessageSquare size={18} /> {L('Send in the chat instead')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
