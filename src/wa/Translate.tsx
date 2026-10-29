/**
 * Translate anything (Lucian 2026-10-25: "a free text area that just translates and then I can tell
 * what to compose as answer"): paste an email or a message from any app, read it in your language,
 * hear it, then Answer it: pick the person (their agent writes the answer in their language and
 * style, and keeps what they wrote), or add them first.
 * The other way (Lucian 2026-10-27: "translate this in French informal" + what I dictate, "ready for one
 * tap copy"): said to Relay's main bar, or typed here starting with "translate…", it comes out in that
 * language, a little cleaned up, with Copy.
 * A box like Google Translate (Lucian 2026-10-29: "not auto translate to Romanian, write a message in
 * Romanian or English and have it translated to French or any combination, 4-5 languages"): pick the
 * language it goes into (and the register); written in any language. Into Romanian is the reading way,
 * with Answer it; into any other language it is a message to copy. The choice is remembered.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Languages, Plus, Share2, Square, Volume2 } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Controls';
import { ProgressRow } from '../ui/ProgressRow';
import { useBusy } from '../ui/draft';
import { canSpeak, speak } from '../ui/speak';
import { Face } from './Face';
import { BOX_LANGS, MY_LANG, asksTranslation, langName, phrase, translate, type Contact } from './api';

type Tone = 'formal' | 'informal';
type Phrased = { text: string; lang: string; tone: Tone; back: string; from?: string };

const KEY = 'relay-translate-into';
const remembered = (): { to: string; tone: Tone } => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { to?: string; tone?: Tone } | null;
    if (v?.to && BOX_LANGS.includes(v.to)) return { to: v.to, tone: v.tone === 'formal' ? 'formal' : 'informal' };
  } catch { /* private window: the default */ }
  return { to: 'fr', tone: 'informal' };
};

export function Translate({ people, said, voice, onAnswer, onAddPerson, onClose }: {
  people: Contact[];
  /** Said to the main bar ("translate this into French…"): done at once. */
  said?: string;
  voice?: boolean;
  onAnswer: (contact: Contact, text: string) => void;
  onAddPerson: (lang: string, text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(said ?? '');
  const [into, setInto] = useState(remembered);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ translation: string; lang: string } | null>(null);
  const [made, setMade] = useState<Phrased | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [stop, setStop] = useState<(() => void) | null>(null);
  useBusy('wa-translate', text.length > 0);
  const reading = into.to === MY_LANG;

  const go = async (t = text.trim(), to = into) => {
    if (!t) return;
    setBusy(true); setError(null); setOut(null); setMade(null); setCopied(false); setAnswering(false);
    try {
      if (asksTranslation(t)) setMade(await phrase(t));
      else if (to.to === MY_LANG) setOut(await translate(t));
      else setMade(await phrase(t, to.to, to.tone));
    }
    catch (e) { setError(navigator.onLine ? (e instanceof Error ? e.message : 'Could not translate it') : 'No connection'); }
    finally { setBusy(false); }
  };
  // Another language or register after a translation: translate it again at once.
  const pick = (next: { to: string; tone: Tone }) => {
    setInto(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not kept: fine */ }
    if ((out || made || error) && text.trim() && !busy) void go(text.trim(), next);
  };
  const started = useRef(false);
  useEffect(() => {
    if (!said || started.current) return;
    started.current = true;
    void go(said.trim());
  }, [said]);   // eslint-disable-line react-hooks/exhaustive-deps
  const hear = () => {
    if (stop) { stop(); return; }
    const s = made ? speak([made.text], made.lang, () => setStop(null)) : out ? speak([out.translation], MY_LANG, () => setStop(null)) : null;
    if (s) setStop(() => s);
  };
  const copy = async () => {
    if (!made) return;
    try { await navigator.clipboard.writeText(made.text); setCopied(true); }
    catch { setError('Could not copy it: hold the text to select it'); }
  };
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  // Those who write in that language first.
  const ordered = out ? [...people].sort((a, b) => Number(b.lang === out.lang) - Number(a.lang === out.lang)) : people;
  // What it says, in my language: not when it was written in my language or goes into it.
  const showBack = made?.back && made.lang !== MY_LANG && made.from !== MY_LANG;

  return (
    <Sheet label="Translate" onClose={onClose} className="flex max-h-[92dvh] flex-col px-4 pt-2">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-[17px] font-semibold">Translate</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        <p className="mb-1 text-[13px] text-pc-text-muted">Into</p>
        <Segmented choice size="s" label="Translate into" value={into.to} onChange={to => pick({ ...into, to })}
          options={BOX_LANGS.map(l => ({ value: l, label: langName(l) }))} />
        {!reading && (
          <div className="mt-2">
            <Segmented choice size="s" label="Register" value={into.tone} onChange={tone => pick({ ...into, tone })}
              options={[{ value: 'informal', label: 'Informal (tu)' }, { value: 'formal', label: 'Formal (vous, Вы)' }]} />
          </div>
        )}
        <textarea value={text} onChange={e => { setText(e.target.value); setOut(null); setMade(null); setAnswering(false); setError(null); }} rows={made ? 3 : 5} autoFocus={!said} aria-label="Text to translate"
          placeholder={reading ? 'Paste a message in any language…' : 'Write in any language…'}
          className="mt-3 w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[16px] leading-snug outline-none focus:border-pc-accent" />
        {busy ? (
          <div className="mt-3"><ProgressRow tile={<Languages size={18} />} name="Translating" status={asksTranslation(text) ? 'As you asked…' : `Into ${langName(into.to)}…`} progress={null} /></div>
        ) : !out && !made && (
          <button type="button" disabled={!text.trim()} onClick={() => void go()}
            className="press mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
            <Languages size={19} /> {asksTranslation(text) ? 'Translate' : `Translate into ${langName(into.to)}`}
          </button>
        )}
        {error && <p className="mt-2 text-[15px] text-red-500" role="alert">{error}</p>}
        {made && (
          <>
            <section className="mt-3 rounded-[20px] bg-pc-surface px-4 py-3">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-accent-ink)]">In {langName(made.lang)} · {made.tone}</p>
                {canSpeak() && (
                  <button type="button" onClick={hear} aria-label={stop ? 'Stop' : 'Hear how it sounds'} className="press -mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--pc-accent-ink)]">
                    {stop ? <Square size={16} /> : <Volume2 size={19} />}
                  </button>
                )}
              </div>
              <p className="select-text whitespace-pre-wrap text-[19px] leading-snug">{made.text}</p>
              {showBack && <p className="mt-2 whitespace-pre-wrap text-[15px] leading-snug text-pc-text-muted">{made.back}</p>}
            </section>
            <div className="mt-3 flex items-center gap-2">
              {canShare && <button type="button" onClick={() => void navigator.share({ text: made.text }).catch(() => undefined)} aria-label="Share" className="press flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-pc-surface"><Share2 size={20} /></button>}
              <button type="button" onClick={() => void copy()}
                className={`press flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[24px] bg-pc-accent font-bold text-[var(--pc-on-accent)] ${voice ? 'h-[88px] text-[24px]' : 'h-14 text-[17px]'}`}>
                {copied ? <><Check size={voice ? 28 : 19} /> Copied</> : <><Copy size={voice ? 28 : 19} /> Copy</>}
              </button>
            </div>
            {copied && <p className="mt-2 text-center text-[13px] text-pc-text-muted" role="status">Paste it where you write to them</p>}
          </>
        )}
        {out && (
          <section className="mt-3 rounded-[20px] bg-pc-surface px-4 py-3">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-accent-ink)]">From {langName(out.lang)}</p>
              {canSpeak() && (
                <button type="button" onClick={hear} aria-label={stop ? 'Stop' : 'Read aloud'} className="press -mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--pc-accent-ink)]">
                  {stop ? <Square size={16} /> : <Volume2 size={19} />}
                </button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-[17px] leading-snug">{out.translation}</p>
          </section>
        )}
        {out && !answering && (
          <button type="button" onClick={() => setAnswering(true)}
            className="press mt-3 flex h-14 w-full items-center justify-center rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)]">
            Answer it
          </button>
        )}
        {out && answering && (
          <>
            <p className="mb-2 mt-4 text-[13px] font-semibold text-pc-text-muted">Who is it from?</p>
            <div className="grid grid-cols-4 gap-x-1 gap-y-3">
              {ordered.map(c => (
                <button key={c.id} type="button" onClick={() => onAnswer(c, text.trim())} className="press flex min-w-0 flex-col items-center gap-1 rounded-[12px] px-1 py-2 active:bg-[var(--pc-hover-strong)]">
                  <Face contact={c} size={48} />
                  <span className="max-w-full truncate text-[13px] font-medium">{c.label}</span>
                </button>
              ))}
              <button type="button" onClick={() => onAddPerson(out.lang, text.trim())} className="press flex flex-col items-center gap-1 rounded-[12px] px-1 py-2 text-pc-text-muted">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-pc-border-strong"><Plus size={20} /></span>
                <span className="text-[13px]">Someone new</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
