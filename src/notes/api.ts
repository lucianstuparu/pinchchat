/**
 * Notes (our.infra notes.mjs; Lucian 2026-10-29: "capture ideas or notes for Casa Artlia but also main oc
 * that I can easily search for with agent"): what was shared (screenshots, a link, a line) and what the
 * assistant read from it. oc calls /reg/notes*, the Casa Artlia app /artlia/notes* (only its own notes).
 */
import { post } from '../app/api';
import type { OutgoingAttachment } from '../mobile/attachments';

export type Place = 'home' | 'artlia' | 'private';
export interface NoteFile { ref: string; name: string; mime: string }
export interface Note {
  id: string; place: Place; by: string; from: string; created: string; updated: string;
  said?: string; link?: string; files: NoteFile[];
  status: 'reading' | 'ready' | 'failed'; error?: string; place_by: 'guess' | 'person';
  title: string; summary?: string; details: Partial<Record<DetailKey, string>>; tags: string[]; archived?: boolean;
}
export type DetailKey = 'who' | 'what' | 'where' | 'phone' | 'email' | 'website' | 'price' | 'when';
export const DETAIL_KEYS: DetailKey[] = ['who', 'what', 'where', 'when', 'price', 'phone', 'email', 'website'];

export type NotesBase = '/reg' | '/artlia';
export const fetchNotes = (base: NotesBase) => post<{ notes: Note[] }>(`${base}/notes`, {}).then(r => r.notes);
export const addNote = (base: NotesBase, p: { said?: string; link?: string; files?: OutgoingAttachment[]; place?: Place }) =>
  post<{ note: Note }>(`${base}/notes/add`, {
    said: p.said || undefined, link: p.link || undefined, place: p.place,
    files: (p.files ?? []).map(f => ({ name: f.fileName, mimeType: f.mimeType, data: f.content })),
  }).then(r => r.note);
export const actNote = (base: NotesBase, note: string, action: 'place' | 'archive' | 'unarchive' | 'retry' | 'edit', extra: Record<string, unknown> = {}) =>
  post<{ note: Note }>(`${base}/notes/act`, { note, action, ...extra }).then(r => r.note);
export const noteFileUrl = (base: NotesBase, ref: string) => `${base}/notes/files/${ref}`;
/** Search by words and meaning (the app's search endpoint), only the notes: their ids, best first. */
export const searchNotes = (base: NotesBase, q: string) =>
  post<{ results: Array<{ kind: string; ref: string }> }>(`${base}/search`, { q })
    .then(r => r.results.filter(x => x.kind === 'note').map(x => x.ref));

/** The first web address in shared text, and the text without it. */
export function splitLink(text: string): { link: string; rest: string } {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text);
  if (!m) return { link: '', rest: text.trim() };
  return { link: m[0].replace(/[).,;!?]+$/, ''), rest: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\n{3,}/g, '\n\n').trim() };
}
