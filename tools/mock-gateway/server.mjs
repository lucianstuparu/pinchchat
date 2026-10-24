// Local mock of the OpenClaw gateway protocol, for headless UI testing only.
// Test token: TEST_TOKEN below. Never used against the real gateway.
//
// Control endpoints (HTTP, same port):
//   GET /__drop          close all client sockets (simulates network drop)
//   GET /__down?ms=N     refuse new connections for N ms (simulates gateway down)
//   GET /__ask           push an ask_user question into the main session
//   GET /__log           JSON of everything clients sent
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';


// ---- shopping sample data (see the /shop routes)
let shopOffline = false;
const SHOP_STORES = [
  { tag: 'carrefour', name: 'Carrefour', also: ['carrefour-market'] }, { tag: 'carrefour-market', name: 'Carrefour Market', also: ['carrefour'] },
  { tag: 'lidl', name: 'Lidl', also: [] }, { tag: 'grand-frais', name: 'Grand Frais', also: [] }, { tag: 'leclerc', name: 'Leclerc', also: [] },
  { tag: 'migros', name: 'Migros', also: [] }, { tag: 'paniere', name: 'La Panière', also: [] }, { tag: 'pharmacy', name: 'Pharmacy', also: [] },
];
const SHOP_KNOWN = [{ title: 'Oat milk', tags: ['lidl'], n: 9 }, { title: 'Kefir', tags: [], n: 4 }, { title: 'Bananas', tags: [], n: 6 }, { title: 'Olive oil', tags: ['grand-frais'], n: 2 }];
const si = (id, title, tags, extra = {}) => ({ id, kind: 'buy', title, tags, status: 'open', scope: 'shared', added_by: 'lucian', created: '2026-10-20T08:00:00Z', updated: '2026-10-20T08:00:00Z', ...extra });
const shopItems = [
  si('shp-2026-10-22-c61037', 'Sare pentru mașina de spălat vase', ['carrefour'], { source: 'a-2026-10-22-001' }),
  si('shp-2026-10-21-a1b2c3', 'Oat milk', ['lidl'], { qty: '2' }),
  si('shp-2026-10-21-b2c3d4', 'Kefir', [], { shelf: 14 }),
  si('shp-2026-10-21-c3d4e5', 'Vitamin D', ['pharmacy'], { scope: 'private' }),
  si('shp-2026-10-21-d4e5f6', 'Mangoes', ['grand-frais'], { added_by: 'ludmila' }),
  si('shp-2026-10-20-e5f6a7', 'Philips kettle', ['leclerc'], { kind: 'return', due_date: '2026-10-24', notes: 'receipt in the drawer' }),
  si('shp-2026-10-20-f6a7b8', 'Bread', ['paniere'], { status: 'bought', bought_on: '2026-10-21', bought_by: 'ludmila', updated: '2026-10-21T18:00:00Z' }),
];
const shopAsks = [];
const shopPhotos = new Map();
const addD = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const shopPantry = [
  { id: 'pan-2026-10-20-000001', kind: 'pantry', title: 'Piept de pui', where: 'fridge', due_date: addD(1), status: 'open', added_by: 'ludmila', created: '2026-10-20T08:00:00Z' },
  { id: 'pan-2026-10-20-000002', kind: 'pantry', title: 'Hummus', where: 'fridge', due_date: addD(-1), status: 'open', added_by: 'lucian', created: '2026-10-20T08:00:00Z' },
  { id: 'pan-2026-10-20-000003', kind: 'pantry', title: 'Iaurt grecesc', qty: '3', where: 'fridge', due_date: addD(12), guessed: true, status: 'open', added_by: 'lucian', created: '2026-10-20T08:00:00Z' },
  { id: 'pan-2026-10-20-000004', kind: 'pantry', title: 'Mazare', where: 'freezer', status: 'open', added_by: 'lucian', created: '2026-10-20T08:00:00Z' },
];
function pantryOp(op) {
  if (op.op === 'pantry-add') {
    if (shopPantry.some(e => e.id === op.id)) return { ok: true, duplicate: true };
    const e = { id: op.id, kind: 'pantry', title: op.title, product: op.product, qty: op.qty, where: op.where || 'fridge', due_date: op.expires || (op.in_days ? addD(op.in_days) : undefined), status: 'open', added_by: 'lucian', created: new Date().toISOString() };
    shopPantry.push(e); return { ok: true, entry: e };
  }
  const e = shopPantry.find(x => x.id === op.id);
  if (!e) return { error: 'not in the pantry' };
  if (op.op === 'pantry-close') Object.assign(e, { status: op.how, closed_by: 'lucian', closed_on: addD(0) });
  if (op.op === 'pantry-reopen') Object.assign(e, { status: 'open', closed_by: undefined, closed_on: undefined });
  if (op.op === 'pantry-edit') { for (const k of ['title', 'qty', 'where']) if (op[k] !== undefined) e[k] = op[k] || undefined; if (op.expires !== undefined) { e.due_date = op.expires || undefined; e.guessed = false; } }
  return { ok: true, entry: e };
}   // ref -> Buffer (photo ops)
const shopProducts = [{
  id: 'prd-2026-10-20-0a0a0a', name: 'Kefir nature', brand: 'Lactel', size: '1 L', photos: [],
  ingredients: 'Lait fermente au kefir (lait, ferments lactiques et levures).',
  nutrition: { kcal: 52, protein: 3.3, fat: 1.5, sat_fat: 1, carbs: 4.5, sugar: 4.5, fiber: 0, salt: 0.1 },
  health: { nova: 1, flags: ['live cultures'], note: 'Plain kefir: milk and cultures only. Good for gut flora diversity.', date: '2026-10-20' },
  tags: ['dairy'], aliases: ['chefir', 'kefir'], added_by: 'ludmila', created: '2026-10-20T08:00:00Z', updated: '2026-10-20T08:00:00Z',
  stats: { times: 3, last_date: '2026-10-19', last_store: 'lidl', last_price: 1.89, currency: 'EUR' },
}];
const shopPurchases = [
  { id: 'pur-2026-10-19-000001', title: 'Kefir nature', product: 'prd-2026-10-20-0a0a0a', price: 1.89, currency: 'EUR', store: 'lidl', date: '2026-10-19', by: 'ludmila', source: 'receipt' },
  { id: 'pur-2026-10-12-000002', title: 'Kefir nature', product: 'prd-2026-10-20-0a0a0a', price: 1.79, currency: 'EUR', store: 'lidl', date: '2026-10-12', by: 'lucian', source: 'receipt' },
];
function shopApply(op) {
  const nowIso = new Date().toISOString();
  if (String(op.op).startsWith('pantry-')) return pantryOp(op);
  if (op.op === 'favorite') {   // the app runs as 'me' against the mock (no Access identity)
    const prd = shopProducts.find(x => x.id === op.product); if (!prd) return { error: 'no product' };
    const f = new Set(prd.fav_by || []); if (op.on) f.add('me'); else f.delete('me'); prd.fav_by = [...f]; return { ok: true, product: prd };
  }
  if (op.op === 'ask' && /^\[Pantry\]/.test(op.text || '')) {   // imitate the Shopper on the pantry
    if (shopAsks.some(a => a.id === op.id)) return { ok: true, fresh: false };
    const a = { id: op.id, text: op.text, status: 'working', ts: nowIso };
    shopAsks.push(a);
    setTimeout(() => {
      const t = op.text.replace('[Pantry] ', '');
      const e = pantryOp({ op: 'pantry-add', id: 'pan-2026-10-22-' + Math.random().toString(16).slice(2, 8), title: t.replace(/ expires.*$/i, ''), in_days: 2 }).entry;
      a.reply = `Noted ${e.title}, expires ${e.due_date}`; a.status = 'done';
    }, 2500);
    return { ok: true, ask: a, fresh: true };
  }
  if (op.op === 'photo') { if (!shopPhotos.has(op.ref)) shopPhotos.set(op.ref, Buffer.from(op.data, 'base64')); return { ok: true, ref: op.ref }; }
  if (op.op === 'ask' && op.photos?.length) {   // imitate the Shopper reading a label
    if (shopAsks.some(a => a.id === op.id)) return { ok: true, fresh: false };
    const a = { id: op.id, text: op.text, photos: op.photos, store: op.store, status: 'working', ts: nowIso };
    shopAsks.push(a);
    setTimeout(() => {
      const prd = { id: 'prd-2026-10-22-' + Math.random().toString(16).slice(2, 8), name: 'Activia nature', brand: 'Danone', size: '4 x 125 g', photos: op.photos,
        ingredients: 'Lait ecreme, creme, ferments lactiques (dont Bifidus), amidon modifie (E1422), carraghenanes (E407).',
        nutrition: { kcal: 72, protein: 4.3, fat: 3.2, sat_fat: 2.1, carbs: 5.6, sugar: 5.6, fiber: 0, salt: 0.15 },
        health: { nova: 4, flags: ['carrageenan E407', 'modified starch E1422'], note: 'NOVA 4 because of carrageenan (E407) and modified starch; evidence in humans is mixed. Live cultures are a plus; a plain yoghurt gives them without E407.', date: '2026-10-22' },
        tags: ['dairy'], aliases: ['iaurt Activia'], added_by: 'lucian', created: nowIso, updated: nowIso };
      shopProducts.push(prd);
      a.reply = `Saved Activia nature to the catalogue (NOVA 4, E407) <${prd.id}>`; a.status = 'done';
    }, 3000);
    return { ok: true, ask: a, fresh: true };
  }
  if (op.op === 'ask') {   // imitate the assistant: after 3 s, drop an item named after "no more", else add it
    if (shopAsks.some(a => a.id === op.id)) return { ok: true, fresh: false };
    const a = { id: op.id, text: op.text, store: op.store, status: 'working', ts: nowIso };
    shopAsks.push(a);
    setTimeout(() => {
      const m = /(?:no more|nu mai am nevoie de)\s+(.+)/i.exec(op.text);
      const hit = m && shopItems.find(i => i.status === 'open' && i.title.toLowerCase().includes(m[1].toLowerCase()));
      if (hit) { hit.status = 'cancelled'; a.reply = `Removed ${hit.title} ⟨${hit.id}⟩`; }
      else { const e = si(`shp-2026-10-22-${Math.random().toString(16).slice(2, 8)}`, op.text.replace(/^(we need|add)\s+/i, ''), op.store ? [op.store] : []); shopItems.push(e); a.reply = `Added ${e.title} ⟨${e.id}⟩`; }
      a.status = 'done';
    }, 3000);
    return { ok: true, ask: a, fresh: true };
  }
  if (op.op === 'add') {
    if (shopItems.some(i => i.id === op.id)) return { ok: true, duplicate: true };
    const e = si(op.id, op.title, op.tags || [], { product: op.product, kind: op.kind === 'return' ? 'return' : 'buy', qty: op.qty, scope: op.scope === 'private' ? 'private' : 'shared', due_date: op.due_date, created: nowIso, updated: nowIso });
    if (op.smart) {   // imitate the assistant: after 3 s, a tidy title and the shop it heard
      e.sorting = true;
      setTimeout(() => {
        const shop = SHOP_STORES.find(st => op.title.toLowerCase().includes(st.name.toLowerCase()));
        e.title = op.title.replace(/(de la|from|at).*$/i, '').replace(/^(we need|trebuie sa iau|buy)\s+/i, '').trim().replace(/^./, c => c.toUpperCase());
        if (shop) e.tags = [shop.tag];
        delete e.sorting; e.updated = new Date().toISOString();
      }, 3000);
    }
    shopItems.push(e); return { ok: true, item: e };
  }
  const e = shopItems.find(i => i.id === op.id);
  if (!e) return { error: 'not in your lists' };
  if (op.op === 'tick' && e.status === 'open') Object.assign(e, { status: e.kind === 'return' ? 'returned' : 'bought', bought_on: nowIso.slice(0, 10), bought_by: 'lucian', bought_at: op.store });
  if (op.op === 'untick') Object.assign(e, { status: 'open', bought_on: undefined, bought_by: undefined });
  if (op.op === 'drop') e.status = 'cancelled';
  if (op.op === 'scope') e.scope = op.scope;
  if (op.op === 'edit') for (const k of ['title', 'tags', 'qty', 'notes', 'due_date', 'kind']) if (op[k] !== undefined) e[k] = op[k] || undefined;
  e.updated = nowIso;
  return { ok: true, item: e };
}

const PORT = 18789;
const TEST_TOKEN = 'local-test-token-not-a-secret';
// --agents=gateway-ludmila,admin pretends to be another person's gateway (default: Lucian's).
const AGENTS = (process.argv.find(a => a.startsWith('--agents='))?.slice(9) || 'gateway-lucian,admin').split(',');
const MAIN = `agent:${AGENTS[0]}:main`;

const sessions = new Map([[MAIN, []]]);
const received = [];
let downUntil = 0;
const pending = new Map();
let seq = 0;
const clients = new Set();

const now = () => Date.now();
const waDrafts = new Map();
const waContacts = [
  { id: 'ct-1', name: 'Eugenia Gamurari', label: 'Bunica', aliases: ['bunica', 'bunicii', 'buni'], phone: '+33600000000', lang: 'ro', tone: 'informal', sent: 3, last_sent: '2026-10-24T08:00:00Z', listen: true, unread: 2, last_in: { text: 'Ai ajuns cu bine?', ts: '2026-10-24T11:40:00Z' } },
  { id: 'ct-2', name: 'Fleur Guillemot', label: 'Fleur', aliases: [], phone: '+33600000001', lang: 'fr', tone: 'formal', sent: 0 },
  { id: 'ct-3', name: 'Mama', label: 'Mama', aliases: ['mama', 'mamei'], phone: '', lang: 'ro', tone: 'informal', sent: 0 },
];
const artlia = JSON.parse(readFileSync(new URL('./artlia-sample.json', import.meta.url), 'utf8'));
const hist = (key) => { if (!sessions.has(key)) sessions.set(key, []); return sessions.get(key); };

// Seed two days of history so date separators and scrolling can be checked
{
  const h = hist(MAIN);
  const yesterday = now() - 26 * 3600e3;
  h.push({ id: 'h1', role: 'user', content: [{ type: 'text', text: 'buy oat milk' }], timestamp: yesterday });
  h.push({ id: 'h2', role: 'assistant', content: [{ type: 'text', text: '✓ shopping: oat milk' }], timestamp: yesterday + 4000 });
  h.push({ id: 'h3', role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'exec', input: { cmd: 'route.sh' } }], timestamp: yesterday + 5000 });
  h.push({ id: 'h4', role: 'user', content: [{ type: 'text', text: 'Read HEARTBEAT.md if it exists' }], timestamp: yesterday + 6000 });
  h.push({ id: 'h5', role: 'assistant', content: [{ type: 'text', text: 'HEARTBEAT_OK' }], timestamp: yesterday + 7000 });
  // Gateway noise in front of a long pasted message, and a failed turn (both shown short by the app)
  const sys = `OpenClaw resumed this CLI session after prompt content changed.

System: [2026-10-22 13:28:51 UTC] WhatsApp gateway disconnected (status 428)
System: [2026-10-22 13:28:54 UTC] WhatsApp gateway connected as +40700000000.`;
  const pasted = `Note this, for when I may install a heat pump

A heat-pump water heater (detached house, zone H1):
926 € for a very modest household
720 € for a modest household
411 € for other households
The grant is paid after the works, on the invoice of a certified installer. Apply online before signing the quote; keep the quote, the invoice and the certificate. Ask the installer whether the model is on the eligible list, and check the household income bracket on the tax notice of the previous year.`;
  h.push({ id: 'h6', role: 'user', content: [{ type: 'text', text: `${sys}

${pasted}` }], timestamp: yesterday + 8000 });
  h.push({ id: 'h7', role: 'assistant', content: [{ type: 'text', text: 'This turn ended before a reply: Failed to authenticate: OAuth session expired and could not be refreshed' }], timestamp: yesterday + 9000 });
  h.push({ id: 'h7b', role: 'assistant', content: [{ type: 'text', text: 'Failed to authenticate: OAuth session expired and could not be refreshed' }], timestamp: yesterday + 9100 });
  h.push({ id: 'h8', role: 'user', content: [{ type: 'text', text: 'Voice message: Cumpără sare pentru mașina de spălat vase când sunt la Carrefour' }], timestamp: yesterday + 10000 });
  h.push({ id: 'h9', role: 'user', content: [{ type: 'text', text: '\u{1F3A4} Voice note' }], timestamp: yesterday + 11000 });
}

function broadcast(event, payload) {
  for (const ws of clients) ws.send(JSON.stringify({ type: 'event', event, payload }));
}

function streamReply(sessionKey, text, delay = 40) {
  const runId = 'run-' + (++seq);
  const words = text.split(/(\s+)/);
  let acc = '';
  let i = 0;
  const tick = () => {
    if (i < words.length) {
      acc += words[i++];
      broadcast('chat', { state: 'delta', runId, sessionKey, message: { role: 'assistant', content: [{ type: 'text', text: acc }] } });
      setTimeout(tick, delay);
    } else {
      hist(sessionKey).push({ id: runId, role: 'assistant', content: [{ type: 'text', text }], timestamp: now() });
      broadcast('chat', { state: 'final', runId, sessionKey, message: { role: 'assistant', content: [{ type: 'text', text }] } });
    }
  };
  setTimeout(tick, 300);
  return runId;
}

function askQuestion(sessionKey = MAIN) {
  const id = 'q-' + (++seq);
  const rec = {
    id, sessionKey, agentId: 'gateway-lucian', createdAtMs: now(), expiresAtMs: now() + 900e3, status: 'pending',
    questions: [{ questionId: 'domain', header: 'Domain', question: 'Where should I file this?', options: [
      { label: 'Shopping' }, { label: 'my.tech', description: 'Infrastructure, devices, software' }, { label: 'my.thinking' }, { label: 'Ignore' },
    ] }],
  };
  pending.set(id, rec);
  broadcast('question.requested', rec);
  return rec;
}

const LONG = [
  '## Long reply check',
  '',
  'A paragraph with **bold**, *italic*, `inline code` and a link to https://example.com/very/long/path/that/should/wrap/nicely/on/a/phone.',
  '',
  '- first item', '- second item with more words to wrap across lines on a narrow screen', '- third',
  '',
  '1. numbered', '2. list',
  '',
  '```bash', 'ssh proxmox-claude "sudo pct exec 103 -- systemctl status openclaw --no-pager | head -40"', '```',
  '',
  '| Domain | Count |', '|---|---|', '| shopping | 12 |', '| my.tech | 7 |',
  '',
  '> a quoted line',
  '',
  ...Array.from({ length: 8 }, (_, i) => `Line ${i + 1} of padding so the reply is taller than the screen.`),
].join('\n');

function reply(sessionKey, message, attachments) {
  const m = (message || '').trim();
  const first = m.split(/\s+/)[0]?.toLowerCase();
  const shortcuts = { buy: 'shopping', tech: 'my.tech', idea: 'my.thinking', home: 'my.home' };
  if (shortcuts[first]) return streamReply(sessionKey, `✓ ${shortcuts[first]}: ${m.slice(first.length).trim()}`);
  if (first === 'ask') { const r = streamReply(sessionKey, 'Let me check one thing first.'); setTimeout(() => askQuestion(sessionKey), 900); return r; }
  if (first === 'long') return streamReply(sessionKey, LONG, 8);
  // "scrie-i bunicii că …": a WhatsApp draft card (ai.manager whatsapp-send.md); nothing is ever sent here
  const wa = m.match(/^scrie-i\s+(\S+)\s+(?:că|ca)\s+(.+)$/i) || m.match(/^scrie-i\s+lui\s+([^:]+):\s+(.+)$/i);
  if (wa) {
    const id = `wa-2026-10-24-${(++seq).toString(16).padStart(6, '0')}`;
    const said = wa[2].trim();
    waDrafts.set(id, { name: 'Eugenia Gamurari', text: said[0].toUpperCase() + said.slice(1).replace(/[.!]?$/, '.'), lang: 'ro', status: 'draft' });
    return streamReply(sessionKey, `Pentru **Eugenia Gamurari**: „${waDrafts.get(id).text}” ⟨${id}⟩`);
  }
  const att = attachments?.length ? ` I received ${attachments.length} attachment(s): ${attachments.map(a => `${a.fileName} (${a.mimeType}, ${Math.round((a.content?.length || 0) * 0.75 / 1024)} KB)`).join(', ')}.` : '';
  return streamReply(sessionKey, `Got it: "${m || '(no text)'}".${att}`);
}

const handlers = {
  'agent.identity.get': () => ({ name: 'OpenClaw' }),
  'agents.list': () => ({ agents: [...AGENTS, 'artlia'].map(id => ({ id, name: id })) }),
  'sessions.list': () => ({ sessions: [...sessions.keys()].map(key => ({ key, agentId: key.split(':')[1], label: key.split(':').pop(), updatedAt: now() })) }),
  'chat.history': (p) => ({ messages: hist(p.sessionKey) }),
  'chat.send': (p) => {
    const blocks = [];
    for (const a of p.attachments || []) {
      if (a.mimeType?.startsWith('image/')) blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mimeType, data: a.content } });
    }
    blocks.push({ type: 'text', text: p.message });
    hist(p.sessionKey).push({ id: 'u-' + (++seq), role: 'user', content: blocks, timestamp: now() });
    return { runId: reply(p.sessionKey, p.message, p.attachments) };
  },
  'chat.abort': () => ({}),
  'sessions.create': () => { const key = `agent:gateway-lucian:chat-${++seq}`; hist(key); return { key, sessionKey: key }; },
  'question.list': () => ({ questions: [...pending.values()] }),
  'question.resolve': (p) => {
    const rec = pending.get(p.id);
    if (!rec) throw { code: 'INVALID_REQUEST', message: 'unknown question' };
    pending.delete(p.id);
    if (p.cancel) { broadcast('question.resolved', { id: p.id, status: 'cancelled' }); streamReply(rec.sessionKey, 'Skipped — leaving it unfiled.'); return { status: 'cancelled' }; }
    broadcast('question.resolved', { id: p.id, status: 'answered', answers: p.answers });
    const picks = Object.values(p.answers?.answers || {}).flat().join(', ');
    streamReply(rec.sessionKey, `✓ filed under ${picks}`);
    return { status: 'answered', answers: p.answers };
  },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__drop') { for (const ws of clients) ws.terminate(); res.end('dropped ' + clients.size); return; }
  if (url.pathname === '/__down') { downUntil = now() + Number(url.searchParams.get('ms') || 10000); for (const ws of clients) ws.terminate(); res.end('down until ' + new Date(downUntil).toISOString()); return; }
  if (url.pathname === '/__ask') { const r = askQuestion(); res.end(r.id); return; }
  if (url.pathname === '/__log') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(received.map(r => ({ ...r, params: { ...r.params, attachments: r.params?.attachments?.map(a => ({ fileName: a.fileName, mimeType: a.mimeType, base64Len: a.content?.length })) } })), null, 1)); return; }
  // The shopping app's API (shop.stuparu.eu, /shop/list and /shop/ops). In-memory sample list;
  // the rules are a short copy of the server's shop.mjs. /__shop_offline?on=1 makes it fail like no network.
  if (url.pathname === '/__shop_offline') { shopOffline = url.searchParams.get('on') === '1'; res.end(`shop offline ${shopOffline}`); return; }
  if (url.pathname.startsWith('/shop/media/')) {
    const buf = shopPhotos.get(decodeURIComponent(url.pathname.slice('/shop/media/'.length)));
    if (!buf) { res.statusCode = 404; res.end(); return; }
    res.setHeader('content-type', 'image/jpeg'); res.end(buf); return;
  }
  if (url.pathname === '/shop/transcribe' || url.pathname === '/reg/transcribe') {   // stands in for Whisper
    let n = 0; req.on('data', (c) => { n += c.length; });
    req.on('end', () => setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ text: `iau creme fraiche de la Carrefour (${n} bytes)`, lang: 'ro' })); }, 1200));
    return;
  }
  if (url.pathname === '/shop/list' || url.pathname === '/shop/ops') {
    if (shopOffline) { req.socket.destroy(); return; }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      const results = (p.ops || []).map(shopApply);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ results, today: '2026-10-22', stores: SHOP_STORES, items: shopItems.filter(i => i.status === 'open' || i.updated >= '2026-10-08'), known: SHOP_KNOWN, asks: shopAsks, products: shopProducts, purchases: shopPurchases, pantry: shopPantry, usual: SHOP_USUAL }));
    });
    return;
  }
  if (url.pathname === '/reg/wa/contacts' || url.pathname === '/reg/wa/contact' || url.pathname === '/reg/wa/inbox') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      res.setHeader('content-type', 'application/json');
      if (url.pathname === '/reg/wa/contacts') { res.end(JSON.stringify({ contacts: waContacts })); return; }
      if (url.pathname === '/reg/wa/inbox') {
        const c = waContacts.find(x => x.id === p.contact); if (c) c.unread = 0;
        res.end(JSON.stringify({ messages: p.contact === 'ct-1' ? [
          { id: 'm1', from: 'me', text: 'Am plecat acum de acasă.', ts: '2026-10-24T08:00:00Z' },
          { id: 'm2', from: 'them', text: 'Bine, drum bun! Să-mi scrii când ajungi.', ts: '2026-10-24T08:05:00Z' },
          { id: 'm3', from: 'them', text: 'Ai ajuns cu bine?', ts: '2026-10-24T11:40:00Z' },
        ] : [] }));
        return;
      }
      let c = waContacts.find(x => x.id === p.id);
      if (!c) { c = { id: `ct-${++seq}`, sent: 0 }; waContacts.push(c); }
      Object.assign(c, { name: p.name, label: p.label, aliases: p.aliases, phone: p.phone, lang: p.lang, tone: p.tone, listen: p.listen });
      res.end(JSON.stringify({ ok: true, contact: c }));
    });
    return;
  }
  if (url.pathname === '/reg/wa/status' || url.pathname === '/reg/wa/act') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      res.setHeader('content-type', 'application/json');
      if (url.pathname === '/reg/wa/status') { res.end(JSON.stringify({ drafts: Object.fromEntries((p.ids || []).filter(i => waDrafts.has(i)).map(i => [i, waDrafts.get(i)])) })); return; }
      const d = waDrafts.get(p.draft);
      if (!d) { res.statusCode = 404; res.end(JSON.stringify({ error: 'no such draft' })); return; }
      if (p.action === 'edit') d.text = p.text;
      if (p.action === 'cancel' && d.status === 'draft') d.status = 'cancelled';
      if (p.action === 'send' && (d.status === 'draft' || d.status === 'failed')) { if (p.text) d.text = p.text; d.status = 'sent'; d.sent_at = new Date().toISOString(); }
      setTimeout(() => res.end(JSON.stringify({ ok: true, draft: d })), 600);
    });
    return;
  }
  // The Casa Artlia app's API (/artlia/*; ai.manager casa-artlia-app.md). In-memory sample.
  if (url.pathname.startsWith('/artlia/')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      res.setHeader('content-type', 'application/json');
      const find = () => artlia.items.find(i => i.id === p.item);
      if (url.pathname === '/artlia/list') { res.end(JSON.stringify({ today: '2026-10-24', ...artlia })); return; }
      if (url.pathname === '/artlia/add') {
        const item = { id: `art-2026-10-24-${(++seq).toString(16).padStart(6, '0')}`, n: 90 + seq, kind: p.kind || 'task', title: p.title, cat: p.cat, status: 'todo', due_date: p.due_date, phase: p.phase, notes: p.notes, source: 'app' };
        artlia.items.push(item); res.end(JSON.stringify({ ok: true, item })); return;
      }
      const it = find();
      if (!it) { res.statusCode = 404; res.end(JSON.stringify({ error: 'nu există' })); return; }
      if (url.pathname === '/artlia/file') { (it.files ||= []).push({ name: p.name, ref: `f-${seq++}`, at: new Date().toISOString(), by: 'lucian' }); res.end(JSON.stringify({ ok: true, item: it })); return; }
      const prev = { ...it };
      if (p.action === 'undo') { if (!it._prev) { res.statusCode = 400; res.end(JSON.stringify({ error: 'nimic de anulat' })); return; } const back = it._prev; Object.keys(it).forEach(k => delete it[k]); Object.assign(it, back, { _prev: prev }); }
      else {
        it._prev = prev;
        if (p.action === 'done') it.status = 'done';
        if (p.action === 'reopen') it.status = 'todo';
        if (p.action === 'drop') it.status = 'cancelled';
        if (p.action === 'snooze') it.snoozed_until = '2026-10-27';
        if (p.action === 'status') it.status = p.status;
        if (p.action === 'note') it.notes = [it.notes, `${p.text} (lucian, 24.10)`].filter(Boolean).join('\n');
        if (p.action === 'edit') for (const k of ['title', 'due_date', 'cat', 'phase', 'priority']) if (p[k] !== undefined) { if (p[k] === null) delete it[k]; else it[k] = p[k]; }
      }
      const { _prev, ...out } = it; void _prev;
      res.end(JSON.stringify({ ok: true, item: out }));
    });
    return;
  }
  // ai.manager register items (what the Admin / General cards read and change). Fixed sample data.
  if (['/reg/now', '/reg/loops', '/reg/item'].includes(url.pathname)) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      res.setHeader('content-type', 'application/json');
      const today = '2026-10-20';
      if (url.pathname === '/reg/loops') { res.end(JSON.stringify({ today, loops: regLoops })); return; }
      if (url.pathname === '/reg/item') {
        const it = regItems[p.item] || regLoops.find((l) => l.id === p.item);
        if (!it) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not in your lists' })); return; }
        res.end(JSON.stringify({ today, item: { ...it, id: p.item, store: it.store || 'loops', scope: it.scope || 'private', notes: it.notes },
          origin: it.source ? { kind: 'message', id: it.source, ts: '2026-10-19T17:30:00Z', text: 'home call the plumber about the boiler next Tuesday', type: 'text' } : null }));
        return;
      }
      const sec = (d) => !d ? 'later' : d < today ? 'overdue' : d === today ? 'today' : d <= '2026-10-27' ? 'week' : 'later';
      const pr = { P1: 4, P2: 3, P3: 2, P4: 1 };
      const items = Object.entries(regItems).filter(([, i]) => !['paid', 'done', 'cancelled'].includes(i.status) && i.kind !== 'buy')
        .map(([id, i]) => { const s = i.status === 'waiting' ? 'waiting' : sec(i.due_date); const w = (pr[i.priority] || 2) * (s === 'overdue' ? 1.5 : s === 'today' ? 1.3 : s === 'week' ? 1.15 : 1);
          return { id, ...i, priority: i.priority || 'P3', section: s, weight: w }; })
        .sort((a, b) => b.weight - a.weight);
      res.end(JSON.stringify({ today, items }));
    });
    return;
  }
  if (url.pathname === '/reg/status' || url.pathname === '/reg/act') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      res.setHeader('content-type', 'application/json');
      if (url.pathname === '/reg/act') {
        const it = regItems[p.item];
        if (!it) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not in your registers' })); return; }
        if (p.action === 'undo') { if (!it._prev) { res.statusCode = 400; res.end(JSON.stringify({ error: 'nothing to undo on this item' })); return; } const prev = it._prev; const now = { ...it }; delete now._prev; for (const k of Object.keys(it)) delete it[k]; Object.assign(it, prev, { _prev: now }); res.end(JSON.stringify({ ok: true, action: 'undo', title: it.title, status: it.status })); return; }
        it._prev = { ...it }; delete it._prev._prev;
        if (p.action === 'done') it.status = it.kind === 'bill' ? 'paid' : 'done';
        if (p.action === 'drop') it.status = 'cancelled';
        if (p.action === 'reopen') it.status = 'open';
        if (p.action === 'snooze') it.remind_on = '2026-10-23';
        if (p.action === 'priority') it.priority = p.priority;
        if (p.action === 'edit') {
          if (p.title !== undefined) it.title = p.title;
          if (p.due_date !== undefined) { if (p.due_date) it.due_date = p.due_date; else delete it.due_date; }
          if (p.topics !== undefined) it.topics = p.topics;
        }
        res.end(JSON.stringify({ ok: true, action: p.action, title: it.title, status: it.status, remind_on: it.remind_on }));
        return;
      }
      const items = Object.fromEntries((p.items || []).filter((i) => regItems[i]).map((i) => [i, regItems[i]]));
      res.end(JSON.stringify({ items, today: '2026-10-20' }));
    });
    return;
  }
  res.end('mock openclaw gateway');
});

const SHOP_USUAL = [
  { key: 't:kefir', title: 'Kefir', tags: ['lidl'], every: 10, last: '2026-10-10', since: 12, reason: 'usual' },
  { key: 'p:prd-x', title: 'Activia nature', product: 'prd-x', tags: ['carrefour'], every: null, last: '2026-09-01', since: 51, reason: 'favourite' },
];
const regLoops = [
  { id: 'lp-2026-10-19-aaaaaa', title: 'Retire the ConBee', domain: 'tech', state: 'Car charger and VINDSTYRKA moved; 2 covers left', next_step: 'pair the 2 covers on Z2M', status: 'open', last_touched: '2026-10-18', scope: 'private', kind: 'loop' },
  { id: 'lp-2026-10-19-bbbbbb', title: 'Car insurance switch', domain: 'finance', state: 'Two quotes requested', next_step: 'compare when the second quote arrives', status: 'open', last_touched: '2026-10-20', scope: 'shared', kind: 'loop' },
];
const regItems = {
  'adm-2026-10-18-5a672f': { n: 3, status: 'open', kind: 'deadline', title: '**SFR**/CertiDeal trade-in bonus', payee: 'CertiDeal', amount: 300, currency: 'EUR', due_date: '2026-10-22', remind_on: '2026-10-21', scope: 'private', store: 'admin', topics: ['Money'] },
  'adm-2026-10-18-032d99': { n: 7, status: 'open', kind: 'bill', title: '**AEDES** charges 4T2026', payee: 'Syndicat Le Clos des Hauts de Genève', amount: 693.78, currency: 'EUR', due_date: '2026-10-01', remind_on: '2026-10-23', scope: 'shared', store: 'admin', topics: ['Money'] },
  'adm-2026-10-18-9ae409': { n: 8, status: 'open', kind: 'bill', title: 'Taxe foncière 2026', payee: 'DGFiP', amount: 1175, currency: 'EUR', due_date: '2026-10-26', remind_on: '2026-10-25', scope: 'shared', store: 'admin', topics: ['Money', 'Admin'] },
  'tsk-2026-10-20-c0ffee': { n: 12, status: 'todo', kind: 'task', title: 'Renew **passport**', priority: 'P1', consequence: 'travel in December impossible', due_date: '2026-11-15', remind_on: '2026-11-08', scope: 'private', store: 'tasks', domain: 'admin', source: 'a-2026-10-19-004', topics: ['Admin'] },
  'tsk-2026-10-20-dead01': { n: 14, status: 'waiting', kind: 'task', title: '**Ludmila**: Gmail consent', priority: 'P2', scope: 'private', store: 'tasks', domain: 'tech', topics: ['People'] },
  'tsk-2026-10-19-aaaaaa': { n: 9, status: 'todo', kind: 'task', title: 'Call the **plumber** about the boiler', due_date: '2026-10-27', remind_on: '2026-10-26', scope: 'shared', store: 'tasks', domain: 'home', topics: ['Errands'] },
  'tsk-2026-09-20-fleur1': { n: 22, status: 'todo', kind: 'task', title: 'Email **Fleur** re: 1B suffix for ERP', due_date: '2026-09-20', scope: 'private', store: 'tasks', domain: 'icrc', topics: ['Admin', 'People'] },
  'tsk-2026-09-20-dent01': { n: 25, status: 'todo', kind: 'task', title: 'Write to **dental clinic in Moldova** about temp crown falling out', due_date: '2026-09-20', scope: 'private', store: 'tasks', domain: 'health', topics: ['Health', 'Admin'] },
  'tsk-2026-10-10-evgh01': { n: 18, status: 'todo', kind: 'task', title: 'Schedule **Evghenia**’s Lyon visit once her response arrives', scope: 'private', store: 'tasks', domain: 'family', topics: ['People', 'Admin'] },
  'tsk-2026-10-05-insu01': { n: 6, status: 'todo', kind: 'task', title: 'Follow up with **insurance company** to demand reevaluation of flood claim', scope: 'shared', store: 'tasks', domain: 'home', priority: 'P1', topics: ['Admin', 'Money'] },
  'tsk-2026-10-01-rent01': { n: 31, status: 'todo', kind: 'task', title: 'Pay the **rent**', due_date: '2026-11-05', scope: 'shared', store: 'tasks', domain: 'home', topics: ['Money'], repeat: 'every month' },
  'tsk-2026-10-18-dent02': { n: 33, status: 'todo', kind: 'task', title: 'Book a **dentist** check-up', due_date: '2026-11-30', scope: 'private', store: 'tasks', domain: 'health', topics: ['Health'], snoozed_until: '2026-10-25', hidden: true },
  'tsk-2026-10-15-ccar01': { n: 15, status: 'todo', kind: 'task', title: 'Book **Casa Artlia** roof inspection', scope: 'shared', store: 'tasks', domain: 'casa-artlia', topics: ['Errands'] },
};

const wss = new WebSocketServer({ noServer: true, maxPayload: 26214400 });
server.on('upgrade', (req, socket, head) => {
  if (now() < downUntil) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (ws) => {
  let authed = false;
  ws.send(JSON.stringify({ type: 'event', event: 'connect.challenge', payload: { nonce: 'n-' + (++seq), ts: now() } }));
  ws.on('message', (data) => {
    const msg = JSON.parse(String(data));
    if (msg.type !== 'req') return;
    received.push({ t: now(), method: msg.method, params: msg.method === 'connect' ? { auth: msg.params?.auth?.token === TEST_TOKEN ? 'ok' : 'bad' } : msg.params });
    const respond = (ok, payload) => ws.send(JSON.stringify({ type: 'res', id: msg.id, ok, payload }));
    if (msg.method === 'connect') {
      if (msg.params?.auth?.token !== TEST_TOKEN) { respond(false, { code: 'UNAUTHORIZED', message: 'unauthorized: gateway token mismatch' }); return; }
      authed = true; clients.add(ws);
      respond(true, { protocol: 4, server: { version: 'mock' }, policy: { maxPayload: 26214400, attachments: { maxBytes: 19464192, maxImageBytes: 6291456 } } });
      return;
    }
    if (!authed) { respond(false, { code: 'UNAUTHORIZED', message: 'not connected' }); return; }
    const h = handlers[msg.method];
    try { respond(true, h ? h(msg.params || {}) : {}); } catch (e) { respond(false, e); }
  });
  ws.on('close', () => clients.delete(ws));
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock gateway on ws://127.0.0.1:${PORT}`));
