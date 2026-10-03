// Local mock of the OpenClaw gateway protocol, for headless UI testing only.
// Test token: TEST_TOKEN below. Never used against the real gateway.
//
// Control endpoints (HTTP, same port):
//   GET /__drop          close all client sockets (simulates network drop)
//   GET /__down?ms=N     refuse new connections for N ms (simulates gateway down)
//   GET /__ask           push an ask_user question into the main session
//   GET /__log           JSON of everything clients sent
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = 18789;
const TEST_TOKEN = 'local-test-token-not-a-secret';
const MAIN = 'agent:gateway-lucian:main';

const sessions = new Map([[MAIN, []]]);
const received = [];
let downUntil = 0;
const pending = new Map();
let seq = 0;
const clients = new Set();

const now = () => Date.now();
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
  const att = attachments?.length ? ` I received ${attachments.length} attachment(s): ${attachments.map(a => `${a.fileName} (${a.mimeType}, ${Math.round((a.content?.length || 0) * 0.75 / 1024)} KB)`).join(', ')}.` : '';
  return streamReply(sessionKey, `Got it: "${m || '(no text)'}".${att}`);
}

const handlers = {
  'agent.identity.get': () => ({ name: 'OpenClaw' }),
  'agents.list': () => ({ agents: [{ id: 'gateway-lucian', name: 'gateway-lucian' }] }),
  'sessions.list': () => ({ sessions: [...sessions.keys()].map(key => ({ key, agentId: 'gateway-lucian', label: key.split(':').pop(), updatedAt: now() })) }),
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
  res.end('mock openclaw gateway');
});

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
