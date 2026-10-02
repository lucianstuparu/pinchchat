import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import type { QuestionRecord } from './useQuestions';

interface Props {
  record: QuestionRecord;
  onAnswer: (id: string, answers: Record<string, string[]>) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function useCountdown(expiresAtMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((expiresAtMs - now) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m` : `${s}s`;
}

/**
 * Renders a native ask_user request as tappable choices. Single-question,
 * single-select prompts answer on the first tap — the messenger-style fast
 * path. Multi-select or multi-question prompts collect choices then submit.
 */
export function QuestionCard({ record, onAnswer, onSkip }: Props) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = useCountdown(record.expiresAtMs);

  const hasSecret = record.questions.some(q => q.isSecret);
  const oneTap = record.questions.length === 1 && !record.questions[0].multiSelect;

  const submit = async (answers: Record<string, string[]>) => {
    setBusy(true);
    setError(null);
    try {
      await onAnswer(record.id, answers);
    } catch {
      setError('Could not send the answer — try again.');
      setBusy(false);
    }
  };

  const complete = useMemo(() => record.questions.every(q => {
    const picks = selected[q.questionId] ?? [];
    return picks.length > 0 || (other[q.questionId] ?? '').trim().length > 0;
  }), [record.questions, selected, other]);

  const toggle = (qid: string, label: string, multi: boolean) => {
    if (oneTap) {
      void submit({ [qid]: [label] });
      return;
    }
    setSelected(prev => {
      const cur = prev[qid] ?? [];
      const next = multi ? (cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label]) : [label];
      return { ...prev, [qid]: next };
    });
  };

  const collect = () => {
    const out: Record<string, string[]> = {};
    for (const q of record.questions) {
      const custom = (other[q.questionId] ?? '').trim();
      out[q.questionId] = custom ? [...(selected[q.questionId] ?? []), custom] : (selected[q.questionId] ?? []);
    }
    return out;
  };

  return (
    <div className="mx-3 my-2 rounded-2xl border border-pc-border bg-pc-surface shadow-sm overflow-hidden" role="group" aria-label="Question from OpenClaw">
      <div className="flex items-center justify-between px-4 pt-3 text-xs text-pc-text-muted">
        <span>OpenClaw is asking</span>
        <span aria-label="time remaining">{remaining}</span>
      </div>

      {hasSecret ? (
        <p className="px-4 py-3 text-sm text-pc-text">
          This question asks for a secret. Answer it in the OpenClaw Control UI — secrets are not collected here.
        </p>
      ) : record.questions.map(q => (
        <div key={q.questionId} className="px-4 py-2">
          {q.header && <div className="text-[11px] uppercase tracking-wide text-pc-accent font-semibold">{q.header}</div>}
          <p className="text-[15px] text-pc-text mt-0.5">{q.question}</p>
          {q.url && (
            <a href={q.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-pc-accent">
              <ExternalLink size={12} /> {safeHost(q.url)}
            </a>
          )}
          <div className="mt-2 flex flex-col gap-1.5">
            {q.options.map(opt => {
              const on = (selected[q.questionId] ?? []).includes(opt.label);
              return (
                <button
                  key={opt.label}
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(q.questionId, opt.label, !!q.multiSelect)}
                  className={`text-left rounded-xl px-3 py-2.5 border transition-colors disabled:opacity-60 ${on ? 'border-pc-accent bg-[rgba(var(--pc-accent-rgb),0.12)]' : 'border-pc-border hover:bg-[var(--pc-hover)]'}`}
                >
                  <span className="flex items-center gap-2 text-[15px] text-pc-text">
                    {q.multiSelect && (
                      <span className={`h-4 w-4 rounded border flex items-center justify-center ${on ? 'bg-pc-accent border-pc-accent' : 'border-pc-border-strong'}`}>
                        {on && <Check size={12} className="text-white" />}
                      </span>
                    )}
                    {opt.label}
                  </span>
                  {opt.description && <span className="block text-xs text-pc-text-muted mt-0.5">{opt.description}</span>}
                </button>
              );
            })}
            <input
              type="text"
              disabled={busy}
              value={other[q.questionId] ?? ''}
              onChange={e => setOther(prev => ({ ...prev, [q.questionId]: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter' && oneTap && (other[q.questionId] ?? '').trim()) void submit(collect());
              }}
              placeholder="Other…"
              className="rounded-xl px-3 py-2 bg-pc-input border border-pc-border text-[15px] text-pc-text placeholder:text-pc-text-faint outline-none focus:border-pc-accent"
            />
          </div>
        </div>
      ))}

      {error && <p className="px-4 text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2 px-3 py-2.5">
        <button type="button" disabled={busy} onClick={() => void onSkip(record.id)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-pc-text-muted hover:bg-[var(--pc-hover)]">
          <X size={14} /> Skip
        </button>
        {!hasSecret && (!oneTap || (other[record.questions[0].questionId] ?? '').trim()) && (
          <button type="button" disabled={busy || !complete} onClick={() => void submit(collect())} className="rounded-full px-4 py-1.5 text-sm font-medium bg-pc-accent text-white disabled:opacity-50">
            Send
          </button>
        )}
      </div>
    </div>
  );
}
