/**
 * Dev-only harness (vite dev, /tools/harness/todo.html): To do and the item sheet with sample data, to
 * measure layouts at phone sizes without the gateway or the desk API. ?sheet=<id> opens an item.
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../src/index.css';
import { TodoPanel, type TodoTab } from '../../src/app/Todo';
import { ItemSheet } from '../../src/app/ItemSheet';
import type { NowItem } from '../../src/app/api';

const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const item = (o: Partial<NowItem>): NowItem => ({ id: 'tsk-x', title: '', kind: 'task', store: 'tasks', scope: 'private', status: 'todo', priority: 'P3', weight: 1, section: 'later', ...o });
const items = [
  item({ id: 'tsk-2026-11-01-000001', n: 139, title: 'Răspunde lui **Cécile Fouillet** (notară): răspunsul la scrisoare', due_date: day(2), section: 'week', topics: ['Admin'] }),
  item({ id: 'tsk-2026-11-01-000002', n: 160, title: 'Plătește chiria către **Patricia**', due_date: day(1), section: 'week', topics: ['Money'], amount: 1450, currency: 'EUR' }),
  item({ id: 'tsk-2026-11-01-000003', n: 151, title: 'Plantează semințele de toamnă', due_date: day(7), section: 'week', topics: ['Home'] }),
];
const watch = {
  upcoming: [
    item({ id: 'tsk-2026-11-01-00000a', n: 31, kind: 'watch', status: 'watching', title: '**EDF** takes 142 €', due_date: day(2), amount: 142, currency: 'EUR', place: 'contul comun', check: 'enough on the joint account' }),
    item({ id: 'tsk-2026-11-01-00000b', n: 32, kind: 'watch', status: 'watching', title: 'Parcel from **Fnac** with the new headphones for the office', due_date: day(5) }),
    item({ id: 'tsk-2026-11-01-00000c', n: 33, kind: 'watch', status: 'watching', title: '**Canal+** renews', due_date: day(11), amount: 24.99, currency: 'EUR' }),
  ],
  passed: [item({ id: 'tsk-2026-11-01-00000d', n: 30, kind: 'watch', status: 'passed', title: '**Free** takes 30 €', due_date: day(-3), amount: 29.99, currency: 'EUR' })],
};
const all = [...items, ...watch.upcoming, ...watch.passed];

// The desk API, answered here.
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.endsWith('/reg/item')) {
    const id = JSON.parse(String(init?.body ?? '{}')).item;
    const it = all.find(i => i.id === id) ?? all[0];
    return new Response(JSON.stringify({ today, item: { ...it, repeat: it.n === 31 ? { n: 1, unit: 'month' } : undefined }, origin: null }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (url.endsWith('/reg/act')) return new Response(JSON.stringify({ ok: true, status: 'todo', title: 'x' }), { headers: { 'Content-Type': 'application/json' } });
  return realFetch(input, init);
};

function Harness() {
  const [tab, setTab] = useState<TodoTab>('todo');
  const [sheet, setSheet] = useState<string | null>(new URLSearchParams(location.search).get('sheet'));
  const dark = new URLSearchParams(location.search).has('dark');
  document.documentElement.classList.toggle('dark', dark);
  return (
    <div className="h-[100dvh] bg-pc-base text-pc-text">
      <TodoPanel mode={dark ? 'dark' : 'light'} tab={tab} onTab={setTab} items={items} watch={watch} loops={[]} today={today}
        loaded expired={false} refreshing={false} onRefresh={() => undefined} onDone={() => undefined} onStar={() => undefined}
        onOpen={setSheet} onContinue={() => undefined} onAdd={() => undefined} transcribe={async () => ''} reply={null}
        onDismissReply={() => undefined} onClose={() => undefined} />
      {sheet && <ItemSheet id={sheet} onClose={() => setSheet(null)} onChanged={() => undefined} onAsk={() => undefined} />}
    </div>
  );
}

void React;
ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
