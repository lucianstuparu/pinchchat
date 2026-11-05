/**
 * Dev-only harness (vite dev, /tools/harness/today.html): Today v2 with sample data, to measure at the test sizes without the
 * gateway or the desk API. ?state=empty|loading|full, ?theme=dark, ?menu=1 opens a tile's menu.
 */
import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import '../../src/index.css';
import { TileMenu, TodayV2 } from '../../src/app/TodayV2';
import { lookVars } from '../../src/app/themes';
import type { Face, NowItem, TodayData } from '../../src/app/api';

document.documentElement.style.fontSize = '16px';   // as the app (useExactSizes)
const q = new URLSearchParams(location.search);
const mode = q.get('theme') === 'dark' ? 'dark' : 'light';
const state = q.get('state') ?? 'full';
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const face = (letters: string, color: string, name: string, object?: string): Face => ({ letters, color, name, ...(object ? { object } : {}) });
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
  later_count: 23,
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
      {menu && <TileMenu item={menu} position={0} count={6} isCrucial={false} crucial={full.crucial} onClose={() => setMenu(null)}
        onCrucial={() => Promise.reject(new Error('two already'))} onMove={() => {}} onLater={() => {}} onOpen={() => {}} onDrop={() => {}} />}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
