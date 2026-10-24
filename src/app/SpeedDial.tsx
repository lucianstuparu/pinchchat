/**
 * WhatsApp speed dial (ai.manager whatsapp-send.md): the people the person writes to, as big tiles,
 * most recently written first, with how many new messages each has sent. A tile opens the
 * conversation: the latest messages both ways, **Read aloud** (the phone's own voice, in their
 * language) and **Reply by voice** (the box gets "WhatsApp · Bunica" and the mic starts; the assistant
 * prepares the card, Send sends). Built for using it while out: big targets, two taps to answer.
 * Each person has a profile: name shown, full name, number, nicknames, language, tone, and whether
 * their messages are kept to be read back ("Read me their messages").
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Mic, Pencil, Plus, Square, Volume2 } from 'lucide-react';
import { post } from './api';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Controls';
import { useBusy } from '../ui/draft';
import { canSpeak, speak } from '../ui/speak';

export interface Contact {
  id: string; name: string; label: string; aliases: string[]; phone: string; lang: string; tone: 'informal' | 'formal';
  last_sent?: string; sent: number; listen?: boolean; unread?: number; last_in?: { text: string; ts: string };
}
interface WaMessage { id: string; from: 'them' | 'me'; text: string; transcript?: string; ts: string }

const fetchContacts = () => post<{ contacts: Contact[] }>('/reg/wa/contacts', {}).then(r => r.contacts);
const saveContact = (c: Partial<Contact>) => post<{ ok: boolean; contact: Contact }>('/reg/wa/contact', c).then(r => r.contact);
const fetchConversation = (contact: string) => post<{ messages: WaMessage[] }>('/reg/wa/inbox', { contact, limit: 20 }).then(r => r.messages);

const LANGS: Array<[string, string]> = [['ro', 'Romanian'], ['fr', 'French'], ['en', 'English'], ['ru', 'Russian'], ['de', 'German'], ['it', 'Italian'], ['es', 'Spanish']];
const TILE = ['#c2593a', '#1d9e75', '#378add', '#7c5cd6', '#ba7517', '#c2477f', '#0e9488', '#5b6b85'];
const when = (iso: string) => {
  const d = new Date(iso), now = new Date();
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export function SpeedDial({ onPick, onClose, openId }: { onPick: (c: Contact, dictate: boolean) => void; onClose: () => void; openId?: string | null }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Partial<Contact> | null>(null);
  const [open, setOpen] = useState<string | null>(openId ?? null);
  useEffect(() => { fetchContacts().then(setContacts).catch(e => setError(e instanceof Error ? e.message : 'Could not load the contacts')); }, []);

  const person = contacts?.find(c => c.id === open);
  if (profile) return <Profile contact={profile} onClose={() => setProfile(null)} onSaved={c => { setContacts(list => [...(list ?? []).filter(x => x.id !== c.id), c]); setProfile(null); }} />;
  if (person) return <Conversation contact={person} onBack={() => setOpen(null)} onClose={onClose} onReply={d => onPick(person, d)} onProfile={() => setProfile(person)} />;

  return (
    <Sheet label="WhatsApp" onClose={onClose} className="px-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">WhatsApp</h2>
        <CloseButton onClick={onClose} />
      </div>
      <p className="mb-4 text-[13px] text-pc-text-muted">Pick a person. You hear or read what they wrote, and answer by voice; you check the message before it goes.</p>
      {error && <p className="mb-3 text-[15px] text-red-500" role="alert">{error}</p>}
      {!contacts && !error && <p className="py-8 text-center text-[15px] text-pc-text-muted">Loading…</p>}
      <div className="grid grid-cols-3 gap-3 pb-4">
        {contacts?.map((c, i) => (
          <div key={c.id} className="relative">
            <button type="button" onClick={() => (c.phone ? setOpen(c.id) : setProfile(c))}
              className="press flex w-full flex-col items-center gap-1.5 rounded-[12px] px-1 pb-2 pt-3 active:bg-[var(--pc-hover-strong)]">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-bold text-white" style={{ background: TILE[i % TILE.length] }} aria-hidden>
                {c.label[0]?.toUpperCase()}
                {!!c.unread && <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#dc4c4c] px-1.5 text-[13px] font-bold ring-2 ring-[var(--pc-bg-elevated)]">{c.unread}</span>}
              </span>
              <span className="max-w-full truncate text-[15px] font-medium">{c.label}</span>
              <span className={`line-clamp-1 max-w-full text-[12px] ${c.unread ? 'font-semibold text-pc-text' : 'text-pc-text-muted'}`}>
                {!c.phone ? 'No number yet' : c.last_in ? c.last_in.text : (LANGS.find(l => l[0] === c.lang)?.[1] ?? c.lang)}
              </span>
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

function Conversation({ contact, onBack, onClose, onReply, onProfile }: {
  contact: Contact; onBack: () => void; onClose: () => void; onReply: (dictate: boolean) => void; onProfile: () => void;
}) {
  const [msgs, setMsgs] = useState<WaMessage[] | null>(contact.listen ? null : []);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!contact.listen) return;
    fetchConversation(contact.id).then(setMsgs).catch(e => setError(e instanceof Error ? e.message : 'Could not load the messages'));
  }, [contact.id, contact.listen]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);
  useEffect(() => () => stop.current?.(), []);

  // What is read: their messages since my last one (or their last three), oldest first.
  const toRead = () => {
    const list = msgs ?? [];
    const lastMine = list.map(m => m.from).lastIndexOf('me');
    const theirs = list.slice(lastMine + 1).filter(m => m.from === 'them');
    return (theirs.length ? theirs : list.filter(m => m.from === 'them').slice(-3)).map(m => m.transcript || m.text);
  };
  const readAloud = () => {
    if (speaking) { stop.current?.(); return; }
    const texts = toRead();
    if (!texts.length) return;
    setSpeaking(true);
    stop.current = speak([`${contact.label} a scris:`, ...texts], contact.lang, () => setSpeaking(false));
  };

  return (
    <Sheet label={`WhatsApp · ${contact.label}`} onClose={onClose} className="flex max-h-[92dvh] flex-col px-4 pt-2">
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onBack} className="press -ml-2 flex h-10 items-center pr-2 text-[16px] text-[var(--pc-accent-ink)]"><ChevronLeft size={22} /> All</button>
        <h2 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold">{contact.label}</h2>
        <button type="button" onClick={onProfile} aria-label={`Profile of ${contact.label}`} className="press flex h-10 w-10 items-center justify-center rounded-full text-pc-text-muted"><Pencil size={17} /></button>
        <CloseButton onClick={onClose} />
      </div>
      <div className="min-h-[120px] flex-1 space-y-2 overflow-y-auto overscroll-contain py-3">
        {!contact.listen && (
          <p className="rounded-[12px] bg-pc-surface px-3 py-3 text-[15px] text-pc-text-secondary">
            Their messages are not kept yet. Turn on <b>Read me their messages</b> in the profile to hear them here.
          </p>
        )}
        {error && <p className="text-[15px] text-red-500" role="alert">{error}</p>}
        {contact.listen && msgs?.length === 0 && <p className="py-6 text-center text-[15px] text-pc-text-muted">No messages yet. New ones appear here and as a notification.</p>}
        {msgs?.map(m => (
          <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[20px] px-3 py-2 text-[17px] leading-snug ${m.from === 'me' ? 'rounded-tr-md bg-[rgba(var(--pc-accent-rgb),0.16)]' : 'rounded-tl-md bg-pc-surface'}`}>
              <p className="whitespace-pre-wrap">{m.transcript || m.text}</p>
              <p className="mt-0.5 text-right text-[12px] text-pc-text-muted">{when(m.ts)}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={readAloud} disabled={!canSpeak() || !msgs?.some(m => m.from === 'them')}
          className="press flex h-16 items-center justify-center gap-2 rounded-[12px] bg-pc-surface text-[17px] font-semibold disabled:opacity-40">
          {speaking ? <><Square size={20} /> Stop</> : <><Volume2 size={22} /> Read aloud</>}
        </button>
        <button type="button" onClick={() => { stop.current?.(); onReply(true); }}
          className="press flex h-16 items-center justify-center gap-2 rounded-[12px] bg-[#1d9e75] text-[17px] font-semibold text-white">
          <Mic size={22} /> Reply by voice
        </button>
      </div>
    </Sheet>
  );
}

function Profile({ contact, onClose, onSaved }: { contact: Partial<Contact>; onClose: () => void; onSaved: (c: Contact) => void }) {
  const [f, setF] = useState({
    label: contact.label ?? '', name: contact.name ?? '', phone: contact.phone ?? '',
    aliases: (contact.aliases ?? []).join(', '), lang: contact.lang ?? 'ro', tone: contact.tone ?? 'informal', listen: !!contact.listen,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBusy('wa-profile', true);
  const field = 'mt-1 h-12 w-full rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 text-[16px] outline-none focus:border-pc-accent';
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
        <label className="flex min-h-12 items-start gap-3 rounded-[12px] bg-pc-surface px-3 py-3">
          <input type="checkbox" checked={f.listen} onChange={e => setF({ ...f, listen: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-[#1d9e75]" />
          <span className="text-[15px]"><b className="font-semibold">Read me their messages</b>
            <span className="block text-[13px] text-pc-text-muted">Their WhatsApp messages are kept here and you get a notification. The assistant never answers them; only your Send does.</span>
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
