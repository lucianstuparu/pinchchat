/**
 * Dev-only harness (vite dev, /tools/harness/artlia.html): Casa Artlia's rows with sample data, to measure at the test sizes
 * without the gateway or the API. ?theme=dark. Pictures: the ones the app draws itself; logos and drawings come from the server.
 */
import ReactDOM from 'react-dom/client';
import '../../src/index.css';
import { NowView } from '../../src/artlia/Lists';
import { lookVars } from '../../src/app/themes';
import type { ArtItem, Category } from '../../src/artlia/api';

document.documentElement.style.fontSize = '16px';
const q = new URLSearchParams(location.search);
const mode = q.get('theme') === 'dark' ? 'dark' : 'light';
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
document.documentElement.classList.toggle('dark', mode === 'dark');
for (const [k, v] of Object.entries(lookVars(mode, 'teal'))) document.documentElement.style.setProperty(k, String(v));   // on the root, as the app: the colour utilities resolve there

const cats: Category[] = [{ id: 'erp', label: 'ERP', order: 1 }, { id: 'banca', label: 'Bancă', order: 2 }, { id: 'lucrari', label: 'Lucrări', order: 3 }];
let n = 30;
const it = (glance: string | undefined, title: string, object: string, o: Partial<ArtItem> = {}): ArtItem =>
  ({ id: `art-${++n}`, n, title, glance_title: glance, cat: 'erp', status: 'todo', face: { object }, ...o });
const items: ArtItem[] = [
  it('Asigurări · răspuns bancă', 'Răspunde băncii despre **asigurările** legate de oferta de credit', 'envelope', { cat: 'banca', due_date: day(0) }),
  it('Ușa de intrare · devis', 'Ușa de intrare: măsurători și oferta (devis)', 'door', { due_date: day(1), focus: today }),
  it('Platforma · contact firme', 'Platforma: contactează 1-2 firme (RAF, PREMIER Ascenseurs, Lift Concept)', 'phone', { cat: 'lucrari', due_date: day(4) }),
  it('Primar · vizita securitate', 'Cereți primarului vizita de securitate cu cel puțin o lună înainte', 'calendar', { due_date: day(5), priority: 'P1' }),
  it('Rapoarte la SDIS, 8 zile', 'Trimiteți rapoartele și certificatele de foc la SDIS cu 8 zile înainte', 'stack', { due_date: day(6) }),
  it(undefined, 'Confirmați că **hidrantul** aflat la sub 200 m asigură 60 m³/h, titlu încă fără etichetă scurtă', 'doc', { due_date: day(14) }),
  it('Cont bancar SCI · capital', 'Creează contul bancar SCI și depune capitalul social de 1 000 €', 'folder', { cat: 'banca', due_date: day(16), status: 'waiting' }),
  it('EDFICO · cifra include TVA?', 'Prévisionnel EDFICO: cifra de afaceri include TVA?', 'doc', { cat: 'banca', status: 'check', kind: 'check' }),
];
ReactDOM.createRoot(document.getElementById('root')!).render(
  <div className="min-h-dvh bg-pc-base p-3 text-pc-text-primary"><div className="mx-auto max-w-[640px]">
    <NowView items={items} today={today} mode={mode} cats={cats} onDone={() => {}} onOpen={() => {}} />
  </div></div>,
);
