/**
 * The WhatsApp app's data (whatsapp.stuparu.eu; until its hostname exists, chat.stuparu.eu/wa/):
 * the person's own contacts and conversations from register-api /reg/wa/* on CT 103, the same store
 * as oc's assistant uses. Compose and translate are one model call each on the server; a message
 * leaves only through `act(draft, 'send')`, which the app calls after the Undo moment.
 */
import { post } from '../app/api';

export type Tone = 'informal' | 'formal';
export interface Contact {
  id: string; name: string; label: string; aliases: string[]; phone: string; lang: string; tone: Tone;
  last_sent?: string; sent: number; listen?: boolean; unread?: number; last_in?: { text: string; ts: string };
}
export interface WaMessage { id: string; from: 'them' | 'me'; text: string; transcript?: string; translation?: string; media?: string; ts: string; read?: boolean }
export type DraftStatus = 'draft' | 'sending' | 'sent' | 'cancelled' | 'failed' | 'expired';
export interface Draft { id: string; name: string; lang?: string; text: string; back?: string; status: DraftStatus; sent_at?: string; error?: string }

export const LANGS: Array<[string, string]> = [['ro', 'Romanian'], ['fr', 'French'], ['en', 'English'], ['ru', 'Russian'], ['de', 'German'], ['it', 'Italian'], ['es', 'Spanish']];
export const langName = (code: string) => LANGS.find(l => l[0] === code)?.[1] ?? code.toUpperCase();
/** The person's own language: what their messages are translated into (the server's MY_LANG). */
export const MY_LANG = 'ro';

export const fetchContacts = () => post<{ contacts: Contact[] }>('/reg/wa/contacts', {}).then(r => r.contacts);
export const saveContact = (c: Partial<Contact>) => post<{ ok: boolean; contact: Contact }>('/reg/wa/contact', c).then(r => r.contact);
export const fetchConversation = (contact: string) =>
  post<{ messages: WaMessage[] }>('/reg/wa/inbox', { contact, limit: 40 }).then(r => r.messages);
export const compose = (contact: string, text: string) => post<{ ok: boolean; draft: Draft }>('/reg/wa/compose', { contact, text }).then(r => r.draft);
export const translate = (id: string) => post<{ id: string; translation: string }>('/reg/wa/translate', { id }).then(r => r.translation);
export const act = (draft: string, action: 'send' | 'cancel' | 'edit', text?: string) =>
  post<Draft>('/reg/wa/act', { draft, action, ...(text !== undefined ? { text } : {}) });

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
