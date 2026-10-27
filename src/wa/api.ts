/**
 * Relay's data. Two servers:
 *  - CT 103 register-api /reg/wa/*: the person's contacts, the WhatsApp inbox, drafts and Send (the
 *    WhatsApp link lives in OpenClaw there);
 *  - CT 113 relay-api /relay/*: the per-person agents (Codex) that write in the contact's language and
 *    style, translate, and learn: style card from samples, memory from each exchange.
 * A WhatsApp message leaves only through `act(draft, 'send')`, which the app calls after the Undo
 * moment. Contacts on other channels (email, SMS, another app) get their text to copy or share.
 */
import { post } from '../app/api';

export type Tone = 'informal' | 'formal';
export type Channel = 'whatsapp' | 'email' | 'sms' | 'other';
export interface Contact {
  id: string; name: string; label: string; aliases: string[]; phone: string; email?: string; lang: string; tone: Tone; channel: Channel;
  last_sent?: string; sent: number; listen?: boolean; unread?: number; last_in?: { text: string; ts: string };
}
export interface WaMessage { id: string; from: 'them' | 'me'; text: string; transcript?: string; translation?: string; media?: string; ts: string; read?: boolean }
export type DraftStatus = 'draft' | 'sending' | 'sent' | 'cancelled' | 'failed' | 'expired';
export interface Draft {
  id: string; name: string; lang?: string; text: string; back?: string; status: DraftStatus; sent_at?: string; error?: string;
  /** Kept in Drafts ("Later", or prepared by a mail rule): no 24 h expiry. */
  contact?: string; saved?: boolean; saved_at?: string; origin?: 'relay' | 'rule'; why?: string; created?: string;
}
export interface HistoryEntry { ts: string; kind: 'theirs' | 'mine'; text: string; src?: string }
export interface AgentProfile { style: string; memory: string; samples: Array<{ name: string; size: number; added: string }>; history: HistoryEntry[]; translations?: Record<string, string> }

export const LANGS: Array<[string, string]> = [['ro', 'Romanian'], ['fr', 'French'], ['en', 'English'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['de', 'German'], ['it', 'Italian'], ['es', 'Spanish']];
export const langName = (code: string) => LANGS.find(l => l[0] === code)?.[1] ?? code.toUpperCase();
export const CHANNELS: Array<[Channel, string]> = [['whatsapp', 'WhatsApp'], ['email', 'Email'], ['sms', 'SMS'], ['other', 'Other app']];
export const channelName = (c?: Channel) => CHANNELS.find(x => x[0] === (c ?? 'whatsapp'))?.[1] ?? 'WhatsApp';
/** The person's own language: what everything is translated into (relay-api MY_LANG). */
export const MY_LANG = 'ro';

// ---- CT 103: contacts, WhatsApp
export const fetchContacts = () => post<{ contacts: Contact[]; wa?: boolean }>('/reg/wa/contacts', {})
  .then(r => ({ contacts: r.contacts.map(c => ({ ...c, channel: c.channel ?? 'whatsapp' })), wa: r.wa !== false }));
export const saveContact = (c: Partial<Contact>) => post<{ ok: boolean; contact: Contact }>('/reg/wa/contact', c).then(r => r.contact);
export const fetchConversation = (contact: string) =>
  post<{ messages: WaMessage[] }>('/reg/wa/inbox', { contact, limit: 40 }).then(r => r.messages);
export const waDraft = (contact: string, text: string, back?: string) =>
  post<{ ok: boolean; draft: Draft }>('/reg/wa/draft', { contact, text, back }).then(r => r.draft);
export const act = (draft: string, action: 'send' | 'cancel' | 'edit' | 'save' | 'unsave' | 'used' | 'restore', text?: string) =>
  post<Draft>('/reg/wa/act', { draft, action, ...(text !== undefined ? { text } : {}) });
/** Drafts: messages kept for later (Later on the card, or prepared by a mail rule), until sent, copied or dropped. */
export const fetchDrafts = () => post<{ drafts: Draft[] }>('/reg/wa/drafts', {}).then(r => r.drafts);
/** A message written here but not on the server yet (another channel) kept in Drafts. */
export const keepDraft = (contact: string, text: string, back?: string) =>
  post<{ ok: boolean; draft: Draft }>('/reg/wa/draft', { contact, text, back, saved: true }).then(r => r.draft);

// ---- CT 113: the person's agents
type AgentContact = Pick<Contact, 'id' | 'name' | 'label' | 'lang' | 'tone' | 'channel'>;
const asAgent = (c: Contact): AgentContact => ({ id: c.id, name: c.name, label: c.label, lang: c.lang, tone: c.tone, channel: c.channel });
export const compose = (c: Contact, said: string, replyTo?: string) =>
  post<{ text: string; back?: string }>('/relay/compose', { contact: asAgent(c), said, reply_to: replyTo });
export const translate = (text: string, c?: Contact, msgId?: string) =>
  post<{ translation: string; lang: string }>('/relay/translate', { text, contact: c ? asAgent(c) : undefined, msg_id: msgId });
/** Dictated with what to do ("translate this into French informal: …"): the text in that language, ready to copy. */
export const phrase = (said: string) =>
  post<{ text: string; lang: string; tone: 'formal' | 'informal'; back: string }>('/relay/phrase', { said });
/** What was said or typed starts by asking for a translation (Romanian, English, French, Russian, Ukrainian). */
export const asksTranslation = (t: string) =>
  /^[\s"'«„]*(?:(?:please|te rog|s'il te plaît|пожалуйста)[\s,]+)?(?:translate|tradu|traduce|traduceți|traduceti|traduis|traduisez|переведи|переведите|переклади)(?=[\s,:.!]|$)/i.test(t);
export const learn = (c: Contact, sent: string, said?: string, theirs?: string) =>
  post<{ ok: boolean }>('/relay/learn', { contact: asAgent(c), sent, said, theirs });
export const theyWrote = (c: Contact, text: string) => post<{ ok: boolean }>('/relay/they', { contact: asAgent(c), text });
export const agentProfile = (c: Contact) => post<AgentProfile>('/relay/profile', { contact: asAgent(c) });
export const saveStyle = (c: Contact, style: string) => post<{ ok: boolean }>('/relay/style', { contact: asAgent(c), style });
export const addSample = (c: Contact, name: string, text: string) =>
  post<{ file: string; style: string }>('/relay/sample', { contact: asAgent(c), name, text });
export const deleteSample = (c: Contact, name: string) => post<{ ok: boolean }>('/relay/sample-delete', { contact: asAgent(c), name });

/** Each person keeps one colour (from their id), so a face is found by colour before the name is read. */
const FACES = ['#d9534f', '#1f8f63', '#2f7fd8', '#7b5bd6', '#c8811a', '#c2477f', '#11938a', '#566a8a'];
export function faceColour(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FACES[h % FACES.length];
}

export const timeOf = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const y = new Date(); y.setDate(now.getDate() - 1);
  const hm = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return hm;
  if (d.toDateString() === y.toDateString()) return `Yesterday ${hm}`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Whether this contact's messages go out on WhatsApp from here (the owner's WhatsApp, a number on file). */
export const viaWhatsApp = (c: Contact, waOwner: boolean) => c.channel === 'whatsapp' && waOwner && !!c.phone;

// ---- faces (CT 113): a photo per person, added by hand (e.g. saved from WhatsApp), kept on the phone too
export type Photos = Record<string, { v: number; data: string }>;
const PHOTOS = 'wa:photos';
export const cachedPhotos = (): Photos => { try { return JSON.parse(localStorage.getItem(PHOTOS) || '{}') as Photos; } catch { return {}; } };
/** The server's faces; only those changed since the phone's copy come with their picture. */
export async function fetchPhotos(have: Photos): Promise<Photos> {
  const known = Object.fromEntries(Object.entries(have).map(([id, p]) => [id, p.v]));
  const r = await post<{ photos: Record<string, { v: number; data?: string }> }>('/relay/photos', { known });
  const out: Photos = {};
  for (const [id, p] of Object.entries(r.photos)) { const data = p.data ?? (have[id]?.v === p.v ? have[id].data : undefined); if (data) out[id] = { v: p.v, data }; }
  try { localStorage.setItem(PHOTOS, JSON.stringify(out)); } catch { /* not kept */ }
  return out;
}
export const savePhoto = (c: Contact, data: string) => post<{ v: number }>('/relay/photo', { contact: asAgent(c), data });
export const deletePhoto = (c: Contact) => post<{ ok: boolean }>('/relay/photo-delete', { contact: asAgent(c) });

/** A picture from the phone as a small square JPEG (the middle of it), for a face. */
export async function squareJpeg(file: File, size = 256): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This phone cannot read the picture');
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

// ---- who it is for: the main mic ("spune-i bunicii că ajung la 7")
const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
/**
 * The person named in what was said, on the phone: their shown name, first or full name, or another name
 * they are called, also declined ("bunicii", "Ludmilei": a long name matches without its last letter).
 * The one named first wins; null when nobody is named, or two are named at the same place (then the agent picks).
 */
export function matchContact(said: string, people: Contact[]): Contact | null {
  const words = plain(said).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const text = ` ${words.join(' ')} `;
  let best: { at: number; c: Contact } | null = null, tie = false;
  for (const c of people) {
    const names = [c.label, c.name, ...c.name.split(/\s+/).slice(0, 1), ...(c.aliases ?? [])].map(plain).map(n => n.trim()).filter(n => n.length >= 3);
    let at = Infinity;
    for (const n of names) {
      if (n.includes(' ')) { const i = text.indexOf(` ${n.split(/[^\p{L}\p{N}]+/u).join(' ')} `); if (i >= 0) at = Math.min(at, text.slice(0, i).split(' ').length - 1); continue; }
      const stem = n.length >= 5 ? n.slice(0, -1) : n;
      const i = words.findIndex(w => (n.length >= 5 ? w.startsWith(stem) && w.length <= n.length + 3 : w === n));
      if (i >= 0) at = Math.min(at, i);
    }
    if (at === Infinity) continue;
    if (!best || at < best.at) { best = { at, c }; tie = false; }
    else if (at === best.at && best.c.id !== c.id) tie = true;
  }
  return best && !tie ? best.c : null;
}
export const pickContact = (said: string, people: Contact[]) =>
  post<{ id: string }>('/relay/pick', { said, people: people.map(c => ({ id: c.id, label: c.label, name: c.name, aliases: c.aliases ?? [] })) }).then(r => r.id);
