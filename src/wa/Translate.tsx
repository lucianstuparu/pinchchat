/**
 * Translate anything (Lucian 2026-10-25: "a free text area that just translates and then I can tell
 * what to compose as answer"): paste an email or a message from any app, read it in your language,
 * hear it, then Answer it: pick the person (their agent writes the answer in their language and
 * style, and keeps what they wrote), or add them first.
 */
import { useState } from 'react';
import { Languages, Plus, Square, Volume2 } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { ProgressRow } from '../ui/ProgressRow';
import { useBusy } from '../ui/draft';
import { canSpeak, speak } from '../ui/speak';
import { Face } from './Face';
import { MY_LANG, langName, translate, type Contact } from './api';

export function Translate({ people, onAnswer, onAddPerson, onClose }: {
  people: Contact[];
  onAnswer: (contact: Contact, text: string) => void;
  onAddPerson: (lang: string, text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ translation: string; lang: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [stop, setStop] = useState<(() => void) | null>(null);
  useBusy('wa-translate', text.length > 0);

  const go = async () => {
    setBusy(true); setError(null); setOut(null);
    try { setOut(await translate(text.trim())); }
    catch (e) { setError(navigator.onLine ? (e instanceof Error ? e.message : 'Could not translate it') : 'No connection'); }
    finally { setBusy(false); }
  };
  const hear = () => {
    if (stop) { stop(); return; }
    if (!out) return;
    const s = speak([out.translation], MY_LANG, () => setStop(null));
    setStop(() => s);
  };
  // Those who write in that language first.
  const ordered = out ? [...people].sort((a, b) => Number(b.lang === out.lang) - Number(a.lang === out.lang)) : people;

  return (
    <Sheet label="Translate" onClose={onClose} className="flex max-h-[92dvh] flex-col px-4 pt-2">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-[17px] font-semibold">Translate</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        <p className="mb-2 text-[13px] text-pc-text-muted">Paste an email or a message from any app. You get it in {langName(MY_LANG)}, then you can answer it.</p>
        <textarea value={text} onChange={e => { setText(e.target.value); setOut(null); setAnswering(false); }} rows={6} autoFocus aria-label="Text to translate"
          placeholder="Bonjour Lucian, …"
          className="w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[16px] leading-snug outline-none focus:border-pc-accent" />
        {busy ? (
          <div className="mt-3"><ProgressRow tile={<Languages size={18} />} name="Translating" status={`Into ${langName(MY_LANG)}…`} progress={null} /></div>
        ) : !out && (
          <button type="button" disabled={!text.trim()} onClick={() => void go()}
            className="press mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
            <Languages size={19} /> Translate
          </button>
        )}
        {error && <p className="mt-2 text-[15px] text-red-500" role="alert">{error}</p>}
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
