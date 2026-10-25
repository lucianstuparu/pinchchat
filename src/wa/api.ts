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
export interface Draft { id: string; name: string; lang?: string; text: string; back?: string; status: DraftStatus; sent_at?: string; error?: string }
export interface HistoryEntry { ts: string; kind: 'theirs' | 'mine'; text: string; src?: string }
export interface AgentProfile { style: string; memory: string; samples: Array<{ name: string; size: number; added: string }>; history: HistoryEntry[] }

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
export const act = (draft: string, action: 'send' | 'cancel' | 'edit', text?: string) =>
  post<Draft>('/reg/wa/act', { draft, action, ...(text !== undefined ? { text } : {}) });

// ---- CT 113: the person's agents
type AgentContact = Pick<Contact, 'id' | 'name' | 'label' | 'lang' | 'tone' | 'channel'>;
const asAgent = (c: Contact): AgentContact => ({ id: c.id, name: c.name, label: c.label, lang: c.lang, tone: c.tone, channel: c.channel });
export const compose = (c: Contact, said: string, replyTo?: string) =>
  post<{ text: string; back?: string }>('/relay/compose', { contact: asAgent(c), said, reply_to: replyTo });
export const translate = (text: string, c?: Contact, msgId?: string) =>
  post<{ translation: string; lang: string }>('/relay/translate', { text, contact: c ? asAgent(c) : undefined, msg_id: msgId });
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
