/**
 * A WhatsApp message the assistant prepared (ai.manager whatsapp-send.md): to whom, the text (and a
 * Romanian line when it was translated), and Trimite. Nothing goes out without this tap: the server
 * sends the draft from the person's own WhatsApp, to the number on their contact list.
 */
import { useEffect, useState } from 'react';
import { Check, Pencil, Send, X } from 'lucide-react';
import { post } from './api';
import { useBusy } from '../ui/draft';
import { L } from '../ui/lang';

export interface WaDraft { name: string; text: string; back?: string; lang?: string; status: 'draft' | 'sent' | 'cancelled' | 'failed' | 'expired'; sent_at?: string; error?: string }

const fetchDrafts = (ids: string[]) => post<{ drafts: Record<string, WaDraft> }>('/reg/wa/status', { ids });
const actOnDraft = (draft: string, action: 'send' | 'cancel' | 'edit', text?: string) =>
  post<{ ok: boolean; draft: WaDraft }>('/reg/wa/act', { draft, action, ...(text !== undefined ? { text } : {}) });

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');

export function WaCards({ ids }: { ids: string[] }) {
  const [drafts, setDrafts] = useState<Record<string, WaDraft>>({});
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    fetchDrafts(key.split(',')).then(r => { if (alive) setDrafts(r.drafts); }).catch(() => { /* the card says it cannot load */ });
    return () => { alive = false; };
  }, [key]);
  return <div className="mt-1.5 space-y-2">{ids.map(id => <WaCard key={id} id={id} draft={drafts[id]} onChange={d => setDrafts(s => ({ ...s, [id]: d }))} />)}</div>;
}

function WaCard({ id, draft, onChange }: { id: string; draft?: WaDraft; onChange: (d: WaDraft) => void }) {
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useBusy(`wa-${id}`, edit !== null || busy);

  if (!draft) return <div className="rounded-[12px] border border-pc-border bg-pc-elevated px-3 py-2.5 text-[13px] text-pc-text-muted">WhatsApp…</div>;
  const run = async (action: 'send' | 'cancel' | 'edit', text?: string) => {
    setBusy(true); setError(null);
    try { const r = await actOnDraft(id, action, text); onChange(r.draft); if (action === 'edit') setEdit(null); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : L('Could not send it')); }
    finally { setBusy(false); }
  };
  const open = draft.status === 'draft' || draft.status === 'failed';

  return (
    <div className="rounded-[12px] border border-pc-border bg-pc-elevated px-3 pb-3 pt-2.5">
      <p className="text-[13px] text-pc-text-muted">WhatsApp · {L('to')} <b className="font-semibold text-pc-text">{draft.name}</b>{draft.lang && draft.lang !== 'ro' ? ` · ${draft.lang.toUpperCase()}` : ''}</p>
      {edit !== null ? (
        <textarea value={edit} onChange={e => setEdit(e.target.value)} rows={3} aria-label={L('Message text')} autoFocus
          className="mt-1.5 w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[16px] leading-[22px] outline-none focus:border-pc-accent" />
      ) : (
        <p className={`mt-1 whitespace-pre-wrap text-[16px] leading-[22px] ${draft.status === 'cancelled' || draft.status === 'expired' ? 'text-pc-text-muted line-through' : ''}`}>{draft.text}</p>
      )}
      {draft.back && edit === null && <p className="mt-1 text-[13px] italic text-pc-text-muted">„{draft.back}”</p>}
      {(error || draft.status === 'failed') && <p className="mt-1.5 text-[13px] text-red-500" role="alert">{L('Not sent')}{draft.error || error ? ` · ${error ?? draft.error}` : ''}</p>}

      {draft.status === 'sent' && <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-[#1d9e75]"><Check size={15} strokeWidth={3} /> {L('Sent {t}', { t: time(draft.sent_at) })}</p>}
      {draft.status === 'cancelled' && <p className="mt-2 text-[13px] text-pc-text-muted">{L('Not sent')}</p>}
      {draft.status === 'expired' && <p className="mt-2 text-[13px] text-pc-text-muted">{L('Expired · ask again')}</p>}

      {open && (edit !== null ? (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setEdit(null)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px]">{L('Cancel')}</button>
          <button type="button" disabled={busy || !edit.trim()} onClick={() => void run('edit', edit.trim())}
            className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px] font-semibold text-[var(--pc-accent-ink)] disabled:opacity-50">{L('Done')}</button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void run('send')}
            className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#1d9e75] text-[16px] font-semibold text-white disabled:opacity-60">
            <Send size={17} /> {busy ? L('Sending…') : draft.status === 'failed' ? L('Retry') : L('Send')}
          </button>
          <button type="button" disabled={busy} onClick={() => setEdit(draft.text)} className="press flex h-12 w-12 items-center justify-center rounded-[12px] bg-pc-surface" aria-label={L('Edit the text')}><Pencil size={18} /></button>
          <button type="button" disabled={busy} onClick={() => void run('cancel')} className="press flex h-12 w-12 items-center justify-center rounded-[12px] bg-pc-surface text-pc-text-muted" aria-label={L('Do not send')}><X size={18} /></button>
        </div>
      ))}
    </div>
  );
}
