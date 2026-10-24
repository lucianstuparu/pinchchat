/**
 * A person's card (moved from oc's speed dial, 2026-10-25): shown name, full name, number, the other
 * names the assistant understands, the language and tone to write to them in, and whether their
 * messages are kept here to read and hear.
 */
import { useState } from 'react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Controls';
import { useBusy } from '../ui/draft';
import { LANGS, saveContact, type Contact } from './api';

export function Profile({ contact, onClose, onSaved }: { contact: Partial<Contact>; onClose: () => void; onSaved: (c: Contact) => void }) {
  const [f, setF] = useState({
    label: contact.label ?? '', name: contact.name ?? '', phone: contact.phone ?? '',
    aliases: (contact.aliases ?? []).join(', '), lang: contact.lang ?? 'ro', tone: contact.tone ?? 'informal', listen: !!contact.listen,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBusy('wa-profile', true);
  const field = 'mt-1 h-12 w-full rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 text-[16px] text-pc-text outline-none focus:border-pc-accent';
  const save = async () => {
    setBusy(true); setError(null);
    try {
      onSaved(await saveContact({ id: contact.id, label: f.label.trim() || f.name.trim().split(/\s+/)[0], name: f.name.trim(), phone: f.phone.trim(),
        aliases: f.aliases.split(',').map(a => a.trim()).filter(Boolean), lang: f.lang, tone: f.tone as Contact['tone'], listen: f.listen }));
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
        <label className="block text-[13px] text-pc-text-muted">Other names you call them (comma between)
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
        <label className="flex min-h-12 items-start gap-3 rounded-[12px] bg-pc-surface px-3 py-3">
          <input type="checkbox" checked={f.listen} onChange={e => setF({ ...f, listen: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-[var(--pc-accent)]" />
          <span className="text-[15px]"><b className="font-semibold">Keep their messages here</b>
            <span className="block text-[13px] text-pc-text-muted">You read or hear them here, translated when they write in another language, and get a notification. Nothing ever answers them; only your Send does.</span>
          </span>
        </label>
        {error && <p className="text-[15px] text-red-500" role="alert">{error}</p>}
        <button type="button" disabled={busy || !f.name.trim()} onClick={() => void save()}
          className="press mt-2 flex h-14 w-full items-center justify-center rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  );
}
