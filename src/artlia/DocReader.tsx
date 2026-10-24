/**
 * A document of the Casa Artlia Drive copy, opened from search: its text (Docs as text, PDFs as the
 * text beside them), the searched words marked, scrolled to the first one. 500 lines at a time from
 * register-api /artlia/doc; read-only, like the copy itself.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, CloseButton } from '../ui/Sheet';
import { Marked } from '../ui/SearchParts';
import { wordParts } from '../ui/searchText';
import { post } from '../app/api';
import { docFolder, docName } from './api';

interface Page { path: string; total_lines: number; from: number; text: string }


export function DocReader({ path, query, onClose }: { path: string; query: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [next, setNext] = useState<number | null>(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  const load = useCallback(async (offset: number) => {
    setLoading(true); setError(null);
    try {
      const p = await post<Page>('/artlia/doc', { path, offset });
      setText(t => (offset === 0 ? p.text : `${t}\n${p.text}`));
      setTotal(p.total_lines);
      const end = p.from - 1 + p.text.split('\n').length;
      setNext(end < p.total_lines ? end : null);
    } catch { setError(navigator.onLine ? 'Nu s-a putut deschide documentul' : 'Fără conexiune'); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void load(0); }, [load]);
  // The first marked word in view once, when the text arrives.
  useEffect(() => {
    if (scrolled.current || !text) return;
    scrolled.current = true;
    window.setTimeout(() => body.current?.querySelector('mark')?.scrollIntoView({ block: 'center' }), 60);
  }, [text]);

  return (
    <Sheet label={docName(path)} onClose={onClose} className="flex h-[92dvh] flex-col md:h-[80dvh] md:max-w-2xl">
      <div className="flex shrink-0 items-start gap-2 px-4 pb-2 pt-1">
        <div className="min-w-0 flex-1 pt-1.5">
          <p className="text-[17px] font-semibold leading-snug">{docName(path)}</p>
          <p className="mt-0.5 text-[12px] text-pc-text-muted">{docFolder(path) || 'Drive'}{total ? ` · ${total} rânduri` : ''} · copie din Drive, doar citire</p>
        </div>
        <CloseButton onClick={onClose} label="Închide" />
      </div>
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-pc-border px-4 pb-6 pt-3">
        {!text && loading && <p className="py-10 text-center text-[15px] text-pc-text-muted">Se deschide…</p>}
        {error && <p className="py-6 text-center text-[15px] text-red-500" role="alert">{error} · <button type="button" className="underline" onClick={() => void load(next ?? 0)}>reîncearcă</button></p>}
        {text && <Marked parts={wordParts(text, query)} className="block whitespace-pre-wrap break-words text-[15px] leading-relaxed" />}
        {next !== null && text && (
          <button type="button" disabled={loading} onClick={() => void load(next)} className="press mt-4 h-11 w-full rounded-[12px] bg-pc-surface text-[15px] font-medium disabled:opacity-60">
            {loading ? 'Se încarcă…' : `Arată mai departe (de la rândul ${next + 1})`}
          </button>
        )}
      </div>
    </Sheet>
  );
}
