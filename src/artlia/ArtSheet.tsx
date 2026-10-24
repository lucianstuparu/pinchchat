/**
 * One Casa Artlia item (ai.manager casa-artlia-app.md): the checklist's sections (Ce cere, Ce de
 * făcut, Dovada, Sursa, Atenție) with glossary terms a tap away, its state (de făcut / de verificat /
 * în așteptare), Done, a question to the assistant, a note, evidence files, edit, put off, not needed.
 * Every change offers Undo (the bar in the footer).
 */
import { useState } from 'react';
import { Ban, Check, Clock, FileText, MessageSquare, Paperclip, Pencil, Undo2 } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Controls';
import { useBusy } from '../ui/draft';
import { useDelayedFlag } from '../ui/progress';
import { DueChip, Title } from '../app/Todo';
import { fileUrl, roError, type ArtAction, type ArtItem, type ArtList, type Phase, type Status } from './api';
import { CatPill } from './Lists';
import { KIND_LABEL, NEED_LABEL, PHASE_LABEL, isOpen, termRuns } from './rules';

type Mode = 'light' | 'dark';

function Rich({ text, glossary }: { text: string; glossary: Record<string, string> }) {
  const [term, setTerm] = useState<string | null>(null);
  return (
    <>
      <p className="whitespace-pre-wrap text-[16px] leading-[22px]">
        {termRuns(text.replace(/\*\*/g, '')).map((r, i) => (r.term && glossary[r.term]
          ? <button key={i} type="button" onClick={() => setTerm(t => (t === r.term ? null : r.term!))}
              className="font-semibold text-[var(--pc-accent-ink)] underline decoration-dotted underline-offset-4" aria-expanded={term === r.term}>{r.text}</button>
          : <span key={i}>{r.text}</span>))}
      </p>
      {term && <p className="mt-1.5 rounded-[8px] bg-[rgba(var(--pc-accent-rgb),0.08)] px-3 py-2 text-[13px] leading-snug"><b>{term}</b>: {glossary[term]}</p>}
    </>
  );
}

const SECTIONS: Array<[keyof ArtItem, string]> = [['what', 'Ce cere'], ['todo', 'Ce de făcut'], ['evidence', 'Dovada'], ['watch', 'Atenție'], ['src', 'Sursa']];

export function ArtSheet({ item, list, mode, footer, onClose, onAct, onAsk, onUpload }: {
  item: ArtItem; list: ArtList; mode: Mode; footer?: React.ReactNode;
  onClose: () => void;
  onAct: (item: ArtItem, action: ArtAction, extra?: Record<string, unknown>) => Promise<void>;
  onAsk: (item: ArtItem) => void;
  onUpload: (item: ArtItem, file: File) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState<{ title: string; due: string; cat: string; phase: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useBusy('art-item', busy || !!note.trim() || !!edit);
  const saving = useDelayedFlag(busy);
  const open = isOpen(item);

  /** True when it worked; on failure the typed text stays where it is. */
  const run = async (action: ArtAction, extra?: Record<string, unknown>): Promise<boolean> => {
    setBusy(true); setError(null);
    try { await onAct(item, action, extra); return true; }
    catch (e) { setError(roError(e)); return false; }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!edit) return;
    // Only what changed: sending the date again would reset the item's reminder and put-off.
    const changes: Record<string, unknown> = {};
    if (edit.title.trim() !== item.title) changes.title = edit.title.trim();
    if (edit.due !== (item.due_date ?? '')) changes.due_date = edit.due || null;
    if (edit.cat !== item.cat) changes.cat = edit.cat;
    if (edit.phase !== (item.phase ?? '')) changes.phase = edit.phase || null;
    if (Object.keys(changes).length === 0 || await run('edit', changes)) setEdit(null);
  };
  const addNote = async () => { const t = note.trim(); if (!t) return; if (await run('note', { text: t })) setNote(''); };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { setError('Fișierul e prea mare (maxim 20 MB)'); return; }
    setBusy(true); setError(null);
    try { await onUpload(item, f); } catch (e) { setError(roError(e)); } finally { setBusy(false); }
  };

  const secondary = 'press flex flex-col items-center justify-center gap-1 rounded-[12px] bg-pc-surface py-3 text-[13px] text-pc-text active:bg-[var(--pc-hover-strong)] disabled:opacity-50';
  const field = 'w-full rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[16px] outline-none focus:border-pc-accent';
  const kind = item.kind ?? 'task';

  return (
    <Sheet label={item.title.replace(/\*\*/g, '')} onClose={onClose} className="max-h-[88dvh] overflow-y-auto px-4 pt-2 md:max-w-lg">
      <div className="flex justify-end"><CloseButton onClick={onClose} label="Închide" /></div>
      <div className="-mt-2 mb-4">
        <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-pc-text-muted">
          <CatPill cat={item.cat} cats={list.categories} mode={mode} />
          <span>{KIND_LABEL[kind]}</span>
          {item.need && <span>· {NEED_LABEL[item.need]}</span>}
          {item.phase && <span>· {PHASE_LABEL[item.phase]}</span>}
        </p>
        {edit ? (
          <div className="space-y-2">
            <textarea value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} rows={2} aria-label="Titlu" className={`${field} resize-none text-[17px]`} />
            <label className="flex items-center justify-between gap-3 rounded-[12px] bg-pc-surface px-3 py-1 text-[15px]">
              <span className="text-pc-text-muted">Termen</span>
              <span className="flex items-center gap-2">
                <input type="date" value={edit.due} onChange={e => setEdit({ ...edit, due: e.target.value })} className="h-10 bg-transparent text-right outline-none" />
                {edit.due && <button type="button" onClick={() => setEdit({ ...edit, due: '' })} className="press h-10 text-[13px] text-[var(--pc-accent-ink)]">Fără dată</button>}
              </span>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-[12px] bg-pc-surface px-3 py-1 text-[15px]">
              <span className="text-pc-text-muted">Categorie</span>
              <select value={edit.cat} onChange={e => setEdit({ ...edit, cat: e.target.value })} className="h-10 bg-transparent text-right outline-none">
                {list.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-[12px] bg-pc-surface px-3 py-1 text-[15px]">
              <span className="text-pc-text-muted">Etapă</span>
              <select value={edit.phase} onChange={e => setEdit({ ...edit, phase: e.target.value })} className="h-10 bg-transparent text-right outline-none">
                <option value="">—</option>
                {(Object.keys(PHASE_LABEL) as Phase[]).map(p => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEdit(null)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px]">Renunță</button>
              <button type="button" disabled={busy || !edit.title.trim()} onClick={() => void save()} className="press h-12 flex-1 rounded-[12px] bg-pc-accent text-[16px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
                {saving ? 'Se salvează…' : 'Salvează'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <Title text={`${item.n != null ? `${item.n} · ` : ''}${item.title}`} className={`block text-[20px] font-semibold leading-snug ${open ? '' : 'text-pc-text-muted line-through'}`} />
            {item.due_date && <span className="mt-2 inline-flex"><DueChip item={item} today={list.today} mode={mode} /></span>}
          </>
        )}
      </div>

      {SECTIONS.map(([k, label]) => {
        const v = item[k];
        return typeof v === 'string' && v.trim() ? (
          <section key={k} className="mb-3">
            <h3 className={`mb-1 text-[12px] font-bold uppercase tracking-[0.06em] ${k === 'watch' ? 'text-[#d48a12]' : 'text-pc-text-secondary'}`}>{label}</h3>
            <Rich text={v} glossary={list.glossary} />
          </section>
        ) : null;
      })}

      {open && (
        <div className="mb-4 mt-2">
          <Segmented<Status> label="Stare" size="s" choice value={item.status === 'todo' || item.status === 'check' || item.status === 'waiting' ? item.status : 'todo'}
            onChange={s => void run('status', { status: s })}
            options={[{ value: 'todo', label: 'De făcut' }, { value: 'check', label: 'De verificat' }, { value: 'waiting', label: 'În așteptare' }]} />
        </div>
      )}

      {error && <p className="mb-2 text-[15px] text-red-500" role="alert">{error}</p>}

      {open ? (
        <>
          <button type="button" disabled={busy} onClick={() => void run('done')}
            className="press flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-60">
            <Check size={19} strokeWidth={2.5} /> {kind === 'decision' ? 'Decis' : kind === 'milestone' ? 'Etapă atinsă' : 'Făcut'}
          </button>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <button type="button" onClick={() => onAsk(item)} className={secondary}><MessageSquare size={19} className="text-pc-accent" /> Întreabă</button>
            <button type="button" disabled={busy} onClick={() => void run('snooze', { days: 3 })} className={secondary}><Clock size={19} className="text-pc-accent" /> Amână 3 zile</button>
            {!edit && <button type="button" onClick={() => setEdit({ title: item.title, due: item.due_date ?? '', cat: item.cat, phase: item.phase ?? '' })} className={secondary}><Pencil size={19} className="text-[var(--pc-accent-ink)]" /> Editează</button>}
            <button type="button" disabled={busy} onClick={() => void run('drop')} className={secondary}><Ban size={19} className="text-pc-text-muted" /> Nu mai e nevoie</button>
          </div>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => void run('reopen')} className="press flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-surface text-[16px] font-semibold disabled:opacity-60">
          <Undo2 size={18} /> Redeschide
        </button>
      )}

      <section className="mt-5">
        <h3 className="mb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-pc-text-secondary">Note</h3>
        {item.notes && <p className="mb-2 whitespace-pre-wrap rounded-[12px] bg-pc-surface px-3 py-2 text-[15px] leading-snug">{item.notes}</p>}
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Scrie o notă: cu cine ai vorbit, ce s-a stabilit" aria-label="Notă nouă" className={`${field} resize-none`} />
        {note.trim() && (
          <button type="button" disabled={busy} onClick={() => void addNote()} className="press mt-2 h-12 w-full rounded-[12px] bg-pc-surface text-[16px] font-semibold text-[var(--pc-accent-ink)] disabled:opacity-50">
            {saving ? 'Se salvează…' : 'Adaugă nota'}
          </button>
        )}
      </section>

      <section className="mt-5 pb-4">
        <h3 className="mb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-pc-text-secondary">Dovezi</h3>
        {(item.files ?? []).map(f => (
          <a key={f.ref} href={fileUrl(f.ref)} target="_blank" rel="noreferrer" className="press flex min-h-10 items-center gap-2 rounded-[12px] px-2 text-[15px]">
            <FileText size={18} className="shrink-0 text-pc-text-muted" /> <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="shrink-0 text-[12px] text-pc-text-muted">{f.at?.slice(0, 10)}</span>
          </a>
        ))}
        <label className="press mt-1 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-pc-surface text-[16px] text-[var(--pc-accent-ink)]">
          <Paperclip size={18} /> {busy ? 'Se încarcă…' : 'Adaugă o dovadă (foto sau PDF)'}
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy} onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </section>

      {footer && <div className="sticky bottom-0 -mx-4 bg-pc-elevated pt-1 pb-[env(safe-area-inset-bottom)]">{footer}</div>}
    </Sheet>
  );
}
