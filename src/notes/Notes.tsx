/**
 * Notes (Lucian 2026-10-29: "capture ideas or notes ... share a link or a screenshot and capture all the
 * details in a way that is not necessarily structured, maybe tagged, but searchable"; "Notes list and
 * guess"): the list newest first with search (words and meaning), tags and, in oc, where each belongs;
 * a note's sheet with the photos full size, the details the assistant read, the tags and where it
 * belongs (guessed, one tap to change). A note being read shows so until it is filled in. Archive with
 * Undo; nothing is deleted. The same screens in oc (English) and Casa Artlia (Romanian, its notes only).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Archive, ExternalLink, Image as ImageIcon, Link2, Mail, Phone, Plus, RotateCw, StickyNote, X } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Controls';
import { L, RO } from '../ui/lang';
import { UndoBar, type UndoInfo } from '../app/UndoBar';
import { DETAIL_KEYS, actNote, fetchNotes, noteFileUrl, searchNotes, type DetailKey, type Note, type NotesBase, type Place } from './api';
import { KeepNote } from './KeepNote';

export const PLACE_LABEL: Record<Place, string> = { home: 'Home', artlia: 'Casa Artlia', private: 'Private' };
const DETAIL_LABEL: Record<DetailKey, string> = { who: 'Who', what: 'What', where: 'Where', when: 'When', price: 'Price', phone: 'Phone', email: 'Email', website: 'Website' };
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const textOf = (n: Note) => fold([n.title, n.summary, ...Object.values(n.details), n.tags.join(' '), n.said, n.link].filter(Boolean).join(' '));
const dateOf = (iso: string) => new Date(iso).toLocaleDateString(RO ? 'ro' : undefined, { day: 'numeric', month: 'short' });
const firstImage = (n: Note) => n.files.find(f => f.mime.startsWith('image/') && f.mime !== 'image/heic');

/** The notes, fetched again every 4 s while one is being read (a reading takes about 10 s). */
export function useNotes(base: NotesBase, refreshKey = 0) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setNotes(await fetchNotes(base)); setError(null); }
    catch (e) { setError(navigator.onLine ? (e instanceof Error ? e.message : 'Could not load the notes') : L('No connection')); }
  }, [base]);
  useEffect(() => { void refresh(); }, [refresh, refreshKey]);
  const reading = notes?.some(n => n.status === 'reading') ?? false;
  useEffect(() => {
    if (!reading) return;
    const t = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(t);
  }, [reading, refresh]);
  return { notes, error, refresh, setNotes };
}

export function NotesView({ base, places, refreshKey, openId, onOpened }: {
  base: NotesBase;
  /** oc: home, Casa Artlia and private notes, with a filter; Casa Artlia: its own only. */
  places: boolean;
  refreshKey?: number;
  /** A note to open (a search hit, a note just kept). */
  openId?: string | null;
  onOpened?: () => void;
}) {
  const { notes, error, refresh, setNotes } = useNotes(base, refreshKey);
  const [q, setQ] = useState('');
  const [place, setPlace] = useState<'all' | Place>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const [meaning, setMeaning] = useState<string[]>([]);
  useEffect(() => { if (openId) { setOpen(openId); onOpened?.(); } }, [openId, onOpened]);

  // By meaning too: the server's search, after a pause in typing.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) { setMeaning([]); return; }
    const t = window.setTimeout(() => { searchNotes(base, query).then(setMeaning).catch(() => setMeaning([])); }, 400);
    return () => window.clearTimeout(t);
  }, [q, base]);

  const tags = useMemo(() => {
    const count = new Map<string, number>();
    for (const n of notes ?? []) for (const t of n.tags) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [notes]);
  const shown = useMemo(() => {
    let list = (notes ?? []).filter(n => (place === 'all' || n.place === place) && (!tag || n.tags.includes(tag)));
    const words = fold(q).split(/\s+/).filter(w => w.length > 1);
    if (words.length) {
      const byWords = list.filter(n => words.every(w => textOf(n).includes(w)));
      const byMeaning = meaning.map(id => list.find(n => n.id === id)).filter((n): n is Note => !!n && !byWords.includes(n));
      list = [...byWords, ...byMeaning];
    }
    return list;
  }, [notes, place, tag, q, meaning]);

  const replace = (n: Note) => setNotes(list => (list ? list.map(x => (x.id === n.id ? n : x)) : list));
  const act = async (n: Note, action: Parameters<typeof actNote>[2], extra: Record<string, unknown> = {}) => {
    const out = await actNote(base, n.id, action, extra);
    if (action === 'archive' || (!places && out.place !== 'artlia')) setNotes(list => list?.filter(x => x.id !== n.id) ?? list);
    else replace(out);
    return out;
  };
  const archive = (n: Note) => {
    setOpen(null);
    void act(n, 'archive').then(() => setUndo({ key: Date.now(), label: L('Archived: {t}', { t: n.title }), undo: () => void actNote(base, n.id, 'unarchive').then(refresh) }));
  };
  const move = (n: Note, to: Place) => {
    const from = n.place;
    void act(n, 'place', { place: to }).then(() => {
      if (!places && to !== 'artlia') setOpen(null);
      setUndo({ key: Date.now(), label: L('Moved to {p}', { p: L(PLACE_LABEL[to]) }), undo: () => void actNote(base, n.id, 'place', { place: from }).then(refresh) });
    });
  };
  const current = notes?.find(n => n.id === open) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 px-1 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-[12px] bg-pc-surface px-3">
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={L('Search the notes')} aria-label={L('Search the notes')} enterKeyHint="search"
              className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none focus:outline-none placeholder:text-pc-text-muted [&::-webkit-search-cancel-button]:hidden" />
            {q && <button type="button" onClick={() => setQ('')} aria-label={L('Clear')} className="press -mr-2 flex h-10 w-10 items-center justify-center text-pc-text-muted"><X size={16} /></button>}
          </div>
          <button type="button" onClick={() => setAdding(true)} aria-label={L('New note')} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-pc-accent text-[var(--pc-on-accent)]">
            <Plus size={22} />
          </button>
        </div>
        {places && (
          <Segmented<'all' | Place> choice size="s" label={L('Where')} value={place} onChange={setPlace}
            options={[{ value: 'all', label: L('All') }, ...(['home', 'artlia', 'private'] as Place[]).map(p => ({ value: p, label: L(PLACE_LABEL[p]) }))]} />
        )}
        {tags.length > 0 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tags.map(t => (
              <button key={t} type="button" onClick={() => setTag(tag === t ? null : t)} aria-pressed={tag === t}
                className={`press h-8 shrink-0 rounded-full px-3 text-[13px] font-medium ${tag === t ? 'bg-pc-accent text-[var(--pc-on-accent)]' : 'bg-pc-surface text-pc-text-secondary'}`}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {error && !notes && <p className="px-3 py-8 text-center text-[15px] text-pc-text-muted">{error}</p>}
        {!notes && !error && <p className="px-3 py-8 text-center text-[15px] text-pc-text-muted">{L('Loading…')}</p>}
        {notes && shown.length === 0 && (
          <p className="px-6 py-10 text-center text-[15px] leading-snug text-pc-text-muted">
            {q || tag || place !== 'all' ? L('No notes match.') : L('Share a screenshot, a link or a text to this app and choose “Keep as a note”. The assistant reads it and fills in the details.')}
          </p>
        )}
        {shown.length > 0 && (
          <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-surface">
            {shown.map(n => <NoteRow key={n.id} n={n} base={base} places={places} onOpen={() => setOpen(n.id)} />)}
          </div>
        )}
      </div>
      {!current && <UndoBar info={undo} onClose={() => setUndo(null)} />}
      {current && <NoteSheet n={current} base={base} onClose={() => setOpen(null)} onArchive={() => archive(current)} onMove={to => move(current, to)}
        onRetry={() => void act(current, 'retry')} footer={<UndoBar info={undo} onClose={() => setUndo(null)} />} />}
      {adding && <KeepNote base={base} onClose={() => setAdding(false)} onKept={n => { setAdding(false); setNotes(list => [n, ...(list ?? [])]); }} />}
    </div>
  );
}

function NoteRow({ n, base, places, onOpen }: { n: Note; base: NotesBase; places: boolean; onOpen: () => void }) {
  const img = firstImage(n);
  const reading = n.status === 'reading';
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-3 py-2.5 text-left active:bg-[var(--pc-hover-strong)]">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-pc-elevated text-pc-text-muted">
        {img ? <img src={noteFileUrl(base, img.ref)} alt="" loading="lazy" className="h-full w-full object-cover" />
          : n.link ? <Link2 size={20} /> : <StickyNote size={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold leading-snug line-clamp-2 ${reading ? 'animate-pulse text-pc-text-muted' : ''}`}>{reading ? L('Reading it…') : n.title}</span>
        {!reading && n.summary && <span className="mt-0.5 block text-[13px] leading-snug text-pc-text-muted line-clamp-2">{n.summary}</span>}
        <span className="mt-1 block truncate text-[12px] text-pc-text-muted">
          {[places && L(PLACE_LABEL[n.place]), dateOf(n.created), n.status === 'failed' && L('could not be read'), ...n.tags.slice(0, 3)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );
}

const hrefOf = (k: DetailKey, v: string) =>
  k === 'website' ? (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`)
    : k === 'phone' ? `tel:${v.replace(/[^\d+]/g, '')}` : k === 'email' ? `mailto:${v}` : null;

function NoteSheet({ n, base, onClose, onArchive, onMove, onRetry, footer }: {
  n: Note; base: NotesBase; onClose: () => void; onArchive: () => void; onMove: (p: Place) => void; onRetry: () => void;
  /** The undo bar, while this sheet is the surface on top. */
  footer: ReactNode;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const details = DETAIL_KEYS.filter(k => n.details[k]);
  return (
    <>
      <Sheet label={n.title} onClose={onClose} className="flex max-h-[92dvh] flex-col px-4 pt-2">
        <div className="flex shrink-0 items-start gap-2">
          <h2 className="min-w-0 flex-1 pt-1.5 text-[19px] font-bold leading-snug">{n.status === 'reading' ? L('Reading it…') : n.title}</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mt-1 text-[13px] text-pc-text-muted">{dateOf(n.created)} · {n.by[0].toUpperCase() + n.by.slice(1)}</p>
          {n.status === 'failed' && (
            <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-amber-500/15 px-3 py-2">
              <p className="min-w-0 flex-1 text-[14px]">{L('The assistant could not read it.')}</p>
              <button type="button" onClick={onRetry} className="press flex h-10 shrink-0 items-center gap-1.5 rounded-[8px] px-3 text-[15px] font-semibold text-[var(--pc-accent-ink)]"><RotateCw size={16} /> {L('Try again')}</button>
            </div>
          )}
          {n.files.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {n.files.map(f => f.mime.startsWith('image/') && f.mime !== 'image/heic' ? (
                <button key={f.ref} type="button" onClick={() => setPhoto(f.ref)} aria-label={L('Photo, full size')} className="press h-40 shrink-0 overflow-hidden rounded-[12px] bg-pc-surface">
                  <img src={noteFileUrl(base, f.ref)} alt="" className="h-full w-auto max-w-[260px] object-cover" />
                </button>
              ) : (
                <a key={f.ref} href={noteFileUrl(base, f.ref)} target="_blank" rel="noreferrer" className="press flex h-40 w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-[12px] bg-pc-surface px-2 text-center text-[13px]">
                  <ImageIcon size={22} /> <span className="line-clamp-3 break-all">{f.name}</span>
                </a>
              ))}
            </div>
          )}
          {n.summary && <p className="mt-3 whitespace-pre-wrap text-[16px] leading-snug">{n.summary}</p>}
          {details.length > 0 && (
            <dl className="mt-3 divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-surface">
              {details.map(k => {
                const v = n.details[k] as string; const href = hrefOf(k, v);
                return (
                  <div key={k} className="flex gap-3 px-3 py-2">
                    <dt className="w-20 shrink-0 pt-0.5 text-[13px] text-pc-text-muted">{L(DETAIL_LABEL[k])}</dt>
                    <dd className="min-w-0 flex-1 select-text whitespace-pre-wrap break-words text-[15px] leading-snug">
                      {href ? <a href={href} target={k === 'website' ? '_blank' : undefined} rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--pc-accent-ink)] underline-offset-2 hover:underline">
                        {k === 'phone' ? <Phone size={14} /> : k === 'email' ? <Mail size={14} /> : <ExternalLink size={14} />}{v}</a> : v}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          {n.link && (
            <a href={n.link} target="_blank" rel="noreferrer" className="press mt-3 flex items-center gap-2 rounded-[12px] bg-pc-surface px-3 py-2.5 text-[15px] text-[var(--pc-accent-ink)]">
              <Link2 size={17} className="shrink-0" /> <span className="min-w-0 flex-1 truncate">{n.link.replace(/^https?:\/\/(www\.)?/, '')}</span>
            </a>
          )}
          {n.said && n.said !== n.summary && (
            <section className="mt-3">
              <h3 className="mb-1 text-[13px] text-pc-text-muted">{L('Written with it')}</h3>
              <p className="select-text whitespace-pre-wrap text-[15px] leading-snug">{n.said}</p>
            </section>
          )}
          {n.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {n.tags.map(t => <span key={t} className="rounded-full bg-pc-surface px-3 py-1 text-[13px] text-pc-text-secondary">{t}</span>)}
            </div>
          )}
          <section className="mt-5">
            <h3 className="mb-1 text-[13px] text-pc-text-muted">{n.place_by === 'guess' ? L('Where it belongs (the assistant’s guess)') : L('Where it belongs')}</h3>
            <Segmented<Place> choice size="s" label={L('Where it belongs')} value={n.place} onChange={onMove}
              options={(['home', 'artlia', 'private'] as Place[]).map(p => ({ value: p, label: L(PLACE_LABEL[p]) }))} />
          </section>
          <button type="button" onClick={onArchive} className="press mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-surface text-[16px] font-medium text-pc-text-secondary">
            <Archive size={18} /> {L('Archive')}
          </button>
        </div>
        {footer}
      </Sheet>
      {photo && (
        <Sheet label={L('Photo')} onClose={() => setPhoto(null)} z={50} className="flex max-h-[96dvh] flex-col px-2 pt-2">
          <div className="flex shrink-0 justify-end"><CloseButton onClick={() => setPhoto(null)} /></div>
          <div className="min-h-0 flex-1 overflow-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <img src={noteFileUrl(base, photo)} alt="" className="mx-auto h-auto max-w-full rounded-[8px]" />
          </div>
        </Sheet>
      )}
    </>
  );
}
