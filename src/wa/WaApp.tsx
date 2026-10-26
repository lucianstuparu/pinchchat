/**
 * Relay, the WhatsApp app (Lucian 2026-10-25: "take it out in a separate app ... designed like a dialer
 * proxy for WhatsApp which allows me to easily communicate voice to multi language with selected
 * people"). Its own scope, out of oc: the people you write to as faces, like a phone's favourites;
 * one person's line; you speak in any language, it writes the message in theirs, Send (with Undo).
 * Their messages arrive translated and can be heard. Built on oc's parts (input bar, sheet, the
 * same contacts and drafts on CT 103), with its own look: the call green, dark text on it.
 * No gateway login: register-api knows the person from Cloudflare Access.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Languages, Plus, Volume2 } from 'lucide-react';
import { getLook, lookVars, setLook, useMode, useThemeChrome, type Look } from '../app/themes';
import { SessionExpired, whoami } from '../app/api';
import { getDictationLang, getSpeechMode, setDictationLang, setSpeechMode, DICTATION_LANGS, type SpeechMode } from '../app/voice';
import { AppHeader, Segmented } from '../ui/Controls';
import { CloseButton, Sheet } from '../ui/Sheet';
import { useBackLayer, useExactSizes } from '../ui/useBackLayer';
import { useDelayedFlag } from '../ui/progress';
import { useLift } from '../ui/dragOrder';
import { Face } from './Face';
import { Line } from './Line';
import { Profile } from './Profile';
import { Translate } from './Translate';
import { channelName, fetchContacts, langName, timeOf, type Contact } from './api';

const CACHE = 'wa:contacts';
const OWNER = 'wa:owner';
const LANG_OK: Record<string, true> = { ro: true, fr: true, en: true, ru: true, uk: true, de: true, it: true, es: true };
const cached = (): Contact[] | null => { try { const s = localStorage.getItem(CACHE); return s ? (JSON.parse(s) as Contact[]) : null; } catch { return null; } };

export default function WaApp() {
  const [look, setLookState] = useState<Look>(() => ({ ...getLook(), accent: 'signal' }));
  useExactSizes();
  const mode = useMode(look.appearance);
  useThemeChrome(mode);
  const chooseLook = (l: Look) => { setLook({ ...getLook(), appearance: l.appearance }); setLookState({ ...l, accent: 'signal' }); };
  return (
    <div style={lookVars(mode, 'signal')} className="h-dvh bg-pc-base text-pc-text antialiased">
      <Relay look={look} onLook={chooseLook} />
    </div>
  );
}

function Relay({ look, onLook }: { look: Look; onLook: (l: Look) => void }) {
  const [person, setPerson] = useState<string | null>(null);
  useEffect(() => { void whoami().then(setPerson); }, []);
  const [contacts, setContacts] = useState<Contact[] | null>(cached);
  // Whether this person's WhatsApp is the one linked (Lucian's): the others copy and share their messages.
  const [waOwner, setWaOwner] = useState(() => { try { return localStorage.getItem(OWNER) !== 'no'; } catch { return true; } });
  const [state, setState] = useState<'ok' | 'offline' | 'expired'>('ok');
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { contacts: c, wa } = await fetchContacts();
      setContacts(c); setWaOwner(wa); setState('ok');
      try { localStorage.setItem(CACHE, JSON.stringify(c)); localStorage.setItem(OWNER, wa ? 'yes' : 'no'); } catch { /* not kept */ }
    } catch (e) { setState(e instanceof SessionExpired && navigator.onLine ? 'expired' : 'offline'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(t); };
  }, [refresh]);
  const spinning = useDelayedFlag(loading && !contacts);

  // ?c=<contact id> (a notification, or oc's WhatsApp button) opens that person's line.
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(window.location.search).get('c'));
  // Opened by holding a face: that line starts with the mic listening (hands-free).
  const [voiceFor, setVoiceFor] = useState<string | null>(null);
  const speakTo = (c: Contact) => { setVoiceFor(c.id); setOpen(c.id); };
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('c')) return;
    const url = new URL(window.location.href); url.searchParams.delete('c');
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }, []);
  const [profile, setProfile] = useState<Partial<Contact> | null>(null);
  const [settings, setSettings] = useState(false);
  const [translating, setTranslating] = useState(false);
  // Pasted in Translate and answered: it opens that person's line as what they wrote.
  const [replyTo, setReplyTo] = useState<{ contact: string; text: string } | null>(null);
  const [newFrom, setNewFrom] = useState<string | null>(null);   // the text, while "Someone new" is being added
  useBackLayer(!!open, () => setOpen(null));
  const current = contacts?.find(c => c.id === open) ?? null;
  const saved = (c: Contact) => {
    setContacts(list => [...(list ?? []).filter(x => x.id !== c.id), c]); setProfile(null); void refresh();
    if (newFrom && !profile?.id) { setReplyTo({ contact: c.id, text: newFrom }); setNewFrom(null); setOpen(c.id); }
  };
  const answer = (c: Contact, text: string) => { setTranslating(false); setReplyTo({ contact: c.id, text }); setOpen(c.id); };

  const sheets = (
    <>
      {profile && <Profile contact={profile} waOwner={waOwner} onClose={() => { setProfile(null); setNewFrom(null); }} onSaved={saved} />}
      {translating && <Translate people={contacts ?? []} onAnswer={answer} onClose={() => setTranslating(false)}
        onAddPerson={(lang, text) => { setTranslating(false); setNewFrom(text); setProfile({ lang: lang in LANG_OK ? lang : 'fr', tone: 'formal', aliases: [] }); }} />}
      {settings && <Settings look={look} onLook={onLook} person={person} onClose={() => setSettings(false)} />}
    </>
  );

  if (current) {
    return <>{<Line key={current.id} contact={current} waOwner={waOwner} replyTo={replyTo?.contact === current.id ? replyTo.text : null}
      startVoice={voiceFor === current.id}
      onBack={() => { setOpen(null); setReplyTo(null); setVoiceFor(null); }} onProfile={() => setProfile(current)} onSent={() => void refresh()} />}{sheets}</>;
  }

  const people = contacts ?? [];
  const unread = people.filter(c => (c.unread ?? 0) > 0 && c.last_in).sort((a, b) => (b.last_in?.ts ?? '').localeCompare(a.last_in?.ts ?? ''));
  const name = person ? person[0].toUpperCase() + person.slice(1) : '';
  const ready = (c: Contact) => !!c.phone || c.channel !== 'whatsapp' || !waOwner;

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 pt-[env(safe-area-inset-top)]">
        <AppHeader title="Relay" subtitle="Their language, your words" initial={name ? name[0] : '…'} onSettings={() => setSettings(true)} />
        {state !== 'ok' && (
          <p className="mx-3 mb-1 rounded-[8px] bg-amber-500/15 px-3 py-1.5 text-[13px] text-amber-800 dark:text-amber-300" role="status">
            {state === 'expired' ? 'Signed out · ' : 'No connection · showing the last list · '}
            <button type="button" className="font-semibold underline" onClick={() => (state === 'expired' ? window.location.reload() : void refresh())}>{state === 'expired' ? 'sign in again' : 'try again'}</button>
          </p>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
        <button type="button" onClick={() => setTranslating(true)}
          className="press mt-2 flex min-h-14 w-full items-center gap-3 rounded-[20px] bg-pc-surface px-4 py-3 text-left active:bg-[var(--pc-hover-strong)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pc-accent text-[var(--pc-on-accent)]"><Languages size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">Translate</span>
            <span className="block truncate text-[13px] text-pc-text-muted">Paste an email or a message, then answer it</span>
          </span>
        </button>
        {unread.length > 0 && (
          <section className="mb-5 mt-5">
            <h2 className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-accent-ink)]">New</h2>
            <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[20px] bg-pc-surface">
              {unread.map(c => (
                <Hold key={c.id} onTap={() => setOpen(c.id)} onHold={() => speakTo(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[var(--pc-hover-strong)]">
                  <Face contact={c} size={48} ring />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2"><span className="truncate text-[17px] font-semibold">{c.label}</span><span className="ml-auto shrink-0 text-[12px] text-pc-text-muted">{timeOf(c.last_in!.ts)}</span></span>
                    <span className="line-clamp-2 text-[15px] leading-snug text-pc-text-secondary">{c.last_in!.text}</span>
                  </span>
                </Hold>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5">
          {people.length > 0 && <h2 className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-wide text-pc-text-muted">People</h2>}
          {!contacts && <p className="py-16 text-center text-[15px] text-pc-text-muted">{spinning ? 'Loading…' : ''}</p>}
          {contacts && people.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="text-[17px] font-semibold">Who do you write to?</p>
              <p className="mt-1 text-[15px] text-pc-text-muted">Add a person, their language and how you reach them. Then say what to tell them, in any language.</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-x-2 gap-y-4">
            {people.map(c => (
              <Hold key={c.id} onTap={() => (ready(c) ? setOpen(c.id) : setProfile(c))} onHold={() => (ready(c) ? speakTo(c) : setProfile(c))}
                className="press flex min-w-0 flex-col items-center gap-1.5 rounded-[20px] px-1 pb-2 pt-3 active:bg-[var(--pc-hover-strong)]">
                <Face contact={c} size={72} ring />
                <span className="mt-1 max-w-full truncate text-[16px] font-semibold">{c.label}</span>
                <span className="max-w-full truncate text-[12px] text-pc-text-muted">
                  {c.channel === 'whatsapp' && waOwner && !c.phone ? 'No number yet' : `${langName(c.lang)}${c.channel !== 'whatsapp' ? ` · ${channelName(c.channel)}` : ''}`}
                </span>
              </Hold>
            ))}
            {contacts && (
              <button type="button" onClick={() => setProfile({ lang: 'fr', tone: 'formal', aliases: [] })}
                className="press flex flex-col items-center gap-1.5 rounded-[20px] px-1 pb-2 pt-3 text-pc-text-muted active:bg-[var(--pc-hover-strong)]">
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed border-pc-border-strong"><Plus size={26} /></span>
                <span className="mt-1 text-[15px]">Add a person</span>
              </button>
            )}
          </div>
        </section>
        {people.length > 0 && (
          <p className="mt-8 flex items-start gap-2 px-2 text-[13px] text-pc-text-muted">
            <Volume2 size={15} className="mt-0.5 shrink-0" />
            Tap a person, say what to tell them in any language, check it in theirs, then Send (WhatsApp) or Copy. Hold a face to speak at once: the mic stops when you pause and you hear the message before you Send. Nothing leaves without your tap.
          </p>
        )}
      </main>
      {sheets}
    </div>
  );
}

/** A face: a tap opens the line, holding it (0.4 s, a buzz) opens it with the mic listening. */
function Hold({ onTap, onHold, className, children }: { onTap: () => void; onHold: () => void; className: string; children: ReactNode }) {
  const hold = useLift(() => onHold());
  return (
    <button type="button" onClick={onTap} className={`select-none [-webkit-touch-callout:none] ${className}`} {...hold.mouse}
      onTouchStart={e => hold.touchStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={e => hold.touchMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={e => hold.touchEnd(e)}>
      {children}
    </button>
  );
}

function Settings({ look, onLook, person, onClose }: { look: Look; onLook: (l: Look) => void; person: string | null; onClose: () => void }) {
  const [speech, setSpeech] = useState<SpeechMode>(getSpeechMode);
  const [lang, setLang] = useState(getDictationLang);
  return (
    <Sheet label="Settings" onClose={onClose} className="px-4 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-semibold">{person ? person[0].toUpperCase() + person.slice(1) : 'Relay'}</p>
        <CloseButton onClick={onClose} />
      </div>
      <p className="mb-1.5 mt-3 px-1 text-[13px] text-pc-text-muted">Appearance</p>
      <Segmented choice label="Appearance" value={look.appearance} onChange={a => onLook({ ...look, appearance: a })}
        options={[{ value: 'auto', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      <p className="mb-1.5 mt-5 px-1 text-[13px] text-pc-text-muted">The mic</p>
      <Segmented choice label="The mic" value={speech} onChange={m => { setSpeech(m); setSpeechMode(m); }}
        options={[{ value: 'live', label: 'Live (phone)' }, { value: 'whisper', label: 'Whisper (home)' }]} />
      <p className="mt-1.5 px-1 text-[13px] text-pc-text-muted">{speech === 'live' ? 'Text appears as you speak, in one language:' : 'Any language, or several mixed; the text comes after a short wait.'}</p>
      {speech === 'live' && (
        <div className="mt-2">
          <Segmented choice label="Language you speak" value={lang} onChange={l => { setLang(l); setDictationLang(l); }}
            options={DICTATION_LANGS.map(l => ({ value: l.code, label: l.name }))} />
        </div>
      )}
      <p className="mt-6 pb-6 text-center text-[12px] text-pc-text-muted">Messages go from your WhatsApp, only when you tap Send · the people and messages stay on the home server</p>
    </Sheet>
  );
}
