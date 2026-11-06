/**
 * Keeping someone informed (my.design v2/oc-v2-brief.md §13.5, §14.3, board 40): recipient, a short draft, "shorter", "no date", and
 * one accent button. Nothing leaves without that tap, and for 3 s it can still be taken back; Back returns with nothing sent. No new
 * delivery date is ever asked for. Relay cannot reach them, or it is not the WhatsApp owner: the words are copied instead.
 */
import { useEffect, useRef, useState } from 'react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { useBusy } from '../ui/draft';
import { PersonMark } from './avatars';
import { act, fetchTell, post, type TellDraft, type TellKind } from './api';

const SEND_DELAY = 3;
const chip = 'press inline-flex min-h-10 items-center rounded-full bg-[var(--pc-hover-strong)] px-4 text-[14px] font-semibold disabled:opacity-50';

export function TellSheet({ id, title, kind, name, person, onClose, onDone }: {
  id: string; title: string; kind: TellKind; name: string; person?: string | null;
  onClose: () => void;
  /** After it went out or was copied: the parent offers Undo and refreshes. */
  onDone: (line: string) => void;
}) {
  const [draft, setDraft] = useState<TellDraft | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  useBusy('tell', true);   // an update never reloads over the words being checked

  const load = (opts: { shorter?: boolean; nodate?: boolean } = {}) => {
    setBusy(true); setError(null);
    return fetchTell(id, kind, { ...opts, ...(kind === 'give' ? { to: name } : {}) })
      .then(d => { setDraft(d); setText(d.text); })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not write it'))
      .finally(() => setBusy(false));
  };
  useEffect(() => { void load(); return () => { if (timer.current !== null) window.clearInterval(timer.current); }; }, [id, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const to = draft?.to || name;
  const canSend = !!draft?.contact && draft.contact.channel === 'whatsapp' && draft.contact.phone && person === 'lucian';

  const recorded = async (how: 'sent' | 'copied') => {
    if (kind === 'give') await act(id, 'give', { to: name.toLowerCase() });
    else await act(id, 'promise-tell', { kind, how, to });
  };

  const sendNow = async () => {
    setBusy(true); setError(null);
    try {
      const made = await post<{ draft: { id: string } }>('/reg/wa/draft', { contact: draft!.contact!.id, text: text.trim() });
      await post('/reg/wa/act', { draft: made.draft.id, action: 'send' });
      await recorded('sent');
      onDone(`Told ${to}: ${title}`);
    } catch (e) { setError(e instanceof Error && e.message ? `Not sent · ${e.message}` : 'Not sent'); setBusy(false); }
  };
  const startSend = () => {
    setLeft(SEND_DELAY);
    let n = SEND_DELAY;
    timer.current = window.setInterval(() => {
      n -= 1;
      if (n > 0) { setLeft(n); return; }
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null; setLeft(null);
      void sendNow();
    }, 1000);
  };
  const undoSend = () => { if (timer.current !== null) window.clearInterval(timer.current); timer.current = null; setLeft(null); };

  const copy = async () => {
    setBusy(true); setError(null);
    try {
      await navigator.clipboard.writeText(text.trim());
      await recorded('copied');
      onDone(`Copied, tell ${to}: ${title}`);
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Could not copy'); setBusy(false); }
  };

  return (
    <Sheet label={`Tell ${to}`} onClose={() => { undoSend(); onClose(); }} className="flex max-h-[88dvh] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:max-w-lg">
      <div className="flex items-center gap-3 pb-3">
        <PersonMark name={to} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold">{to}</p>
          <p className="truncate text-[13px] text-pc-text-muted">{title}</p>
        </div>
        <CloseButton onClick={() => { undoSend(); onClose(); }} />
      </div>
      {busy && !draft ? <p className="py-8 text-center text-[15px] text-pc-text-muted">Writing it…</p> : (
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5} disabled={left !== null} aria-label="The message" className="w-full resize-none rounded-[16px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[16px] leading-[22px] outline-none focus:border-pc-accent" />
      )}
      <div className="flex flex-wrap gap-2 py-2">
        <button type="button" disabled={busy || left !== null} onClick={() => void load({ shorter: true })} className={chip}>shorter</button>
        <button type="button" disabled={busy || left !== null} onClick={() => void load({ nodate: true })} className={chip}>no date</button>
      </div>
      {error && <p className="pb-2 text-[13px] text-[var(--pc-accent-ink)]" role="alert">{error}</p>}
      {!canSend && draft && <p className="pb-2 text-[13px] text-pc-text-muted">{to} is not reached from here: copy it and send it yourself.</p>}
      {left !== null ? (
        <button type="button" onClick={undoSend} className="press h-12 w-full rounded-full bg-[var(--pc-hover-strong)] text-[16px] font-bold">Sending in {left} s · Undo</button>
      ) : canSend ? (
        <button type="button" disabled={busy || !text.trim()} onClick={startSend} className="press h-12 w-full rounded-full bg-pc-accent text-[16px] font-bold text-[var(--pc-on-accent)] disabled:opacity-50">Send · {SEND_DELAY} s Undo</button>
      ) : (
        <button type="button" disabled={busy || !text.trim()} onClick={() => void copy()} className="press h-12 w-full rounded-full bg-pc-accent text-[16px] font-bold text-[var(--pc-on-accent)] disabled:opacity-50">Copy it</button>
      )}
    </Sheet>
  );
}
