/**
 * Dev-only harness (vite dev, /tools/harness/today.html): Today v2 with sample data, to measure at the test sizes without the
 * gateway or the desk API. ?state=empty|loading|full, ?theme=dark, ?menu=1 opens a tile's menu.
 */
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import '../../src/index.css';
import { PileSheet, TileMenu, TodayV2 } from '../../src/app/TodayV2';
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
const face = (_letters: string, _color: string, name: string, object?: string): Face => ({ name, object: object ?? 'doc' });
let id = 0;
const item = (o: Partial<NowItem>): NowItem => ({ id: `tsk-2026-11-05-${String(++id).padStart(6, '0')}`, title: '', kind: 'task', store: 'tasks', scope: 'shared', status: 'todo', priority: 'P3', weight: 1, section: 'later', ...o });
const full: TodayData = {
  today, last_open: null, day: { date: today, crucial: [] },
  crucial: [
    item({ n: 159, glance_title: 'Trimite plicul CPAM', title: 'Trimite plicul cu cererea la **CPAM**', due_date: day(-2), face: face('CP', '#1d6fb8', 'CPAM', 'envelope') }),
    item({ n: 130, glance_title: 'Confirmă lui Bérenger', title: 'Confirmă lui **Bérenger**', due_date: day(-6), face: face('BC', '#3d5a80', 'BC Immobilier', 'phone') }),
  ],
  todo: [
    item({ n: 28, glance_title: 'Bonus SFR · scrisoare', due_date: day(12), face: face('SF', '#a8326e', 'SFR', 'stack') }),
    item({ n: 128, glance_title: 'Dr Myers · vaccinuri', due_date: day(-6), face: face('DM', '#0e7c66', 'Dr Myers', 'phone') }),
    item({ n: 134, glance_title: 'Flavi · IBM', due_date: day(-3), face: face('FL', '#7c5cd6', 'Flavi') }),
    item({ n: 164, glance_title: 'Export Lucidchart', due_date: day(4), face: face('LU', '#b25a00', 'Lucidchart') }),
    item({ n: 151, glance_title: 'Plantează semințele', due_date: day(3), face: face('', '#5c6b1f', '', 'pot') }),
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
const data = state === 'loading' ? null : state === 'empty' ? { ...full, crucial: [], todo: [], passing_by: [], later_count: 0 } : full;

function Harness() {
  const [menu, setMenu] = useState<NowItem | null>(q.get('menu') ? full.todo[0] : null);
  return (
    <div style={{ ...lookVars(mode, 'pink'), ...(q.get('w') ? { width: Number(q.get('w')) } : {}) }} className="flex h-dvh flex-col bg-pc-base text-pc-text antialiased">
      <div className="min-h-0 flex-1">
        <TodayV2 data={data} mode={mode} initial="L" onEverything={() => {}} onSettings={() => {}} onDone={() => {}} onOpen={() => {}} onMenu={setMenu} />
      </div>
      <div className="shrink-0 border-t border-pc-border bg-pc-base p-2"><textarea rows={1} placeholder="Say or type it" className="block w-full resize-none rounded-[12px] bg-pc-surface p-3 text-[16px]" /></div>
      {q.get('pile') && <PileSheet items={full.later ?? []} today={today} onClose={() => {}} onOpen={() => {}} />}
      {q.get('chat') && (
        <div className="absolute inset-0 z-50 space-y-3 bg-pc-base p-3">
          <div className="flex justify-end gap-1.5"><div className="rounded-[20px] rounded-tr-md bg-[#ffe3ef] px-3 py-1.5 text-[16px] text-[#1c1c1e]">sa sun la primaria maine</div><PersonMark name="Lucian" /></div>
          <div className="flex gap-1.5"><CoachMark /><div className="min-w-0 flex-1"><ChangeCard n={204} title="Primăria · sună pentru act" face={{ object: 'phone' }} line="Added · tomorrow" onUndo={() => {}} onShow={() => {}} /></div></div>
          <div className="flex gap-1.5"><PersonMark name="Ludmila" /><span className="text-[13px]">Ludmila's disc</span></div>
          <div className="flex items-center gap-1.5"><CoachMark thinking /><span className="text-[13px]">thinking</span></div>
          <div className="flex items-end gap-3">{(['envelope', 'letter', 'stack', 'folder', 'phone', 'person'] as const).map(o => <ObjectFace key={o} face={{ object: o }} size={44} />)}<ObjectFace face={{ mono: 'CA' }} size={44} /></div>
        </div>
      )}
      {menu && <TileMenu item={menu} position={0} count={6} isCrucial={false} crucial={full.crucial} onClose={() => setMenu(null)}
        onCrucial={() => Promise.reject(new Error('two already'))} onMove={() => {}} onLater={() => {}} onOpen={() => {}} onDrop={() => {}} />}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
