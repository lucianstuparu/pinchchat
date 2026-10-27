import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, ListTodo, Mail, MessageSquare, Pause, Play, Square } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { post, formatDay } from './api';
import { UndoBar, type UndoInfo } from './UndoBar';

/**
 * Mail rules (Lucian 2026-10-27: "vreau să am un loc în oc să văd și regulile active, pot să am multe"):
 * made in the chat ("when Cărturești writes that the books are in the easybox, remind me to write to Marius"),
 * checked every 5 minutes on CT 103 (mail-rules.mjs). Here: every rule, what it waits for, what it does,
 * what it last matched and what it said no to; pause, resume and stop, each with Undo.
 */
interface Seen { at: string; subject: string; from?: string; why?: string; task?: { n?: number } | null }
export interface MailRule {
  id: string; title: string; query: string; expect: string; notify: string;
  task: { title: string; priority: string } | null; once: boolean; accounts: string[];
  /** A message prepared in Relay on a yes (sent only by a tap on Send there). */
  message?: { contact: string; label: string; channel: string; text: string } | null;
  status: 'active' | 'paused' | 'stopped' | 'done'; created: string; checked_at: string | null;
  fired: Seen[]; skipped: Seen[]; checked: number;
}
type RuleAction = 'pause' | 'resume' | 'stop';

const fetchRules = () => post<{ rules: MailRule[] }>('/reg/rules', {}).then(r => r.rules);
const changeRule = (rule: string, action: RuleAction) => post<{ ok: boolean; rule: MailRule }>('/reg/rules/act', { rule, action });

const time = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : formatDay(iso);
};

const GROUPS: Array<{ title: string; has: (r: MailRule) => boolean }> = [
  { title: 'Watching', has: r => r.status === 'active' },
  { title: 'Paused', has: r => r.status === 'paused' },
  { title: 'Finished', has: r => r.status === 'done' || r.status === 'stopped' },
];
const DONE_LABEL: Record<RuleAction, string> = { pause: 'Paused', resume: 'Watching again', stop: 'Stopped' };

function RuleRow({ rule, onAct }: { rule: MailRule; onAct: (a: RuleAction) => void }) {
  const [open, setOpen] = useState(false);
  const last = rule.fired[rule.fired.length - 1];
  const status = last ? `Matched ${time(last.at)}: ${last.subject}`
    : rule.status === 'stopped' ? 'Stopped'
    : rule.checked_at ? `Checked ${time(rule.checked_at)}${rule.skipped.length ? ` · ${rule.skipped.length} not it` : ' · nothing yet'}` : 'Not checked yet';
  const btn = 'press flex h-10 items-center gap-1.5 rounded-[8px] px-3 text-[15px] font-medium';
  return (
    <div className="px-4 py-3">
      <button type="button" onClick={() => setOpen(o => !o)} className="block w-full text-left" aria-expanded={open}>
        <p className="text-[16px] font-semibold leading-snug">{rule.title}</p>
        <p className={`mt-0.5 text-[14px] leading-snug text-pc-text-muted ${open ? '' : 'line-clamp-2'}`}>{rule.expect}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-pc-text-muted">
          <span className="flex items-center gap-1"><Bell size={13} /> {rule.notify}</span>
          {rule.task && <span className="flex items-center gap-1"><ListTodo size={13} /> {rule.task.priority} · {rule.task.title}</span>}
        </p>
        {rule.message && <p className={`mt-1 flex items-start gap-1 text-[13px] text-pc-text-muted ${open ? '' : 'line-clamp-1'}`}><MessageSquare size={13} className="mt-0.5 shrink-0" /> <span>To {rule.message.label}, ready in Relay: “{rule.message.text}”</span></p>}
        <p className={`mt-1 truncate text-[13px] ${last ? 'text-pc-accent' : 'text-pc-text-faint'}`}>{status}</p>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[13px]">
          <p className="flex items-center gap-1.5 text-pc-text-muted"><Mail size={13} /> <code className="truncate">{rule.query}</code>
            <span className="shrink-0">· {rule.once ? 'once' : 'every time'}</span></p>
          {[...rule.fired].reverse().map(f => (
            <p key={f.at} className="leading-snug"><span className="text-pc-accent">{time(f.at)} yes:</span> {f.subject}{f.why ? <span className="text-pc-text-muted"> — {f.why}</span> : null}</p>
          ))}
          {[...rule.skipped].reverse().map(s => (
            <p key={s.at + s.subject} className="leading-snug text-pc-text-muted">{time(s.at)} not it: {s.subject}{s.why ? ` — ${s.why}` : ''}</p>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        {rule.status === 'active' && <button type="button" className={`${btn} bg-pc-surface`} onClick={() => onAct('pause')}><Pause size={15} /> Pause</button>}
        {rule.status !== 'active' && <button type="button" className={`${btn} bg-pc-surface`} onClick={() => onAct('resume')}><Play size={15} /> {rule.status === 'paused' ? 'Resume' : 'Watch again'}</button>}
        {(rule.status === 'active' || rule.status === 'paused') && <button type="button" className={`${btn} text-red-500`} onClick={() => onAct('stop')}><Square size={14} /> Stop</button>}
      </div>
    </div>
  );
}

export function RulesSheet({ mode, onClose }: { mode: 'light' | 'dark'; onClose: () => void }) {
  const [rules, setRules] = useState<MailRule[] | null>(null);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const undoKey = useRef(0);
  const load = useCallback(() => fetchRules().then(r => { setRules(r); setError(''); }).catch(e => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  const act = async (rule: MailRule, action: RuleAction, undoable = true) => {
    try {
      await changeRule(rule.id, action);
      await load();
      // Undo puts it back as it was: a paused rule resumes, a resumed one goes back to paused or stopped.
      const back: RuleAction = action === 'resume' ? (rule.status === 'paused' ? 'pause' : 'stop') : 'resume';
      if (undoable) setUndo({ key: ++undoKey.current, label: `${DONE_LABEL[action]}: ${rule.title}`, undo: () => void act({ ...rule, status: action === 'pause' ? 'paused' : action === 'stop' ? 'stopped' : 'active' }, back, false) });
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Sheet label="Mail rules" onClose={onClose} className={`flex max-h-[92dvh] flex-col px-4 pt-2 md:max-w-md ${mode === 'dark' ? 'bg-[#000]' : 'bg-[#f2f2f7]'}`}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="text-[22px] font-bold">Mail rules</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="mb-4 text-[13px] leading-snug text-pc-text-muted">
          Say it in the chat: “when Cărturești writes that the books are in the easybox, remind me to write to Marius”.
          Your mail is checked every 5 minutes; a small model reads each new match and only a real one notifies you.
        </p>
        {error && <p className="mb-3 text-[14px] text-red-500">{error}</p>}
        {rules === null && !error && <p className="text-[14px] text-pc-text-muted">Loading…</p>}
        {rules?.length === 0 && <p className="text-[15px] text-pc-text-muted">No rules yet.</p>}
        {rules && GROUPS.map(g => {
          const list = rules.filter(g.has).sort((a, b) => b.created.localeCompare(a.created));
          if (!list.length) return null;
          return (
            <section key={g.title} className="mb-6">
              <h3 className="mb-1.5 px-4 text-[13px] text-pc-text-muted">{g.title} · {list.length}</h3>
              <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-elevated">
                {list.map(r => <RuleRow key={r.id} rule={r} onAct={a => void act(r, a)} />)}
              </div>
            </section>
          );
        })}
      </div>
      <UndoBar info={undo} onClose={() => setUndo(null)} />
    </Sheet>
  );
}
