/**
 * Dev-only harness (vite dev, /tools/harness/today.html): Today v2 with sample data, to measure at the test sizes without the
 * gateway or the desk API. ?state=empty|loading|full, ?theme=dark, ?menu=1 opens a tile's menu, ?sheet=step|none|running|promise|parked|watch opens item sheet v2, ?tell=1 the Tell sheet, ?away=1 adds the card after an absence.
 */
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import '../../src/index.css';
import { TileMenu, TodayV2 } from '../../src/app/TodayV2';
import { ItemSheetV2 } from '../../src/app/ItemSheetV2';
import { TellSheet } from '../../src/app/TellSheet';
import { ChangeCard } from '../../src/app/ChangeCards';
import { CoachMark, PersonMark } from '../../src/app/avatars';
import { lookVars } from '../../src/app/themes';
import { ObjectFace } from '../../src/kit2/ObjectFace';
import type { Face, NowItem, TodayData } from '../../src/app/api';

document.documentElement.style.fontSize = '16px';   // as the app (useExactSizes)
const q = new URLSearchParams(location.search);
const mode = q.get('theme') === 'dark' ? 'dark' : 'light';
const state = q.get('state') ?? 'full';
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const face = (letters: string, color: string, name: string, object?: string): Face => (['CPAM', 'SFR', 'AWS', 'EDF', 'Anthropic'].includes(name) ? { name, mono: letters, mono_color: color } : { name, object: object ?? 'doc' });
let id = 0;
const item = (o: Partial<NowItem>): NowItem => ({ id: `tsk-2026-11-05-${String(++id).padStart(6, '0')}`, title: '', kind: 'task', store: 'tasks', scope: 'shared', status: 'todo', priority: 'P3', weight: 1, section: 'later', ...o });
const full: TodayData = {
  today, last_open: null, day: { date: today, crucial: [] },
  crucial: [
    item({ n: 159, glance_title: 'Trimite cererea', glance_key: 'cererea', title: 'Trimite plicul cu cererea la **CPAM**', due_date: day(-2), face: face('CP', '#1d6fb8', 'CPAM', 'envelope') }),
    item({ n: 130, glance_title: 'Confirmă lui Bérenger', glance_key: 'Bérenger', title: 'Confirmă lui **Bérenger**', due_date: day(-6), face: face('BC', '#3d5a80', 'BC Immobilier', 'phone') }),
  ],
  todo: [
    item({ n: 28, glance_title: 'Scrie scrisoarea', glance_key: 'scrisoarea', due_date: day(12), face: face('SF', '#a8326e', 'SFR', 'stack') }),
    item({ n: 128, glance_title: 'Dr Myers · vaccinuri', glance_key: 'vaccinuri', due_date: day(-6), face: face('DM', '#0e7c66', 'Dr Myers', 'phone') }),
    item({ n: 134, glance_title: 'Flavi · IBM', due_date: day(-3), face: face('FL', '#7c5cd6', 'Flavi') }),
    item({ n: 164, glance_title: 'Export Lucidchart', due_date: day(4), face: face('LU', '#b25a00', 'Lucidchart') }),
    item({ n: 151, glance_title: 'Plantează semințele', glance_key: 'semințele', due_date: day(3), face: face('', '#5c6b1f', '', 'pot') }),
    item({ n: 168, glance_title: 'Prăjituri pentru Lia', due_date: today, section: 'today', face: face('PA', '#b25a00', 'patiserie') }),
  ],
  passing_by: [
    item({ n: 162, kind: 'bill', amount: 10, currency: 'USD', due_date: today, automatic: true, face: face('AW', '#b25a00', 'AWS') }),
    item({ n: 165, kind: 'bill', amount: 1106.68, currency: 'EUR', due_date: day(12), automatic: true, face: face('ED', '#1d6fb8', 'EDF') }),
    item({ n: 19, kind: 'bill', amount: 14.99, currency: 'EUR', automatic: true, face: face('SF', '#a8326e', 'SFR') }),
    item({ n: 15, kind: 'bill', amount: 108.9, currency: 'EUR', due_date: day(12), automatic: true, face: face('AN', '#7c5cd6', 'Anthropic') }),
    item({ n: 29, kind: 'bill', amount: 59.99, currency: 'RON', due_date: day(18), automatic: true, face: face('GP', '#0e7c66', 'Google Play') }),
  ],
  later_count: 5,
  later: [
    item({ n: 41, title: 'x', glance_title: 'Casa Artlia · verifică oferta', domain: 'casa-artlia', status: 'waiting', waits_for: 'Crédit Mutuel', due_date: day(-6), face: { name: 'Crédit Mutuel', object: 'letter' } }),
    item({ n: 42, title: 'x', glance_title: 'Scara · măsoară treptele', domain: 'casa-artlia', face: { mono: 'CA' } }),
    item({ n: 43, title: 'x', glance_title: 'Bérenger · confirmă creditul', status: 'waiting', waiting_since: day(-6), face: { name: 'Bérenger', object: 'person' } }),
    item({ n: 44, title: 'x', glance_title: 'Primăria · sună pentru act', due_date: day(-11), face: { object: 'phone' } }),
    item({ n: 45, title: 'x', glance_title: 'Chitara · caută profesor', face: { mono: 'CH' } }),
  ],
};
// The bands of plan 02.
const realms = ['desk', 'casa-artlia', 'finance', 'people', 'projects', 'house', 'other'];
[...full.crucial, ...full.todo, ...(full.later ?? []), ...full.passing_by].forEach((i, x) => { i.realm_id = realms[x % realms.length]; i.matter = (i.glance_title ?? '').split(' · ')[1] ? (i.glance_title ?? '').split(' · ')[0] : i.face?.name; if (x % 2 === 0) i.step = { first: 'Open it', minutes: 3 + x, where: x % 4 ? 'phone' : 'laptop', by: 'coach' }; });
full.must = [item({ n: 183, glance_title: 'Frizer · programează tunsoarea', glance_key: 'tunsoarea', due_date: today, section: 'today', face: { object: 'phone' }, step: { first: 'Call', minutes: 3, where: 'phone' } })];
full.waiting_you = [
  item({ n: 130, glance_title: 'Bérenger · confirmă creditul', status: 'waiting', promise: { to: 'Bérenger Marchand', said: 'by Thursday', by: day(-1), on: day(-6) }, realm_id: 'casa-artlia' }),
  item({ n: 131, glance_title: 'Sara · RSVP', promise: { to: 'Sara', on: day(-9) }, realm_id: 'people' }),
];
full.top = [item({ n: 200, glance_title: 'Ușa · alege modelul', face: { object: 'door' }, promise: { to: 'Bérenger', told: [{ at: new Date().toISOString(), kind: 'late', how: 'sent' }] }, step: { first: 'Open', minutes: 10, where: 'laptop' }, realm_id: 'house' })];
full.worth = [item({ n: 210, glance_title: 'Export · păstrează istoricul', parked: { on: day(-3), why: 'saves ten minutes a week' }, realm_id: 'projects' })];
full.parked = full.worth;
full.passed_by = [item({ n: 1, glance_title: 'EDF · pay electricity', due_date: day(-9), automatic: true, face: { mono: 'EDF', mono_color: '#fe5716' }, realm_id: 'desk' })];
full.done_today = [item({ n: 300, glance_title: 'Plic · trimis', status: 'done' })];
if (q.get('away')) full.away = { days: 3, more: 2, lines: [
  { id: 'a', text: 'missed · Trimite plicul CPAM', missed: true, face: { object: 'envelope' } },
  { id: 'b', text: 'Crédit Mutuel · verifică oferta: waiting', face: { mono: 'CM', mono_color: '#c8102e' } },
  { id: 'c', text: 'AWS passed by', face: { mono: 'aws', mono_color: '#ff9900' } },
  { id: 'd', text: 'Bérenger is waiting for your answer', face: { object: 'person' } },
], way_back: { id: 'a', label: 'Check the offer', minutes: 5 } };
// Item sheet v2 and the Tell sheet read through the API: answered here, nothing leaves the page.
const sheetMode = q.get('sheet');
const sheetItem: Record<string, unknown> = { id: 'tsk-2026-11-05-000001', n: 28, title: 'Scrisoare **SFR** pentru bonusul de 300 €', status: 'todo', store: 'tasks', scope: 'private', kind: 'task', due_date: day(11), notes: 'Letter drafted on 2 Nov. | parked idea', payee: 'SFR', amount: 300, currency: 'EUR',
  ...(sheetMode === 'none' ? {} : { step: { first: 'Citește scrisoarea, trimite-o recomandat', verb: 'Citește', minutes: 3, where: 'phone', shape: 'awkward', by: sheetMode === 'yours' ? 'person' : 'coach', why: 'cuvintele sunt scrise', draft: sheetMode === 'running' ? 'Madame, Monsieur, je vous écris au sujet de la reprise de 300 €.' : undefined, recovery: 'if it goes badly: Médiateur, within two months', ...(sheetMode === 'running' ? { started: new Date(Date.now() - 300_000).toISOString() } : {}) },
    alternatives: [{ first: 'Sună SFR, scriptul e gata', why: 'au răspuns la telefon data trecută' }, { first: 'Așteaptă cei 27 € de la Certideal', why: 'riscă fereastra de două luni' }] }),
  ...(sheetMode === 'promise' ? { promise: { to: 'Bérenger', said: 'by Thursday', by: day(-1), on: day(-6), told: [] } } : {}),
  ...(sheetMode === 'parked' ? { parked: { on: day(-2), why: 'saves ten minutes a week' } } : {}),
  ...(sheetMode === 'watch' ? { kind: 'watch', status: 'watching' } : {}) };
const realFetch = window.fetch;
window.fetch = async (url, init) => {
  const u = String(url);
  const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/reg/item')) return json({ today, item: sheetItem, origin: null, face: { object: 'stack', mono: 'SFR', mono_color: '#e2001a' }, glance_title: 'SFR · trimite scrisoarea', realm_id: 'desk',
    matter: { name: 'SFR', things: 8, state: 'in hand', brief: { purpose: 'get the 300 € bonus SFR refused on 22 Oct', state: 'Letter drafted, review and send', tried: ['chat + callback, 27 Oct: verbal yes only'], ruled_out: ['waiting for an e-mail: they never sent one'], confirmed: [{ date: day(11), what: 'your deadline' }], estimated: [{ date: day(46), what: 'Médiateur window' }], evidence: ['Certideal mails 19.09, 25.09'], open: ['Is it two months or 60 days?'], written_on: day(-1), written_by: 'coach' } } });
  if (u.includes('/reg/tell')) return json({ to: 'Bérenger', contact: q.get('tell') === 'copy' ? null : { id: 'c', name: 'Bérenger', lang: 'fr', channel: 'whatsapp', phone: true }, text: 'Bonjour Bérenger, désolé pour le retard. Le crédit est approuvé, je vous confirme les détails.' });
  if (u.includes('/reg/')) return json({ ok: true });
  return realFetch(url, init);
};
const data = state === 'loading' ? null : state === 'empty' ? { ...full, crucial: [], todo: [], passing_by: [], later_count: 0 } : full;

function Harness() {
  const [menu, setMenu] = useState<NowItem | null>(q.get('menu') ? full.todo[0] : null);
  return (
    <div style={{ ...lookVars(mode, 'pink'), ...(q.get('w') ? { width: Number(q.get('w')) } : {}) }} className="flex h-dvh flex-col bg-pc-base text-pc-text antialiased">
      <div className="min-h-0 flex-1">
        <TodayV2 data={data} mode={mode} initial="L" onSettings={() => {}} onDone={() => {}} onOpen={() => {}} onMenu={setMenu} />
      </div>
      <div className="shrink-0 border-t border-pc-border bg-pc-base p-2"><textarea rows={1} placeholder="Say or type it" className="block w-full resize-none rounded-[12px] bg-pc-surface p-3 text-[16px]" /></div>
      {sheetMode && <ItemSheetV2 id="tsk-2026-11-05-000001" person="lucian" crucialIds={q.get('two') ? ['a', 'b'] : []} onClose={() => {}} onChanged={() => {}} onAsk={() => {}} onActed={() => {}} onCrucial={() => Promise.resolve()} onTell={() => {}} />}
      {q.get('tell') && <TellSheet id="tsk-2026-11-05-000001" title="Bérenger · confirmă creditul" kind="late" name="Bérenger" person="lucian" onClose={() => {}} onDone={() => {}} />}
      {q.get('chat') && (
        <div className="absolute inset-0 z-50 space-y-3 bg-pc-base p-3">
          <div className="flex justify-end gap-1.5"><div className="rounded-[20px] rounded-tr-md bg-[#f1f0f3] px-3 py-1.5 text-[16px] text-[#1c1c1e]">sa sun la primaria maine</div><PersonMark name="Lucian" /></div>
          <div className="flex gap-1.5"><CoachMark /><div className="min-w-0 flex-1"><ChangeCard n={204} title="Primăria · sună pentru act" face={{ object: 'phone' }} line="Added · tomorrow" onOpen={() => { document.title = 'opened'; }} onUndo={() => {}} onShow={() => {}} /></div></div>
          <div className="flex gap-1.5"><PersonMark name="Ludmila" /><span className="text-[13px]">Ludmila's disc</span></div>
          <div className="flex items-center gap-1.5"><CoachMark thinking /><span className="text-[13px]">thinking</span></div>
          <div className="flex items-end gap-3">{(['envelope', 'letter', 'stack', 'folder', 'phone', 'person'] as const).map(o => <ObjectFace key={o} face={{ object: o }} size={44} />)}<ObjectFace face={{ mono: 'CA' }} size={44} /><ObjectFace face={{ mono: 'aws', mono_color: '#ff9900' }} size={44} /><ObjectFace face={{ object: 'envelope', mono: 'SFR', mono_color: '#e2001a' }} size={44} /></div>
        </div>
      )}
      {menu && <TileMenu item={q.get('menu') === 'promise' ? full.waiting_you![0] : menu} today={today} onTop={() => {}} onTell={() => {}} position={0} count={6} isCrucial={false} crucial={full.crucial} onClose={() => setMenu(null)}
        onCrucial={() => Promise.reject(new Error('two already'))} onMove={() => {}} onLater={() => {}} onOpen={() => {}} onDrop={() => {}} />}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
