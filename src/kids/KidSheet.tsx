/**
 * One kids item (ai.manager kids-app.md): what it is, for whom, when and where, who takes them and
 * what to bring; the calendar (put in / take out, the calendar both see); Done for what can be done;
 * a question to the assistant, edit, put off, not needed; notes. A plan lists its steps with ticks.
 * Every change offers Undo (the bar in the footer).
 */
import { useState } from 'react';
import { Ban, CalendarCheck, CalendarPlus, Check, Clock, ExternalLink, Heart, MessageSquare, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { useBusy } from '../ui/draft';
import { useDelayedFlag } from '../ui/progress';
import { DueChip, Title } from '../app/Todo';
import { roError, type Child, type KidAction, type KidItem, type KidList, type Slot } from './api';
import { ChildDots, KidRow } from './Lists';
import { DAY_NAME, KIND_LABEL, RSVP_LABEL, TYPE_LABEL, WHO_LABEL, childName, isOpen, plans, shortDate, slotText, timeText } from './rules';

type Mode = 'light' | 'dark';

interface Draft {
  title: string; child: string; due: string; end_date: string; time: string; end_time: string; who: string; place: string; bring: string;
  type: string; rsvp: string; season_from: string; season_to: string; cost: string; contact: string; schedule: Slot[];
  tags: string; materials: string; link: string;
}
const draftOf = (i: KidItem): Draft => ({
  title: i.title, child: i.child ?? '', due: i.due_date ?? '', end_date: i.end_date ?? '', time: i.time ?? '', end_time: i.end_time ?? '',
  who: i.who ?? '', place: i.place ?? '', bring: i.bring ?? '', type: i.type ?? '', rsvp: i.rsvp ?? '', season_from: i.season_from ?? '',
  season_to: i.season_to ?? '', cost: i.cost ?? '', contact: i.contact ?? '', schedule: i.schedule ?? [], tags: (i.tags ?? []).join(', '),
  materials: i.materials ?? '', link: i.link ?? '',
});
/** Only what changed ('' clears a field): sending the date again would reset the reminder. */
function changes(i: KidItem, d: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const was = draftOf(i);
  const map: Record<string, keyof Draft> = { title: 'title', child: 'child', due_date: 'due', end_date: 'end_date', time: 'time', end_time: 'end_time', who: 'who',
    place: 'place', bring: 'bring', type: 'type', rsvp: 'rsvp', season_from: 'season_from', season_to: 'season_to', cost: 'cost', contact: 'contact',
    materials: 'materials', link: 'link' };
  for (const [k, f] of Object.entries(map)) if (String(d[f]).trim() !== String(was[f])) out[k] = String(d[f]).trim();
  if (JSON.stringify(d.schedule) !== JSON.stringify(was.schedule)) out.schedule = d.schedule.filter(s => s.start);
  if (d.tags !== was.tags) out.tags = d.tags.split(',').map(t => t.trim()).filter(Boolean);
  return out;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-[12px] bg-pc-surface px-3 py-1 text-[15px]">
      <span className="shrink-0 text-pc-text-muted">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</span>
    </label>
  );
}
const input = 'h-10 min-w-0 flex-1 bg-transparent text-right text-[16px] outline-none';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-[15px] leading-snug">
      <span className="w-[92px] shrink-0 text-pc-text-muted">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function KidSheet({ item, list, mode, footer, onClose, onAct, onAsk, onOpen }: {
  item: KidItem; list: KidList; mode: Mode; footer?: React.ReactNode;
  onClose: () => void;
  onAct: (item: KidItem, action: KidAction, extra?: Record<string, unknown>) => Promise<void>;
  onAsk: (item: KidItem) => void;
  onOpen: (item: KidItem) => void;
}) {
  const [busy, setBusy] = useState<KidAction | null>(null);
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  useBusy('kid-item', !!busy || !!note.trim() || !!edit);
  const saving = useDelayedFlag(!!busy);
  const open = isOpen(item);
  const kids: Child[] = list.children;
  const kind = item.kind;
  const inCalendar = !!item.calendar?.length;
  const canCalendar = kind === 'activity' ? !!item.schedule?.length : !!item.due_date && kind !== 'idea';
  const steps = kind === 'plan' ? plans(list.items).find(p => p.plan.id === item.id)?.steps ?? [] : [];
  const planOf = item.plan ? list.items.find(i => i.id === item.plan) : undefined;

  /** True when it worked; on failure the typed text stays where it is. */
  const run = async (action: KidAction, extra?: Record<string, unknown>): Promise<boolean> => {
    setBusy(action); setError(null);
    try { await onAct(item, action, extra); return true; }
    catch (e) { setError(action === 'calendar' ? (navigator.onLine ? 'Nu s-a putut pune în calendar · încearcă din nou' : roError(e)) : action === 'uncalendar' ? 'Nu s-a putut scoate din calendar · încearcă din nou' : roError(e)); return false; }
    finally { setBusy(null); }
  };
  const save = async () => {
    if (!edit) return;
    const c = changes(item, edit);
    if (Object.keys(c).length === 0 || await run('edit', c)) setEdit(null);
  };
  const addNote = async () => { const t = note.trim(); if (!t) return; if (await run('note', { text: t })) setNote(''); };

  const secondary = 'press flex flex-col items-center justify-center gap-1 rounded-[12px] bg-pc-surface py-3 text-[13px] text-pc-text active:bg-[var(--pc-hover-strong)] disabled:opacity-50';
  const primary = 'press flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-accent text-[17px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-60';
  const plain = 'press flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-pc-surface text-[16px] font-semibold disabled:opacity-60';
  const doable = kind === 'task' || kind === 'plan';

  const when = kind === 'activity' ? (item.schedule ?? []).map(slotText).join(', ')
    : item.due_date ? `${DAY_NAME[new Date(`${item.due_date}T12:00:00Z`).getUTCDay() || 7]} ${shortDate(item.due_date)}${item.time ? `, ${timeText(item.time, item.end_time)}` : ''}${item.end_date ? ` – ${shortDate(item.end_date)}` : ''}` : '';

  const calendarButton = (primaryLook: boolean) => inCalendar ? (
    <button type="button" disabled={!!busy} onClick={() => void run('uncalendar')} className={plain}>
      <CalendarCheck size={18} className="text-[var(--pc-accent-ink)]" /> {busy === 'uncalendar' && saving ? 'Se scoate…' : 'În calendar · Scoate'}
    </button>
  ) : (
    <button type="button" disabled={!!busy || !canCalendar} onClick={() => void run('calendar')} className={primaryLook ? primary : plain}>
      <CalendarPlus size={19} /> {busy === 'calendar' && saving ? 'Se pune în calendar…' : canCalendar ? 'Pune în calendar' : kind === 'activity' ? 'Pune în calendar (lipsește orarul)' : 'Pune în calendar (lipsește data)'}
    </button>
  );

  return (
    <Sheet label={item.title.replace(/\*\*/g, '')} onClose={onClose} className="max-h-[88dvh] overflow-y-auto px-4 pt-2 md:max-w-lg">
      <div className="flex justify-end"><CloseButton onClick={onClose} label="Închide" /></div>
      <div className="-mt-2 mb-3">
        <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-pc-text-muted">
          <ChildDots item={item} kids={kids} size={20} />
          <span>{kind === 'event' && item.type ? TYPE_LABEL[item.type] : KIND_LABEL[kind]}</span>
          {item.child && <span>· {childName(item.child, kids)}</span>}
          {planOf && <button type="button" onClick={() => onOpen(planOf)} className="text-[var(--pc-accent-ink)] underline underline-offset-2">· {planOf.title.replace(/\*\*/g, '')}</button>}
        </p>
        {!edit && (
          <>
            <Title text={`${item.n != null ? `${item.n} · ` : ''}${item.title}`} className={`block text-[20px] font-semibold leading-snug ${open ? '' : 'text-pc-text-muted line-through'}`} />
            {doable && item.due_date && <span className="mt-2 inline-flex"><DueChip item={item} today={list.today} mode={mode} /></span>}
          </>
        )}
      </div>

      {edit ? (
        <div className="mb-4 space-y-2">
          <textarea value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} rows={2} aria-label="Titlu"
            className="w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[17px] outline-none focus:border-pc-accent" />
          <Field label="Pentru">
            <select value={edit.child} onChange={e => setEdit({ ...edit, child: e.target.value })} className={input}>
              <option value="">—</option>
              {kids.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="both">Amândouă</option>
            </select>
          </Field>
          {kind === 'activity' ? (
            <>
              {edit.schedule.map((s, k) => (
                <div key={k} className="flex items-center gap-2 rounded-[12px] bg-pc-surface px-3 py-1">
                  <select value={s.day} aria-label="Ziua" onChange={e => setEdit({ ...edit, schedule: edit.schedule.map((x, j) => (j === k ? { ...x, day: Number(e.target.value) } : x)) })} className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none">
                    {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{DAY_NAME[d]}</option>)}
                  </select>
                  <input type="time" value={s.start} aria-label="De la" onChange={e => setEdit({ ...edit, schedule: edit.schedule.map((x, j) => (j === k ? { ...x, start: e.target.value } : x)) })} className="h-10 w-[84px] bg-transparent text-[16px] outline-none" />
                  <input type="time" value={s.end ?? ''} aria-label="Până la" onChange={e => setEdit({ ...edit, schedule: edit.schedule.map((x, j) => (j === k ? { ...x, end: e.target.value || undefined } : x)) })} className="h-10 w-[84px] bg-transparent text-[16px] outline-none" />
                  <button type="button" aria-label="Scoate ziua" onClick={() => setEdit({ ...edit, schedule: edit.schedule.filter((_, j) => j !== k) })} className="press flex h-10 w-10 items-center justify-center text-pc-text-muted"><Trash2 size={18} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setEdit({ ...edit, schedule: [...edit.schedule, { day: 3, start: '14:00' }] })} className="press flex h-10 items-center gap-1.5 px-2 text-[15px] text-[var(--pc-accent-ink)]"><Plus size={18} /> O zi pe săptămână</button>
              <Field label="De la"><input type="date" value={edit.season_from} onChange={e => setEdit({ ...edit, season_from: e.target.value })} className={input} /></Field>
              <Field label="Până la"><input type="date" value={edit.season_to} onChange={e => setEdit({ ...edit, season_to: e.target.value })} className={input} /></Field>
            </>
          ) : kind !== 'idea' && (
            <>
              <Field label={kind === 'task' ? 'Termen' : kind === 'plan' ? 'Până la' : 'Ziua'}>
                <input type="date" value={edit.due} onChange={e => setEdit({ ...edit, due: e.target.value })} className={input} />
                {edit.due && <button type="button" onClick={() => setEdit({ ...edit, due: '' })} className="press h-10 shrink-0 text-[13px] text-[var(--pc-accent-ink)]">Fără dată</button>}
              </Field>
              {kind === 'event' && (
                <>
                  <Field label="Ora"><input type="time" value={edit.time} onChange={e => setEdit({ ...edit, time: e.target.value })} className={input} /></Field>
                  <Field label="Până la ora"><input type="time" value={edit.end_time} onChange={e => setEdit({ ...edit, end_time: e.target.value })} className={input} /></Field>
                  <Field label="Ultima zi"><input type="date" value={edit.end_date} onChange={e => setEdit({ ...edit, end_date: e.target.value })} className={input} /></Field>
                  <Field label="Ce e">
                    <select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })} className={input}>
                      <option value="">—</option>
                      {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  {edit.type === 'invitation' && (
                    <Field label="Răspuns">
                      <select value={edit.rsvp} onChange={e => setEdit({ ...edit, rsvp: e.target.value })} className={input}>
                        <option value="">Nu am răspuns</option>
                        {Object.entries(RSVP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </Field>
                  )}
                </>
              )}
            </>
          )}
          {(kind === 'activity' || kind === 'event') && (
            <>
              <Field label="Cine îi duce">
                <select value={edit.who} onChange={e => setEdit({ ...edit, who: e.target.value })} className={input}>
                  <option value="">—</option>
                  <option value="lucian">Lucian</option>
                  <option value="ludmila">Ludmila</option>
                  <option value="both">Amândoi</option>
                </select>
              </Field>
              <Field label="Unde"><input value={edit.place} onChange={e => setEdit({ ...edit, place: e.target.value })} className={input} /></Field>
              <Field label="De luat"><input value={edit.bring} onChange={e => setEdit({ ...edit, bring: e.target.value })} className={input} /></Field>
            </>
          )}
          {kind === 'activity' && (
            <>
              <Field label="Cost"><input value={edit.cost} onChange={e => setEdit({ ...edit, cost: e.target.value })} className={input} /></Field>
              <Field label="Contact"><input value={edit.contact} onChange={e => setEdit({ ...edit, contact: e.target.value })} className={input} /></Field>
            </>
          )}
          {kind === 'idea' && (
            <>
              <Field label="Etichete"><input value={edit.tags} onChange={e => setEdit({ ...edit, tags: e.target.value })} placeholder="ploaie, bricolaj" className={input} /></Field>
              <Field label="Materiale"><input value={edit.materials} onChange={e => setEdit({ ...edit, materials: e.target.value })} className={input} /></Field>
              <Field label="Link"><input type="url" value={edit.link} onChange={e => setEdit({ ...edit, link: e.target.value })} className={input} /></Field>
            </>
          )}
          {inCalendar && <p className="px-1 text-[13px] text-pc-text-muted">E deja în calendar: după o schimbare de dată sau oră, scoate-l și pune-l din nou.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEdit(null)} className="press h-12 flex-1 rounded-[12px] bg-pc-surface text-[16px]">Renunță</button>
            <button type="button" disabled={!!busy || !edit.title.trim()} onClick={() => void save()} className="press h-12 flex-1 rounded-[12px] bg-pc-accent text-[16px] font-semibold text-[var(--pc-on-accent)] disabled:opacity-50">
              {saving ? 'Se salvează…' : 'Salvează'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3 divide-y divide-[var(--pc-separator)]">
          {when && <Fact label={kind === 'activity' ? 'Orar' : 'Când'}>{when}</Fact>}
          {kind === 'activity' && (item.season_from || item.season_to) && <Fact label="Sezon">{[item.season_from && `din ${shortDate(item.season_from)}`, item.season_to && `până pe ${shortDate(item.season_to)}`].filter(Boolean).join(' ')}</Fact>}
          {item.place && <Fact label="Unde">{item.place}</Fact>}
          {item.who && <Fact label="Cine">{WHO_LABEL[item.who]}</Fact>}
          {item.bring && <Fact label="De luat">{item.bring}</Fact>}
          {item.rsvp && <Fact label="Răspuns">{RSVP_LABEL[item.rsvp]}</Fact>}
          {item.cost && <Fact label="Cost">{item.cost}</Fact>}
          {item.contact && <Fact label="Contact">{item.contact}</Fact>}
          {item.materials && <Fact label="Materiale">{item.materials}</Fact>}
          {!!item.tags?.length && <Fact label="Etichete">{item.tags.join(', ')}</Fact>}
          {item.link && <Fact label="Link"><a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-[var(--pc-accent-ink)] underline">{item.link.replace(/^https?:\/\//, '').slice(0, 60)} <ExternalLink size={13} /></a></Fact>}
        </div>
      )}

      {kind === 'plan' && !edit && (
        <section className="mb-4">
          <h3 className="mb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-pc-text-secondary">Pași</h3>
          {steps.length === 0 && <p className="text-[15px] text-pc-text-muted">Niciun pas încă · spune-i asistentului ce e de făcut pentru el.</p>}
          {steps.map(s => <KidRow key={s.id} item={s} kids={kids} mode={mode} today={list.today} onOpen={onOpen} onDone={x => void onAct(x, 'done').catch(() => undefined)} showDue />)}
        </section>
      )}

      {error && <p className="mb-2 text-[15px] text-red-500" role="alert">{error}</p>}

      {!edit && (open ? (
        <>
          {doable ? (
            <button type="button" disabled={!!busy} onClick={() => void run('done')} className={primary}>
              <Check size={19} strokeWidth={2.5} /> {kind === 'plan' ? 'Plan încheiat' : 'Făcut'}
            </button>
          ) : kind === 'idea' ? (
            <button type="button" disabled={!!busy} onClick={() => void run('edit', { tried: !item.tried })} className={item.tried ? plain : primary}>
              <Check size={19} strokeWidth={2.5} /> {item.tried ? `Încercată pe ${shortDate(item.tried)} · Anulează` : 'Am încercat-o'}
            </button>
          ) : calendarButton(true)}
          {doable && canCalendar && <div className="mt-2">{calendarButton(false)}</div>}
          {kind === 'idea' && (
            <button type="button" disabled={!!busy} onClick={() => void run('edit', { loved: !item.loved })} className={`${plain} mt-2`}>
              <Heart size={18} className="text-[#c2477f]" fill={item.loved ? 'currentColor' : 'none'} /> {item.loved ? 'Le-a plăcut' : 'Le-a plăcut?'}
            </button>
          )}
          <div className={`mt-2 grid gap-2 ${kind === 'task' ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <button type="button" onClick={() => onAsk(item)} className={secondary}><MessageSquare size={19} className="text-pc-accent" /> Întreabă</button>
            {kind === 'task' && <button type="button" disabled={!!busy} onClick={() => void run('snooze', { days: 3 })} className={secondary}><Clock size={19} className="text-pc-accent" /> Amână 3 zile</button>}
            <button type="button" onClick={() => setEdit(draftOf(item))} className={secondary}><Pencil size={19} className="text-[var(--pc-accent-ink)]" /> Editează</button>
            <button type="button" disabled={!!busy} onClick={() => void run('drop')} className={secondary}><Ban size={19} className="text-pc-text-muted" /> {kind === 'activity' ? 'S-a terminat' : 'Nu mai e nevoie'}</button>
          </div>
        </>
      ) : (
        <button type="button" disabled={!!busy} onClick={() => void run('reopen')} className={plain}>
          <Undo2 size={18} /> Redeschide
        </button>
      ))}

      <section className="mt-5 pb-4">
        <h3 className="mb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-pc-text-secondary">Note</h3>
        {item.notes && <p className="mb-2 whitespace-pre-wrap rounded-[12px] bg-pc-surface px-3 py-2 text-[15px] leading-snug">{item.notes}</p>}
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="O notă: ce s-a stabilit, cu cine ai vorbit" aria-label="Notă nouă"
          className="w-full resize-none rounded-[12px] border border-pc-border-strong bg-pc-surface px-3 py-2 text-[16px] outline-none focus:border-pc-accent" />
        {note.trim() && (
          <button type="button" disabled={!!busy} onClick={() => void addNote()} className="press mt-2 h-12 w-full rounded-[12px] bg-pc-surface text-[16px] font-semibold text-[var(--pc-accent-ink)] disabled:opacity-50">
            {saving ? 'Se salvează…' : 'Adaugă nota'}
          </button>
        )}
      </section>

      {footer && <div className="sticky bottom-0 -mx-4 bg-pc-elevated pt-1 pb-[env(safe-area-inset-bottom)]">{footer}</div>}
    </Sheet>
  );
}
