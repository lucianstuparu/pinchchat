/**
 * Relay, the WhatsApp app (Lucian 2026-10-25: "take it out in a separate app ... designed like a dialer
 * proxy for WhatsApp which allows me to easily communicate voice to multi language with selected
 * people"). Its own scope, out of oc: the people you write to as faces, like a phone's favourites;
 * one person's line; you speak in any language, it writes the message in theirs, Send (with Undo).
 * Their messages arrive translated and can be heard. Built on oc's parts (input bar, sheet, the
 * same contacts and drafts on CT 103), with its own look: the call green, dark text on it.
 * No gateway login: register-api knows the person from Cloudflare Access.
 * Faces carry the person's photo when one was added (Profile). The bar at the bottom takes who and what
 * at once (Lucian 2026-10-26: "a main button which would record without choosing the person"): the name
 * is found in the words (matchContact; the agent when unclear), that person's line opens and the message
 * is prepared and read back, so you hear to whom before anything goes.
 * Drafts (2026-10-27): messages kept for later (Later on the card) and those a mail rule prepared, until sent,
 * copied or dropped. Relay's own notifications (Settings) bring a mail rule's message with Send on it.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Bell, Languages, Plus, Search } from 'lucide-react';
import { getLook, lookVars, setLook, useMode, useThemeChrome, type Look } from '../app/themes';
import { SessionExpired, transcribeAudio, whoami } from '../app/api';
import { getDictationLang, getSpeechMode, setDictationLang, setSpeechMode, DICTATION_LANGS, type SpeechMode } from '../app/voice';
import { AppHeader, Segmented } from '../ui/Controls';
import { CloseButton, Sheet } from '../ui/Sheet';
import { useBackLayer, useExactSizes } from '../ui/useBackLayer';
import { useDelayedFlag } from '../ui/progress';
import { useLift } from '../ui/dragOrder';
import { ProgressRow } from '../ui/ProgressRow';
import { speak } from '../ui/speak';
import { Composer } from '../mobile/Composer';
import { disablePush, enablePush, getPushState, type PushState } from '../mobile/pushNotifications';
import { Face } from './Face';
import { FacePhotos } from './photos';
import { Line } from './Line';
import { Profile } from './Profile';
import { Translate } from './Translate';
import { MY_LANG, cachedPhotos, channelName, fetchContacts, fetchDrafts, fetchPhotos, langName, matchContact, pickContact, timeOf, type Contact, type Draft, type Photos } from './api';

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
  const ready = (c: Contact) => !!c.phone || c.channel !== 'whatsapp' || !waOwner;
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const refresh = useCallback(async () => {
    setLoading(true);
    void fetchDrafts().then(setDrafts).catch(() => undefined);
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
  // Faces: from the phone at once, then whatever changed on the server.
  const [photos, setPhotos] = useState<Photos>(cachedPhotos);
  useEffect(() => { void fetchPhotos(cachedPhotos()).then(setPhotos).catch(() => undefined); }, []);

  // ?c=<contact id> (a notification, or oc's WhatsApp button) opens that person's line.
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(window.location.search).get('c'));
  // ?d=<draft id> with it (a mail rule's notification): that message on the card.
  const [openDraft, setOpenDraft] = useState<string | null>(() => new URLSearchParams(window.location.search).get('d'));
  // Opened by holding a face: that line starts with the mic listening (hands-free).
  const [voiceFor, setVoiceFor] = useState<string | null>(null);
  const speakTo = (c: Contact) => { setVoiceFor(c.id); setOpen(c.id); };
  // Said to the bar at the bottom: who it is for, then that line prepares it (by voice: read back).
  const [said, setSaid] = useState<{ text: string; voice: boolean; for?: string } | null>(null);
  const [finding, setFinding] = useState<{ text: string; voice: boolean } | null>(null);
  const [choosing, setChoosing] = useState<{ text: string; voice: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const goTo = (c: Contact, text: string, voice: boolean) => { setChoosing(null); setFinding(null); setSaid({ text, voice, for: c.id }); setVoiceFor(null); setOpen(c.id); };
  const whoAndWhat = async (text: string, voice: boolean) => {
    try { localStorage.removeItem('draft:wa:home'); } catch { /* not kept */ }
    const people = (contacts ?? []).filter(ready);
    const found = matchContact(text, people);
    if (found) { goTo(found, text, voice); return; }
    setFinding({ text, voice });
    let id = '';
    try { id = await pickContact(text, people); } catch { /* asked below */ }
    const c = people.find(x => x.id === id);
    if (c) { goTo(c, text, voice); return; }
    setFinding(null); setChoosing({ text, voice });
    if (voice) speak(['Pentru cine?'], MY_LANG);
  };
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('c')) return;
    const url = new URL(window.location.href); url.searchParams.delete('c'); url.searchParams.delete('d');
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
  const saved = (c: Contact, photo?: { v: number; data: string } | null, problem?: string) => {
    setContacts(list => [...(list ?? []).filter(x => x.id !== c.id), c]); setProfile(null); void refresh();
    if (photo !== undefined) setPhotos(ps => {
      const n = { ...ps }; if (photo) n[c.id] = photo; else delete n[c.id];
      try { localStorage.setItem('wa:photos', JSON.stringify(n)); } catch { /* not kept */ }
      return n;
    });
    if (problem) setNotice(problem);
    if (newFrom && !profile?.id) { setReplyTo({ contact: c.id, text: newFrom }); setNewFrom(null); setOpen(c.id); }
  };
  const answer = (c: Contact, text: string) => { setTranslating(false); setReplyTo({ contact: c.id, text }); setOpen(c.id); };

  const sheets = (
    <>
      {profile && <Profile contact={profile} waOwner={waOwner} onClose={() => { setProfile(null); setNewFrom(null); }} onSaved={saved} />}
      {translating && <Translate people={contacts ?? []} onAnswer={answer} onClose={() => setTranslating(false)}
        onAddPerson={(lang, text) => { setTranslating(false); setNewFrom(text); setProfile({ lang: lang in LANG_OK ? lang : 'fr', tone: 'formal', aliases: [] }); }} />}
      {settings && <Settings look={look} onLook={onLook} person={person} onClose={() => setSettings(false)} />}
      {choosing && <WhoFor people={(contacts ?? []).filter(ready)} said={choosing.text} onPick={c => goTo(c, choosing.text, choosing.voice)} onClose={() => setChoosing(null)} />}
    </>
  );
  const withFaces = (n: ReactNode) => <FacePhotos.Provider value={photos}>{n}</FacePhotos.Provider>;

  if (current) {
    // A kept draft of theirs opens on the card (the newest), unless something was just said for them.
    const kept = said?.for === current.id ? null : (openDraft ?? drafts.filter(d => d.contact === current.id).at(-1)?.id ?? null);
    return withFaces(<>{<Line key={current.id} contact={current} waOwner={waOwner} replyTo={replyTo?.contact === current.id ? replyTo.text : null}
      startVoice={voiceFor === current.id} autoSay={said?.for === current.id ? said : null} openDraft={kept}
      onBack={() => { setOpen(null); setOpenDraft(null); setReplyTo(null); setVoiceFor(null); setSaid(null); void refresh(); }} onProfile={() => setProfile(current)}
      onSent={() => { setOpenDraft(null); void refresh(); }}
      onKept={d => { setOpen(null); setOpenDraft(null); setSaid(null); setVoiceFor(null); setDrafts(ds => [...ds.filter(x => x.id !== d.id), d]); setNotice(`Kept in Drafts: to ${current.label}`); void refresh(); }} />}{sheets}</>);
  }

  const people = contacts ?? [];
  const unread = people.filter(c => (c.unread ?? 0) > 0 && c.last_in).sort((a, b) => (b.last_in?.ts ?? '').localeCompare(a.last_in?.ts ?? ''));
  const name = person ? person[0].toUpperCase() + person.slice(1) : '';

  return withFaces(
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-[640px]">
          <AppHeader title="Relay" subtitle="Their language, your words" initial={name ? name[0] : '…'} onSettings={() => setSettings(true)} />
          {state !== 'ok' && (
            <p className="mx-3 mb-1 rounded-[8px] bg-amber-500/15 px-3 py-1.5 text-[13px] text-amber-800 dark:text-amber-300" role="status">
              {state === 'expired' ? 'Signed out · ' : 'No connection · showing the last list · '}
              <button type="button" className="font-semibold underline" onClick={() => (state === 'expired' ? window.location.reload() : void refresh())}>{state === 'expired' ? 'sign in again' : 'try again'}</button>
            </p>
          )}
          {notice && (
            <p className="mx-3 mb-1 rounded-[8px] bg-amber-500/15 px-3 py-1.5 text-[13px] text-amber-800 dark:text-amber-300" role="status">
              {notice} · <button type="button" className="font-semibold underline" onClick={() => setNotice(null)}>OK</button>
            </p>
          )}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        <div className="mx-auto w-full max-w-[640px]">
          {unread.length > 0 && (
            <section className="mb-5 mt-2">
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

          {drafts.length > 0 && (
            <section className="mb-5 mt-2">
              <h2 className="px-1 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-pc-text-muted">Drafts</h2>
              <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[20px] bg-pc-surface">
                {[...drafts].reverse().map(d => {
                  const c = people.find(x => x.id === d.contact);
                  if (!c) return null;
                  return (
                    <button key={d.id} type="button" onClick={() => { setOpenDraft(d.id); setOpen(c.id); }} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[var(--pc-hover-strong)]">
                      <Face contact={c} size={48} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2"><span className="truncate text-[17px] font-semibold">To {c.label}</span><span className="ml-auto shrink-0 text-[12px] text-pc-text-muted">{timeOf(d.saved_at ?? d.created ?? '')}</span></span>
                        <span className="line-clamp-2 text-[15px] leading-snug text-pc-text-secondary">{d.text}</span>
                        {d.origin === 'rule' && d.why && <span className="block truncate text-[13px] text-pc-text-muted">Mail rule: {d.why}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mt-2">
            {!contacts && <p className="py-16 text-center text-[15px] text-pc-text-muted">{spinning ? 'Loading…' : ''}</p>}
            {contacts && people.length === 0 && (
              <div className="px-6 py-10 text-center">
                <p className="text-[17px] font-semibold">Who do you write to?</p>
                <p className="mt-1 text-[15px] text-pc-text-muted">Add a person, their photo, their language and how you reach them. Then say what to tell them, in any language.</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-4">
              {people.map(c => (
                <Hold key={c.id} onTap={() => (ready(c) ? setOpen(c.id) : setProfile(c))} onHold={() => (ready(c) ? speakTo(c) : setProfile(c))}
                  className="press flex min-w-0 flex-col items-center gap-1 rounded-[20px] px-1 pb-3 pt-3 active:bg-[var(--pc-hover-strong)]">
                  <Face contact={c} size={80} ring />
                  <span className="mt-1.5 max-w-full truncate text-[16px] font-semibold">{c.label}</span>
                  <span className="max-w-full truncate text-[12px] text-pc-text-muted">
                    {c.channel === 'whatsapp' && waOwner && !c.phone ? 'No number yet' : `${langName(c.lang)}${c.channel !== 'whatsapp' ? ` · ${channelName(c.channel)}` : ''}`}
                  </span>
                </Hold>
              ))}
              {contacts && (
                <button type="button" onClick={() => setProfile({ lang: 'fr', tone: 'formal', aliases: [] })}
                  className="press flex flex-col items-center gap-1 rounded-[20px] px-1 pb-3 pt-3 text-pc-text-muted active:bg-[var(--pc-hover-strong)]">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-pc-border-strong"><Plus size={26} /></span>
                  <span className="mt-1.5 text-[15px]">Add a person</span>
                </button>
              )}
            </div>
          </section>

          <button type="button" onClick={() => setTranslating(true)}
            className="press mt-5 flex min-h-14 w-full items-center gap-3 rounded-[20px] bg-pc-surface px-4 py-3 text-left active:bg-[var(--pc-hover-strong)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pc-elevated text-[var(--pc-accent-ink)]"><Languages size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">Translate something</span>
              <span className="block truncate text-[13px] text-pc-text-muted">An email or a message from another app, then answer it</span>
            </span>
          </button>
          {people.length > 0 && (
            <p className="mt-4 px-2 text-center text-[13px] leading-snug text-pc-text-muted">
              Tap a face to write, hold it to speak at once. Or say who and what below. You hear the message before it goes; nothing leaves without your yes.
            </p>
          )}
        </div>
      </main>
      {people.some(ready) && (
        <div className="shrink-0 border-t border-pc-border bg-pc-base pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-[640px]">
            {finding ? (
              <div className="px-3 py-3">
                <ProgressRow tile={<span className="flex h-10 w-10 items-center justify-center rounded-full bg-pc-surface"><Search size={18} /></span>}
                  name="Who is it for?" status="Finding the person…" detail={`“${finding.text.slice(0, 60)}”`} progress={null}
                  onCancel={() => { setFinding(null); setChoosing(finding); }} cancelLabel="Choose" />
              </div>
            ) : (
              <Composer key="home" onSend={(text, _a, meta) => void whoAndWhat(text, !!meta?.voice)} voice transcribe={transcribeAudio} handsFree
                draftKey="wa:home" attach={false} sendLabel="Find who and prepare it"
                placeholder="Who and what? “Bunica, ajung la 7”" />
            )}
          </div>
        </div>
      )}
      {sheets}
    </div>
  );
}

/** Nobody was named, or it was unclear: the faces, to say who it is for. */
function WhoFor({ people, said, onPick, onClose }: { people: Contact[]; said: string; onPick: (c: Contact) => void; onClose: () => void }) {
  return (
    <Sheet label="Who is it for?" onClose={onClose} className="px-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Who is it for?</h2>
        <CloseButton onClick={onClose} />
      </div>
      <p className="mt-0.5 line-clamp-2 text-[15px] text-pc-text-muted">“{said}”</p>
      <div className="grid grid-cols-3 gap-2 pb-6 pt-3 sm:grid-cols-4">
        {people.map(c => (
          <button key={c.id} type="button" onClick={() => onPick(c)} className="press flex min-w-0 flex-col items-center gap-1 rounded-[20px] px-1 pb-3 pt-3 active:bg-[var(--pc-hover-strong)]">
            <Face contact={c} size={64} />
            <span className="mt-1 max-w-full truncate text-[15px] font-semibold">{c.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
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

/** Relay's own notifications on this phone: a mail rule's message arrives with Send on it. */
function Notifications() {
  const [state, setState] = useState<PushState | 'busy'>('off');
  const [error, setError] = useState('');
  useEffect(() => { void getPushState().then(setState).catch(() => setState('unsupported')); }, []);
  const toggle = async () => {
    const from = state;
    setState('busy'); setError('');
    try { setState(from === 'on' ? await disablePush() : await enablePush()); }
    catch (e) { setState(from); setError(e instanceof Error ? e.message : 'Could not change it'); }
  };
  if (state === 'unsupported') return null;
  const on = state === 'on';
  return (
    <>
      <p className="mb-1.5 mt-5 px-1 text-[13px] text-pc-text-muted">Notifications</p>
      <button type="button" role="switch" aria-checked={on} disabled={state === 'busy' || state === 'blocked'} onClick={() => void toggle()}
        className="flex min-h-14 w-full items-center gap-3 rounded-[12px] bg-pc-surface px-4 py-2.5 text-left disabled:opacity-60">
        <Bell size={20} className="shrink-0 text-[var(--pc-accent-ink)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px]">Messages ready to send</span>
          <span className="block text-[13px] leading-snug text-pc-text-muted">{state === 'blocked' ? 'Blocked for this app in the phone’s settings' : 'When a mail rule prepares one: Send from the notification, with 5 s to undo'}</span>
        </span>
        <span className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${on ? 'bg-pc-accent' : 'bg-pc-border-strong'}`} aria-hidden>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${on ? 'left-[24px]' : 'left-1'}`} />
        </span>
      </button>
      {error && <p className="mt-1.5 px-1 text-[13px] text-red-500" role="alert">{error}</p>}
    </>
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
      <Notifications />
      <p className="mt-6 pb-6 text-center text-[12px] text-pc-text-muted">Messages go from your WhatsApp, only when you tap Send · the people and messages stay on the home server</p>
    </Sheet>
  );
}
