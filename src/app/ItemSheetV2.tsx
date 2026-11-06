/**
 * Item sheet v2 (my.design v2/oc-v2-brief.md §14.1, board 38): opens on Next moves with the material at hand, never on a briefing
 * (§15.3). Order: object + matter line + short title + state; Next moves; Tell them; The matter; checkpoint; fixed foot.
 * The one accent control is the step's verb button (review 01: one dominant action; no Priority here). Behind ?view=v2; v1 keeps ItemSheet.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { useBusy } from '../ui/draft';
import { ObjectFace } from '../kit2/ObjectFace';
import { REALMS } from '../realms';
import { act, fetchSheet, formatAmount, formatDay, type ItemAction, type Move, type Sheet as ItemData, type Step, type TellKind } from './api';
import { coordinationFor, daysBetween, isClosedState, stepLine, toldLine } from './todayRules';

const LATER: Array<[string, number]> = [['Tomorrow', 1], ['In 3 days', 3], ['In a week', 7]];
const SHAPES: Array<[string, string]> = [['plain', 'Plain'], ['boring', 'Boring'], ['huge', 'Huge'], ['awkward', 'Awkward']];
const READINESS = [['', 'Let the coach choose'], ['phone', 'On the phone'], ['coach', 'Start with the coach'], ['physical', 'Small physical effort'], ['focus', 'Attention to detail'], ['light', 'Low energy'], ['energizing', 'Energizing'], ['heavy', 'Needs the right state']];
const localDay = (plus = 0) => { const d = new Date(); d.setDate(d.getDate() + plus); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const chip = 'press inline-flex min-h-10 items-center rounded-full bg-[var(--pc-hover-strong)] px-4 py-2 text-left text-[14px] font-semibold disabled:opacity-50';
const chipLine = 'press inline-flex min-h-10 items-center rounded-full border border-pc-border-strong px-4 py-2 text-left text-[14px] font-semibold disabled:opacity-50';
const input = 'w-full rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[16px] outline-none focus:border-pc-accent';
const label = 'text-[13px] font-bold uppercase tracking-wide text-pc-text-muted';

const Mark = ({ by }: { by?: string }) => by === 'person'
  ? <span className="ml-1.5 inline-block rounded-[6px] bg-[var(--pc-hover-strong)] px-1.5 text-[12px] font-semibold">yours</span>
  : <span className="ml-1.5 inline-block rounded-[6px] px-1.5 text-[12px] font-semibold text-[var(--pc-accent-ink)]" style={{ background: 'var(--pc-accent-tint)' }}>suggested</span>;

/** Row of the brief's timeline: hidden when empty. */
function BriefRow({ name, children }: { name: string; children: ReactNode }) {
  return <p className="border-l-2 border-[var(--pc-separator)] py-1.5 pl-3 text-[15px] leading-snug"><b className="font-bold">{name}</b> · {children}</p>;
}

export interface SheetV2Props {
  id: string;
  person?: string | null;
  /** Today's crucial, so the foot can say "2 already". */
  crucialIds: string[];
  onClose: () => void;
  onChanged: () => void;
  onAsk: (text: string, send?: boolean) => void;
  onActed: (id: string, label: string, action: ItemAction) => void;
  onCrucial: (id: string, title: string, on: boolean) => Promise<void>;
  onTell: (req: { id: string; title: string; kind: TellKind; name: string }) => void;
  footer?: ReactNode;
}

export function ItemSheetV2({ id, person, crucialIds, onClose, onChanged, onAsk, onActed, onCrucial, onTell, footer }: SheetV2Props) {
  const [sheet, setSheet] = useState<ItemData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<null | 'later' | 'next' | 'park' | 'wrong' | 'correct' | 'edit' | 'first'>(null);
  const [rejecting, setRejecting] = useState<number | 'step' | null>(null);
  const [text, setText] = useState('');
  const [why, setWhy] = useState('');
  const [shape, setShape] = useState('plain');
  const [details, setDetails] = useState(false);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [, tick] = useState(0);
  useBusy('item-sheet-v2', panel !== null || rejecting !== null);

  const load = () => fetchSheet(id).then(s => { setSheet(s); setError(null); }).catch(e => setError(e instanceof Error ? e.message : 'Failed'));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const it = sheet?.item;
  const step = it?.step as Step | undefined;
  // The running step's elapsed minutes.
  useEffect(() => {
    if (!step?.started) return;
    const t = window.setInterval(() => tick(n => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [step?.started]);

  const title = (it && (sheet?.glance_title || it.title.replace(/\*\*/g, ''))) || 'Item';
  const run = async (action: ItemAction, extra?: Record<string, unknown>, said?: string) => {
    setBusy(true);
    try {
      await act(id, action, extra);
      await load();
      onChanged();
      if (said) onActed(id, `${said}: ${title}`, action);
      setPanel(null); setRejecting(null); setText(''); setWhy('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const str = (k: string) => (it && typeof it[k] === 'string' ? (it[k] as string) : undefined);
  const num = (k: string) => (it && typeof it[k] === 'number' ? (it[k] as number) : undefined);
  const today = sheet?.today ?? localDay();
  const closed = !!it && isClosedState(it.status);
  const kind = (it?.kind as string) || (it?.store === 'loops' ? 'loop' : 'task');
  const isWatch = kind === 'watch', isLoop = kind === 'loop', isBill = kind === 'bill';
  const parked = it?.parked as { on: string; why?: string } | undefined;
  const alternatives = (it?.alternatives as Move[] | undefined) ?? [];
  const promise = it?.promise as { to: string; said?: string; by?: string; on?: string; told?: Array<{ at: string; kind: string; how?: string }> } | undefined;
  const brief = sheet?.matter?.brief ?? null;
  const tell = it ? coordinationFor({ promise: promise as never, waiting_on: str('waiting_on') }, today) : [];
  const told = it ? toldLine({ promise: promise as never }, today) : null;
  const isCrucial = crucialIds.includes(id);
  const other = person === 'lucian' ? 'ludmila' : person === 'ludmila' ? 'lucian' : null;
  const otherName = other ? other[0].toUpperCase() + other.slice(1) : '';
  const reviewOn = str('review_on');
  const inReview = !!reviewOn && reviewOn > today;
  const mins = step?.started ? Math.max(0, Math.round((Date.now() - Date.parse(step.started)) / 60_000)) : 0;

  const startEdit = () => {
    if (!it) return;
    setEdit({ title: it.title, glance: sheet?.glance_title ?? '', due: str('due_date') ?? '', realm: sheet?.realm_id ?? '', matter: str('matter') ?? '', readiness: str('readiness') ?? '',
      to: promise?.to ?? '', said: promise?.said ?? '', by: promise?.by ?? '', amount: num('amount') != null ? String(num('amount')) : '', place: str('place') ?? '', check: str('check') ?? '' });
    setPanel('edit');
  };
  const saveEdit = async () => {
    if (!it) return;
    const extra: Record<string, unknown> = {};
    if (edit.title.trim() !== it.title) extra.title = edit.title.trim();
    if (edit.glance.trim() !== (sheet?.glance_title ?? '')) extra.glance_title = edit.glance.trim();
    if (edit.due !== (str('due_date') ?? '')) extra.due_date = edit.due;
    if (edit.realm !== (sheet?.realm_id ?? '') && edit.realm !== 'other') extra.realm_id = edit.realm;
    if (edit.matter.trim() !== (str('matter') ?? '')) extra.matter = edit.matter.trim();
    if (isWatch) { if (edit.amount !== (num('amount') != null ? String(num('amount')) : '')) extra.amount = edit.amount; if (edit.place !== (str('place') ?? '')) extra.place = edit.place; if (edit.check !== (str('check') ?? '')) extra.check = edit.check; }
    setBusy(true);
    try {
      if (Object.keys(extra).length) await act(id, 'edit', extra);
      if (!isWatch) {
        if (edit.readiness !== (str('readiness') ?? '')) await act(id, 'readiness', { readiness: edit.readiness });
        if (edit.to.trim() !== (promise?.to ?? '') || edit.said.trim() !== (promise?.said ?? '') || edit.by !== (promise?.by ?? '')) await act(id, 'promise-set', { to: edit.to.trim(), said: edit.said.trim(), by: edit.by });
      }
      await load(); onChanged(); onActed(id, `Saved: ${edit.glance || title}`, 'edit');
      setPanel(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const matterLine = [typeof it?.n === 'number' ? String(it.n) : '', sheet?.matter?.name ?? '', isBill || kind === 'subscription' ? formatAmount(num('amount'), str('currency')) : ''].filter(Boolean).join(' · ');
  const stateLine = brief?.state || (inReview ? 'Review tomorrow' : '');
  const canFoot = !!it && !closed && !isWatch && !isLoop && !parked;

  const nextMoves = it && !closed && !isWatch && !isLoop && (parked ? (
    <section aria-label="Parked" className="mb-4">
      <p className="rounded-[16px] bg-pc-surface px-4 py-3 text-[15px]">
        Parked{parked.why ? ` · ${parked.why}` : ''} · kept, back under Worth a moment
      </p>
      <button type="button" disabled={busy} onClick={() => void run('unpark', {}, 'Back from parked')} className={`${chip} mt-2`}>Reactivate</button>
    </section>
  ) : (
    <section aria-label="Next moves" className="mb-4">
      <h3 className={`${label} pb-2`}>Next moves</h3>
      {step ? (
        <div className="rounded-[16px] px-4 py-3" style={{ background: 'var(--pc-accent-tint)' }}>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full bg-pc-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="break-words text-[16px] font-bold leading-snug">{step.first}</p>
              {step.started
                ? <p className="text-[13px] text-pc-text-secondary">Running · {mins} min</p>
                : <p className="text-[13px] leading-snug text-pc-text-secondary">{[stepLine({ step }), step.why].filter(Boolean).join(' · ')}<Mark by={step.by} /></p>}
            </div>
            {!step.started && <button type="button" disabled={busy} onClick={() => void run('step-start')} className="press min-h-10 shrink-0 rounded-full bg-pc-accent px-4 text-[15px] font-bold text-[var(--pc-on-accent)] disabled:opacity-50">{step.verb || 'Start'}</button>}
          </div>
          {step.started && (
            <div className="mt-2 flex gap-2 pl-6">
              <button type="button" disabled={busy} onClick={() => { void run('step-stop').then(() => setPanel('next')); }} className="press min-h-10 rounded-full bg-pc-accent px-4 text-[15px] font-bold text-[var(--pc-on-accent)] disabled:opacity-50">Stop · done</button>
              <button type="button" disabled={busy} onClick={() => void run('step-stop', {}, 'Not yet')} className={chip}>Not yet</button>
            </div>
          )}
          {step.draft && <p className="mt-2 whitespace-pre-wrap rounded-[12px] bg-pc-elevated px-3 py-2 text-[15px] leading-snug">{step.draft}</p>}
          {step.recovery && <p className="mt-2 pl-6 text-[13px] leading-snug text-pc-text-secondary">{step.recovery}</p>}
        </div>
      ) : (
        <div className="rounded-[16px] px-4 py-3" style={{ background: 'var(--pc-accent-tint)' }}>
          <p className="pb-2 text-[16px] font-bold">Pick a first move</p>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="The smallest first action" aria-label="First move" className={input} />
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Shape">
            {SHAPES.map(([k, l]) => <button key={k} type="button" aria-pressed={shape === k} onClick={() => setShape(k)} className={shape === k ? `${chip} ring-2 ring-pc-accent` : chip}>{l}</button>)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy || !text.trim()} onClick={() => void run('step-set', { first: text.trim(), shape }, 'Step set')} className="press min-h-10 rounded-full bg-pc-accent px-4 text-[15px] font-bold text-[var(--pc-on-accent)] disabled:opacity-50">Set it</button>
            <button type="button" onClick={() => { onAsk(`About ⟨${id}⟩: `); onClose(); }} className={chip}>Ask the coach</button>
          </div>
        </div>
      )}
      {alternatives.map((a, i) => (
        <div key={a.first} className="flex items-center gap-2 py-1">
          <button type="button" disabled={busy} onClick={() => void run('step-pick', { index: i }, 'Next move chosen')} className="press flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[12px] px-4 py-1.5 text-left">
            <span className="h-3 w-3 shrink-0 rounded-full bg-pc-text-faint" aria-hidden />
            <span className="min-w-0"><span className="block text-[15px] leading-snug">{a.first}</span><span className="block text-[13px] leading-snug text-pc-text-secondary">{a.why}<Mark /></span></span>
          </button>
          <button type="button" aria-label={`Not this: ${a.first}`} onClick={() => { setRejecting(i); setWhy(''); }} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-pc-text-muted"><X size={18} aria-hidden /></button>
        </div>
      ))}
      {rejecting !== null && (
        <div className="mt-2 space-y-2 rounded-[12px] bg-pc-surface p-3">
          <input value={why} onChange={e => setWhy(e.target.value)} autoFocus placeholder="Why not? (kept in the matter)" aria-label="Why not" className={input} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void run('step-reject', rejecting === 'step' ? { why } : { index: rejecting, why }, 'Ruled out')} className={chip}>Rule it out</button>
            <button type="button" onClick={() => setRejecting(null)} className={chipLine}>Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => { void run('think').then(() => { onAsk(`About ⟨${id}⟩: `); onClose(); }); }} className={chip}>Think it through, 5 min</button>
        {!inReview && <button type="button" disabled={busy} onClick={() => void run('review-tomorrow', {}, 'Review tomorrow')} className={chip}>Review tomorrow, fresh head</button>}
        <button type="button" disabled={busy} onClick={() => setPanel(panel === 'next' ? null : 'next')} aria-expanded={panel === 'next'} className={chipLine}>{isBill ? 'Paid, and next…' : 'Done, and next…'}</button>
        <button type="button" disabled={busy} onClick={() => { setPanel(panel === 'park' ? null : 'park'); setWhy(''); }} aria-expanded={panel === 'park'} className={chipLine}>Park this</button>
      </div>
      {panel === 'next' && (
        <div className="mt-2 space-y-2 rounded-[12px] bg-pc-surface p-3" role="group" aria-label="What is next">
          {alternatives.map(a => <button key={a.first} type="button" disabled={busy} onClick={() => void run('step-next', { first: a.first, minutes: a.minutes, where: a.where }, 'Step done')} className={`${chip} w-full`}>{a.first}</button>)}
          <input value={text} onChange={e => setText(e.target.value)} placeholder="The next move" aria-label="The next move" className={input} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !text.trim()} onClick={() => void run('step-next', { first: text.trim() }, 'Step done')} className={chip}>Set it</button>
            <button type="button" disabled={busy} onClick={() => void run('done', {}, isBill ? 'Paid' : 'Done').then(onClose)} className={chip}>That was all, it's done</button>
            {step && <button type="button" onClick={() => { setPanel(null); setRejecting('step'); setWhy(''); }} className={chipLine}>Tried, did not work</button>}
          </div>
        </div>
      )}
      {panel === 'park' && (
        <div className="mt-2 space-y-2 rounded-[12px] bg-pc-surface p-3">
          <input value={why} onChange={e => setWhy(e.target.value)} autoFocus placeholder="Why it is worth coming back to" aria-label="Why it is worth coming back to" className={input} />
          <button type="button" disabled={busy} onClick={() => void run('park', { why }, 'Kept, back under Worth a moment').then(onClose)} className={chip}>Park it</button>
        </div>
      )}
    </section>
  ));

  return (
    <Sheet label={title} onClose={onClose} className="flex max-h-[88dvh] flex-col md:max-w-lg">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2">
        {!it && !error && <p className="py-10 text-center text-[15px] text-pc-text-muted">Loading…</p>}
        {error && <p className="py-2 text-[15px] text-[var(--pc-accent-ink)]" role="alert">{error}</p>}
        {it && (
          <>
            <header className="mb-4 flex items-start gap-3">
              {sheet?.face && <ObjectFace face={sheet.face} size={56} />}
              <div className="min-w-0 flex-1">
                {matterLine && <p className="text-[13px] text-pc-text-muted">{matterLine}</p>}
                <h2 className={`break-words text-[22px] font-bold leading-tight ${closed ? 'text-pc-text-muted line-through' : ''}`}>{title}</h2>
                {stateLine && <p className="mt-0.5 text-[15px] leading-snug text-[var(--pc-accent-ink)]">{stateLine}</p>}
                {told && <p className="mt-0.5 text-[13px] font-semibold text-[#0e7c5f]">{told}</p>}
                {isWatch && !closed && <p className="mt-0.5 text-[15px] text-pc-text-muted">Nothing to do: it happens by itself.</p>}
              </div>
              <CloseButton onClick={onClose} />
            </header>

            {nextMoves}

            {tell.length > 0 && !closed && !parked && (
              <section aria-label="Tell them" className="mb-4">
                <h3 className={`${label} pb-2`}>Tell them</h3>
                <div className="flex flex-wrap gap-2">
                  {tell.map((c, i) => <button key={c.kind} type="button" onClick={() => onTell({ id, title, kind: c.kind, name: promise?.to ?? '' })} className={i === 0 ? `${chip} text-[var(--pc-accent-ink)]` : chip} style={i === 0 ? { background: 'var(--pc-accent-tint)' } : undefined}>{c.label}<Mark /></button>)}
                </div>
              </section>
            )}

            {isLoop && !closed && (
              <section className="mb-4 space-y-2">
                {str('state') && <p className="text-[15px]">{str('state')}</p>}
                {str('next_step') && <p className="text-[15px]"><b>Next</b> · {str('next_step')}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { onAsk(`Continue: ${it.title} ⟨${id}⟩`, true); onClose(); }} className="press min-h-10 rounded-full bg-pc-accent px-4 text-[15px] font-bold text-[var(--pc-on-accent)]">Continue</button>
                  <button type="button" disabled={busy} onClick={() => void run('loop-close', {}, 'Settled')} className={chip}>It's settled</button>
                </div>
              </section>
            )}

            {(brief || promise) && (
              <section aria-label="The matter" className="mb-3">
                <h3 className="pb-2"><span className={label}>The matter{sheet?.matter ? ` · ${sheet.matter.name}` : ''}</span>{sheet?.matter && <span className="pl-2 text-[13px] text-pc-text-muted">{sheet.matter.things} {sheet.matter.things === 1 ? 'thing' : 'things'} · {sheet.matter.state}</span>}</h3>
                {brief?.purpose && <BriefRow name="Purpose">{brief.purpose}</BriefRow>}
                {brief?.state && <BriefRow name="State">{brief.state}</BriefRow>}
                {(brief?.tried?.length || brief?.ruled_out?.length) ? <BriefRow name="Tried">{brief.tried?.join('; ')}{brief.ruled_out?.length ? <span className="text-pc-text-muted">{brief.tried?.length ? ' · ' : ''}ruled out: {brief.ruled_out.join('; ')}</span> : null}</BriefRow> : null}
                {(brief?.confirmed?.length || brief?.estimated?.length) ? (
                  <BriefRow name="Dates">
                    {brief.confirmed?.map(d => <span key={d.date + d.what}><b className="font-bold text-[#0b4a8f]">{formatDay(d.date)}</b> {d.what} · </span>)}
                    {brief.estimated?.map(d => <span key={d.date + d.what} className="text-pc-text-muted">~{formatDay(d.date)} {d.what} · </span>)}
                  </BriefRow>
                ) : null}
                {brief?.evidence?.length ? <BriefRow name="Evidence">{brief.evidence.join('; ')}</BriefRow> : null}
                {brief?.open?.length ? <BriefRow name="Open">{brief.open.join('; ')}</BriefRow> : null}
                {promise && (
                  <BriefRow name="Said">
                    {promise.on ? `${formatDay(promise.on)} · ` : ''}promised {promise.to}{promise.said ? ` "${promise.said}"` : ''}{promise.by ? ` by ${formatDay(promise.by)}` : ''}
                    {promise.told?.map(t => <span key={t.at} className="block font-semibold text-[#0e7c5f]">{formatDay(t.at)} · {t.how === 'copied' ? 'copied a message for' : 'told'} {promise.to}</span>)}
                  </BriefRow>
                )}
                {brief?.written_on && (
                  <p className="pt-2 text-[13px] text-pc-text-muted">
                    checkpoint written {formatDay(brief.written_on)} by {brief.written_by === 'person' ? 'you' : 'the coach'} · <button type="button" onClick={() => { setText(brief.state ?? ''); setPanel('correct'); }} className="press min-h-10 font-semibold text-[var(--pc-accent-ink)]">correct it</button>
                  </p>
                )}
                {panel === 'correct' && (
                  <div className="mt-1 space-y-2 rounded-[12px] bg-pc-surface p-3">
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={3} autoFocus aria-label="Where it stands" className={`${input} resize-none`} />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy || !text.trim()} onClick={() => void run('brief-correct', { field: 'state', text: text.trim() }, 'Corrected')} className={chip}>Save, yours from now on</button>
                      <button type="button" onClick={() => setPanel(null)} className={chipLine}>Cancel</button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {panel === 'wrong' && (
              <div className="mb-3 space-y-2 rounded-[12px] bg-pc-surface p-3">
                <input value={why} onChange={e => setWhy(e.target.value)} autoFocus placeholder="What went wrong" aria-label="What went wrong" className={input} />
                <input value={text} onChange={e => setText(e.target.value)} placeholder="What to do now (optional)" aria-label="What to do now" className={input} />
                <button type="button" disabled={busy || !why.trim()} onClick={() => void run('went-wrong', { reason: why.trim(), step: text.trim() }, 'Now a task')} className={chip}>Make it a task</button>
              </div>
            )}

            <button type="button" onClick={() => setDetails(d => !d)} aria-expanded={details} className="press flex min-h-10 items-center gap-1 text-[14px] font-semibold text-pc-text-secondary">
              Details <ChevronDown size={16} className={details ? 'rotate-180' : ''} aria-hidden />
            </button>
            {details && (
              <div className="space-y-2 pb-3 text-[15px]">
                <p className="leading-snug">{it.title.replace(/\*\*/g, '')}</p>
                {[['Amount', formatAmount(num('amount'), str('currency'))], [isWatch ? 'When' : 'Due', str('due_date') ? formatDay(str('due_date')!) : ''], ['To', str('payee') ?? ''], ['If missed', str('consequence') ?? ''], ['Account or place', str('place') ?? ''], ['What to check', str('check') ?? '']].filter(([, v]) => v).map(([k, v]) => (
                  <p key={k} className="flex justify-between gap-4"><span className="text-pc-text-muted">{k}</span><span className="text-right">{v}</span></p>
                ))}
                {str('notes') && <p className="whitespace-pre-wrap rounded-[12px] bg-pc-surface px-3 py-2 text-pc-text-secondary">{str('notes')}</p>}
                {sheet?.origin?.kind === 'message' && <p className="rounded-[12px] bg-pc-surface px-3 py-2">Came from “{sheet.origin.text}”</p>}
                {sheet?.origin?.kind === 'mail' && <p className="rounded-[12px] bg-pc-surface px-3 py-2 text-pc-text-secondary">Came from an email. Ask about it to have it opened.</p>}
                {panel === 'edit' ? (
                  <div className="space-y-2">
                    <textarea value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} rows={2} aria-label="Title" className={`${input} resize-none`} />
                    <input value={edit.glance} onChange={e => setEdit({ ...edit, glance: e.target.value })} placeholder="Short title" aria-label="Short title" className={input} />
                    <label className="flex items-center justify-between gap-3"><span className="text-pc-text-muted">{isWatch ? 'When' : 'Due'}</span><input type="date" value={edit.due} onChange={e => setEdit({ ...edit, due: e.target.value })} className="bg-transparent text-right outline-none" /></label>
                    <label className="flex items-center justify-between gap-3"><span className="text-pc-text-muted">Realm</span>
                      <select value={edit.realm} onChange={e => setEdit({ ...edit, realm: e.target.value })} className="h-10 bg-transparent text-right outline-none">
                        {!REALMS.some(r => r.id === edit.realm) && <option value="other">Other</option>}
                        {REALMS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </label>
                    <input value={edit.matter} onChange={e => setEdit({ ...edit, matter: e.target.value })} placeholder="Matter" aria-label="Matter" className={input} />
                    {isWatch ? (
                      <>
                        <input value={edit.amount} onChange={e => setEdit({ ...edit, amount: e.target.value })} inputMode="decimal" placeholder="Amount (€)" aria-label="Amount" className={input} />
                        <input value={edit.place} onChange={e => setEdit({ ...edit, place: e.target.value })} placeholder="Account or place" aria-label="Account or place" className={input} />
                        <input value={edit.check} onChange={e => setEdit({ ...edit, check: e.target.value })} placeholder="What to check" aria-label="What to check" className={input} />
                      </>
                    ) : (
                      <>
                        <label className="flex items-center justify-between gap-3"><span className="text-pc-text-muted">What it takes</span>
                          <select value={edit.readiness} onChange={e => setEdit({ ...edit, readiness: e.target.value })} className="h-10 bg-transparent text-right outline-none">{READINESS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                        </label>
                        <input value={edit.to} onChange={e => setEdit({ ...edit, to: e.target.value })} placeholder="Promised to" aria-label="Promised to" className={input} />
                        {edit.to.trim() && <input value={edit.said} onChange={e => setEdit({ ...edit, said: e.target.value })} placeholder="What you said" aria-label="What you said" className={input} />}
                        {edit.to.trim() && <label className="flex items-center justify-between gap-3"><span className="text-pc-text-muted">By</span><input type="date" value={edit.by} onChange={e => setEdit({ ...edit, by: e.target.value })} className="bg-transparent text-right outline-none" /></label>}
                      </>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy || !edit.title.trim()} onClick={() => void saveEdit()} className={chip}>Save</button>
                      <button type="button" onClick={() => setPanel(null)} className={chipLine}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={startEdit} className={chip}>Edit</button>
                    {!isLoop && <button type="button" onClick={() => { onAsk(`About ⟨${id}⟩: `); onClose(); }} className={chip}>Ask</button>}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {it && (
        <div className="shrink-0 border-t border-pc-border bg-pc-elevated px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          {footer}
          {panel === 'later' && (
            <div className="mb-2 rounded-[12px] bg-pc-surface p-2" role="group" aria-label="Later">
              <div className="grid grid-cols-3 gap-2">
                {LATER.map(([l, days]) => <button key={l} type="button" disabled={busy} onClick={() => void run('snooze', { days, move_due: true }, l)} className="press h-12 rounded-[10px] bg-pc-elevated text-[15px] font-medium">{l}</button>)}
              </div>
              <label className="mt-2 flex h-12 items-center justify-between gap-3 rounded-[10px] bg-pc-elevated px-3 text-[15px]">
                <span>Pick a date</span>
                <input type="date" min={localDay(1)} max={localDay(60)} disabled={busy} aria-label="Pick a date" onChange={e => { const d = e.target.value; if (d) void run('snooze', { days: daysBetween(localDay(), d), move_due: true }, formatDay(d)); }} className="bg-transparent text-right outline-none" />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {closed ? (
              <button type="button" disabled={busy} onClick={() => void run('reopen', {}, 'Reopened')} className={chip}>Reopen</button>
            ) : isWatch ? (
              <>
                <button type="button" onClick={() => { setPanel(panel === 'wrong' ? null : 'wrong'); setWhy(''); setText(''); }} className={chipLine}>Went wrong…</button>
                <button type="button" disabled={busy} onClick={() => void run('drop', {}, 'Not needed').then(onClose)} className={chip}>Not needed</button>
              </>
            ) : (
              <>
                {canFoot && <button type="button" onClick={() => setPanel(panel === 'later' ? null : 'later')} aria-expanded={panel === 'later'} className={chipLine}>Later…</button>}
                {canFoot && (isCrucial
                  ? <button type="button" disabled={busy} onClick={() => { void onCrucial(id, title, false).then(load); }} className={chipLine}>Not crucial</button>
                  : <button type="button" disabled={busy || crucialIds.length >= 2} onClick={() => { void onCrucial(id, title, true).then(load); }} className={`${chip} text-[var(--pc-accent-ink)]`} style={{ background: 'var(--pc-accent-tint)' }}>{crucialIds.length >= 2 ? 'Make crucial · 2 already' : 'Make crucial'}</button>)}
                {canFoot && other && <button type="button" onClick={() => onTell({ id, title, kind: 'give', name: otherName })} className={chipLine}>Give to {otherName}</button>}
                <button type="button" disabled={busy} onClick={() => void run('drop', {}, 'Not needed').then(onClose)} className={chip}>Not needed</button>
              </>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
