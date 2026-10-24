/**
 * WhatsApp speed dial (ai.manager whatsapp-send.md): the people the person writes to, as big tiles,
 * most recently written first. A tap starts a message to that person (a label in the box: say or type
 * what to tell them, the assistant prepares the card, Send sends). Each person has a profile: the
 * name shown, the full name, the number, nicknames the assistant understands, language and tone.
 */
import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { post } from './api';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Controls';
import { useBusy } from '../ui/draft';

export interface Contact { id: string; name: string; label: string; aliases: string[]; phone: string; lang: string; tone: 'informal' | 'formal'; last_sent?: string; sent: number }

const fetchContacts = () => post<{ contacts: Contact[] }>('/reg/wa/contacts', {}).then(r => r.contacts);
const saveContact = (c: Partial<Contact>) => post<{ ok: boolean; contact: Contact }>('/reg/wa/contact', c).then(r => r.contact);

const LANGS: Array<[string, string]> = [['ro', 'Romanian'], ['fr', 'French'], ['en', 'English'], ['ru', 'Russian'], ['de', 'German'], ['it', 'Italian'], ['es', 'Spanish']];
const TILE = ['#c2593a', '#1d9e75', '#378add', '#7c5cd6', '#ba7517', '#c2477f', '#0e9488', '#5b6b85'];

export function SpeedDial({ onPick, onClose }: { onPick: (c: Contact) => void; onClose: () => void }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Partial<Contact> | null>(null);
  useEffect(() => { fetchContacts().then(setContacts).catch(e => setError(e instanceof Error ? e.message : 'Could not load the contacts')); }, []);

  if (profile) return <Profile contact={profile} onClose={() => setProfile(null)} onSaved={c => { setContacts(list => [...(list ?? []).filter(x => x.id !== c.id), c]); setProfile(null); }} />;

  return (
    <Sheet label="WhatsApp" onClose={onClose} className="px-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Write on WhatsApp</h2>
        <CloseButton onClick={onClose} />
      </div>
      <p className="mb-4 text-[13px] text-pc-text-muted">Pick a person, then say or type what to tell them. You check the message before it goes.</p>
      {error && <p className="mb-3 text-[15px] text-red-500" role="alert">{error}</p>}
      {!contacts && !error && <p className="py-8 text-center text-[15px] text-pc-text-muted">Loading…</p>}
      <div className="grid grid-cols-3 gap-3 pb-4">
        {contacts?.map((c, i) => (
          <div key={c.id} className="relative">
            <button type="button" onClick={() => (c.phone ? onPick(c) : setProfile(c))}
              className="press flex w-full flex-col items-center gap-1.5 rounded-[12px] px-1 pb-2 pt-3 active:bg-[var(--pc-hover-strong)]">
              <span className="flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-bold text-white" style={{ background: TILE[i % TILE.length] }} aria-hidden>{c.label[0]?.toUpperCase()}</span>
              <span className="max-w-full truncate text-[15px] font-medium">{c.label}</span>
              <span className="text-[12px] text-pc-text-muted">{c.phone ? (LANGS.find(l => l[0] === c.lang)?.[1] ?? c.lang) : 'No number yet'}</span>
            </button>
            <button type="button" onClick={() => setProfile(c)} aria-label={`Profile of ${c.label}`}
              className="press absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full text-pc-text-faint">
              <Pencil size={15} />
            </button>
          </div>
        ))}
        {contacts && (
          <button type="button" onClick={() => setProfile({ lang: 'ro', tone: 'informal', aliases: [] })}
            className="press flex flex-col items-center gap-1.5 rounded-[12px] px-1 pb-2 pt-3 text-pc-text-muted active:bg-[var(--pc-hover-strong)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-pc-border-strong"><Plus size={22} /></span>
            <span className="text-[15px]">Add a person</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Profile({ contact, onClose, onSaved }: { contact: Partial<Contact>; onClose: () => void; onSaved: (c: Contact) => void }) {
  const [f, setF] = useState({
    label: contact.label ?? '', name: contact.name ?? '', phone: contact.phone ?? '',
    aliases: (contact.aliases ?? []).join(', '), lang: contact.lang ?? 'ro', tone: contact.tone ?? 'informal',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBusy('wa-profile', true);
  const field = 'mt-1 h-12 w-full rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 text-[16px] outline-none focus:border-pc-accent';
  const save = async () => {
    setBusy(true); setError(null);
    try {
      onSaved(await saveContact({ id: contact.id, label: f.label.trim() || f.name.trim().split(/\s+/)[0], name: f.name.trim(), phone: f.phone.trim(),
        aliases: f.aliases.split(',').map(a => a.trim()).filter(Boolean), lang: f.lang, tone: f.tone as Contact['tone'] }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };
  return (
    <Sheet label={contact.id ? `Profile of ${contact.label}` : 'Add a person'} onClose={onClose} className="max-h-[90dvh] overflow-y-auto px-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{contact.id ? contact.label : 'Add a person'}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="space-y-3 pb-4 pt-2">
        <label className="block text-[13px] text-pc-text-muted">Shown as
          <input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} placeholder="Bunica" className={field} />
        </label>
        <label className="block text-[13px] text-pc-text-muted">Full name
          <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Eugenia Gamurari" className={field} />
        </label>
        <label className="block text-[13px] text-pc-text-muted">WhatsApp number, with the country code
          <input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="+33 6 …" className={field} />
        </label>
        <label className="block text-[13px] text-pc-text-muted">Other names the assistant should understand (comma between)
          <input value={f.aliases} onChange={e => setF({ ...f, aliases: e.target.value })} placeholder="bunica, bunicii, buni" className={field} />
        </label>
        <label className="block text-[13px] text-pc-text-muted">Write to them in
          <select value={f.lang} onChange={e => setF({ ...f, lang: e.target.value })} className={field}>
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div>
          <p className="mb-1 text-[13px] text-pc-text-muted">Tone</p>
          <Segmented choice label="Tone" value={f.tone} onChange={t => setF({ ...f, tone: t })}
            options={[{ value: 'informal', label: 'Informal (tu)' }, { value: 'formal', label: 'Formal (dvs., vous)' }]} />
        </div>
        {error && <p className="text-[15px] text-red-500" role="alert">{error}</p>}
        <button type="button" disabled={busy || !f.name.trim()} onClick={() => void save()}
          className="press mt-2 flex h-14 w-full items-center justify-center rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  );
}
