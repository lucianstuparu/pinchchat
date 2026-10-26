/**
 * A person's card: their photo (saved from WhatsApp and chosen here; it is hard to find a face by its
 * initial, Lucian 2026-10-26), shown name, full name, how they are reached (WhatsApp, email, SMS, another app),
 * the language and tone to write to them in, whether their WhatsApp messages are kept here, and their
 * agent: conversation samples (pasted text or a WhatsApp "Export chat" file), the style card it learns
 * from them (editable), and what it remembers.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import { Camera, FileText, Trash2, Upload } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Controls';
import { ProgressRow } from '../ui/ProgressRow';
import { useBusy } from '../ui/draft';
import { CHANNELS, LANGS, addSample, agentProfile, deletePhoto, deleteSample, saveContact, savePhoto, saveStyle, squareJpeg, type AgentProfile, type Channel, type Contact } from './api';
import { Face } from './Face';
import { FacePhotos } from './photos';

const field = 'mt-1 h-12 w-full rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 text-[16px] text-pc-text outline-none focus:border-pc-accent';

/** `photo` in onSaved: the new face ({v, data}), null when it was removed, undefined when unchanged; `problem`: the photo did not go. */
export function Profile({ contact, waOwner, onClose, onSaved }: {
  contact: Partial<Contact>; waOwner: boolean; onClose: () => void;
  onSaved: (c: Contact, photo?: { v: number; data: string } | null, problem?: string) => void;
}) {
  const [f, setF] = useState({
    label: contact.label ?? '', name: contact.name ?? '', phone: contact.phone ?? '', email: contact.email ?? '',
    aliases: (contact.aliases ?? []).join(', '), lang: contact.lang ?? 'fr', tone: contact.tone ?? 'formal',
    listen: !!contact.listen, channel: (contact.channel ?? (waOwner ? 'whatsapp' : 'other')) as Channel,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBusy('wa-profile', true);
  // The face: changed here, kept with Save (undefined: as it was; null: removed).
  const kept = useContext(FacePhotos)[contact.id ?? '']?.data ?? null;
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const shown = photo === undefined ? kept : photo;
  const pickRef = useRef<HTMLInputElement>(null);
  const choose = async (file?: File) => {
    if (!file) return;
    try { setPhoto(await squareJpeg(file)); setError(null); }
    catch { setError('Could not read that picture. Try a JPEG or PNG.'); }
  };
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const c = await saveContact({ id: contact.id, label: f.label.trim() || f.name.trim().split(/\s+/)[0], name: f.name.trim(),
        phone: f.channel === 'whatsapp' || f.channel === 'sms' ? f.phone.trim() : undefined, email: f.channel === 'email' ? f.email.trim() : undefined,
        aliases: f.aliases.split(',').map(a => a.trim()).filter(Boolean), lang: f.lang, tone: f.tone as Contact['tone'],
        listen: f.channel === 'whatsapp' && waOwner ? f.listen : undefined, channel: f.channel });
      let face: { v: number; data: string } | null | undefined;
      try {
        if (photo) face = { v: (await savePhoto(c, photo)).v, data: photo };
        else if (photo === null && kept) { await deletePhoto(c); face = null; }
      } catch (e) { onSaved(c, undefined, `Saved, but not the photo (${e instanceof Error ? e.message : 'no connection'}). Add it again in the profile.`); return; }
      onSaved(c, face);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };
  const channels = CHANNELS.filter(([c]) => c !== 'whatsapp' || waOwner || f.channel === 'whatsapp');
  return (
    <Sheet label={contact.id ? `Profile of ${contact.label}` : 'Add a person'} onClose={onClose} className="max-h-[92dvh] overflow-y-auto px-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{contact.id ? contact.label : 'Add a person'}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="space-y-3 pb-4 pt-2">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => pickRef.current?.click()} aria-label={shown ? 'Change the photo' : 'Add a photo'}
            className="press relative shrink-0 rounded-full">
            {shown || f.label.trim() || f.name.trim()
              ? <Face contact={{ id: contact.id ?? 'new', label: f.label.trim() || f.name.trim() || '?' }} size={80} photo={shown} />
              : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-pc-surface text-pc-text-muted"><Camera size={28} /></span>}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--pc-bg-elevated)] bg-pc-accent text-[var(--pc-on-accent)]"><Camera size={15} /></span>
          </button>
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => pickRef.current?.click()} className="press h-10 rounded-full bg-pc-surface px-4 text-[15px] font-medium">
              {shown ? 'Change the photo' : 'Add a photo'}
            </button>
            {shown && <button type="button" onClick={() => setPhoto(null)} className="press ml-2 h-10 rounded-full px-3 text-[15px] text-pc-text-muted">Remove</button>}
            <p className="mt-1 text-[12px] text-pc-text-muted">{photo !== undefined ? 'Kept when you tap Save' : 'WhatsApp: open their profile photo, ⋮ → Save, then choose it here'}</p>
          </div>
          <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <label className="block text-[13px] text-pc-text-muted">Shown as
          <input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} placeholder="Fleur" className={field} />
        </label>
        <label className="block text-[13px] text-pc-text-muted">Full name
          <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Fleur Martin" className={field} />
        </label>
        <div>
          <p className="mb-1 text-[13px] text-pc-text-muted">You write to them on</p>
          <Segmented choice label="Channel" value={f.channel} onChange={c => setF({ ...f, channel: c })} options={channels.map(([value, label]) => ({ value, label }))} />
          {!waOwner && <p className="mt-1 text-[12px] text-pc-text-muted">WhatsApp here is Lucian's; you copy or share your messages.</p>}
        </div>
        {(f.channel === 'whatsapp' || f.channel === 'sms') && (
          <label className="block text-[13px] text-pc-text-muted">{f.channel === 'whatsapp' ? 'WhatsApp number' : 'Phone number'}, with the country code
            <input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="+33 6 …" className={field} />
          </label>
        )}
        {f.channel === 'email' && (
          <label className="block text-[13px] text-pc-text-muted">Email (optional, for you to see)
            <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} inputMode="email" placeholder="fleur@example.fr" className={field} />
          </label>
        )}
        <label className="block text-[13px] text-pc-text-muted">Write to them in
          <select value={f.lang} onChange={e => setF({ ...f, lang: e.target.value })} className={field}>
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div>
          <p className="mb-1 text-[13px] text-pc-text-muted">Tone</p>
          <Segmented choice label="Tone" value={f.tone} onChange={t => setF({ ...f, tone: t })}
            options={[{ value: 'informal', label: 'Informal (tu)' }, { value: 'formal', label: 'Formal (vous, Вы)' }]} />
        </div>
        <label className="block text-[13px] text-pc-text-muted">Other names you call them (comma between)
          <input value={f.aliases} onChange={e => setF({ ...f, aliases: e.target.value })} placeholder="madame Martin, notara" className={field} />
        </label>
        {f.channel === 'whatsapp' && waOwner && (
          <label className="flex min-h-12 items-start gap-3 rounded-[12px] bg-pc-surface px-3 py-3">
            <input type="checkbox" checked={f.listen} onChange={e => setF({ ...f, listen: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-[var(--pc-accent)]" />
            <span className="text-[15px]"><b className="font-semibold">Keep their messages here</b>
              <span className="block text-[13px] text-pc-text-muted">You read or hear their WhatsApp messages here, translated, and get a notification. Nothing ever answers them; only your Send does.</span>
            </span>
          </label>
        )}
        {error && <p className="text-[15px] text-red-500" role="alert">{error}</p>}
        <button type="button" disabled={busy || !f.name.trim()} onClick={() => void save()}
          className="press mt-2 flex h-14 w-full items-center justify-center rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
        {contact.id && <AgentSection contact={contact as Contact} />}
      </div>
    </Sheet>
  );
}

/** Their agent: samples in, the style card out (editable), and what it remembers. */
function AgentSection({ contact }: { contact: Contact }) {
  const [prof, setProf] = useState<AgentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);   // being edited
  const [pasting, setPasting] = useState<string | null>(null);
  const [learning, setLearning] = useState<string | null>(null);   // the sample being learned from
  const fileRef = useRef<HTMLInputElement>(null);
  useBusy('wa-agent', learning !== null || style !== null || pasting !== null);
  useEffect(() => { agentProfile(contact).then(setProf).catch(e => setError(e instanceof Error ? e.message : 'Could not load')); }, [contact]);

  const learnFrom = async (name: string, text: string) => {
    setLearning(name); setError(null);
    try { const r = await addSample(contact, name, text); setProf(p => (p ? { ...p, style: r.style, samples: [...p.samples, { name: r.file, size: text.length, added: r.file.slice(0, 10) }] } : p)); setPasting(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not learn from it'); }
    finally { setLearning(null); }
  };
  const fromFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 600_000) { setError('That file is too big (600 KB at most). Export the chat without media.'); return; }
    await learnFrom(file.name, await file.text());
  };
  const remove = async (name: string) => {
    try { await deleteSample(contact, name); setProf(p => (p ? { ...p, samples: p.samples.filter(s => s.name !== name) } : p)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove it'); }
  };
  const keepStyle = async () => {
    try { await saveStyle(contact, style ?? ''); setProf(p => (p ? { ...p, style: style ?? '' } : p)); setStyle(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); }
  };

  return (
    <section className="mt-6 border-t border-pc-border pt-4">
      <h3 className="text-[17px] font-semibold">{contact.label}'s agent</h3>
      <p className="mt-0.5 text-[13px] text-pc-text-muted">It writes to {contact.label} in their language and in the way you two write, and remembers what matters. Give it conversations to learn from.</p>
      {error && <p className="mt-2 text-[15px] text-red-500" role="alert">{error}</p>}
      {!prof && !error && <p className="py-4 text-[15px] text-pc-text-muted">Loading…</p>}
      {prof && (
        <>
          <p className="mb-1.5 mt-4 text-[13px] font-semibold text-pc-text-muted">Conversation samples</p>
          {prof.samples.length > 0 && (
            <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-surface">
              {prof.samples.map(s => (
                <div key={s.name} className="flex items-center gap-3 px-3 py-2">
                  <FileText size={18} className="shrink-0 text-pc-text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{s.name.slice(11)}<span className="block text-[12px] text-pc-text-muted">{s.added} · {Math.max(1, Math.round(s.size / 1000))} KB</span></span>
                  <button type="button" onClick={() => void remove(s.name)} aria-label={`Remove ${s.name}`} className="press flex h-10 w-10 items-center justify-center rounded-full text-pc-text-muted"><Trash2 size={17} /></button>
                </div>
              ))}
            </div>
          )}
          {learning !== null ? (
            <div className="mt-2"><ProgressRow tile={<FileText size={18} />} name={learning} status="Learning their style…" progress={null} /></div>
          ) : pasting !== null ? (
            <div className="mt-2">
              <textarea value={pasting} onChange={e => setPasting(e.target.value)} rows={6} autoFocus aria-label="Conversation sample"
                placeholder="Paste messages between you, as they are (both sides)."
                className="w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[15px] leading-snug outline-none focus:border-pc-accent" />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setPasting(null)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px]">Cancel</button>
                <button type="button" disabled={!pasting.trim()} onClick={() => void learnFrom('pasted', pasting)} className="press h-12 flex-1 rounded-[12px] bg-pc-accent text-[16px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">Learn from it</button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setPasting('')} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[15px] font-medium">Paste messages</button>
              <button type="button" onClick={() => fileRef.current?.click()} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-[12px] bg-pc-surface text-[15px] font-medium"><Upload size={17} /> Chat export</button>
              <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={e => { void fromFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          )}
          <p className="mt-1.5 text-[12px] text-pc-text-muted">WhatsApp: open the chat, ⋮ → More → Export chat → Without media, then choose the file here.</p>

          <p className="mb-1.5 mt-5 text-[13px] font-semibold text-pc-text-muted">Their style</p>
          {style !== null ? (
            <>
              <textarea value={style} onChange={e => setStyle(e.target.value)} rows={8} aria-label="Style card"
                className="w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[15px] leading-snug outline-none focus:border-pc-accent" />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setStyle(null)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px]">Cancel</button>
                <button type="button" onClick={() => void keepStyle()} className="press h-12 flex-1 rounded-[12px] bg-pc-accent text-[16px] font-semibold text-[var(--pc-on-accent)]">Save</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setStyle(prof.style)} className="block w-full rounded-[12px] bg-pc-surface px-3 py-2.5 text-left">
              <span className="whitespace-pre-wrap text-[15px] leading-snug">{prof.style.trim() || 'Nothing yet. It learns from samples; you can also write it yourself, e.g. "- vouvoie, short, signs Bien à vous".'}</span>
              <span className="mt-1 block text-[12px] font-semibold text-[var(--pc-accent-ink)]">Edit</span>
            </button>
          )}

          <p className="mb-1.5 mt-5 text-[13px] font-semibold text-pc-text-muted">What it remembers</p>
          <p className="whitespace-pre-wrap rounded-[12px] bg-pc-surface px-3 py-2.5 text-[15px] leading-snug text-pc-text-secondary">{prof.memory.trim() || 'Nothing yet. After each message it keeps what will matter later.'}</p>
        </>
      )}
    </section>
  );
}
