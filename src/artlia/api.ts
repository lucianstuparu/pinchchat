/**
 * The Casa Artlia app's data: one shared list on CT 103 (/srv/shared/artlia), read and changed
 * through register-api's /artlia/* routes (ai.manager casa-artlia-app.md). The last list is kept on
 * the phone, so the app opens with it at once and still shows it offline.
 */
import { post } from '../app/api';

export type Kind = 'task' | 'check' | 'decision' | 'milestone';
export type Status = 'todo' | 'check' | 'waiting' | 'done' | 'cancelled';
export type Phase = 'lucrari' | 'deschidere' | 'dupa';
export type Need = 'must' | 'firm' | 'adj' | 'other';

export interface ArtFile { name: string; ref: string; at: string; by?: string }
export interface ArtItem {
  id: string; n?: number; kind?: Kind; title: string; cat: string; phase?: Phase; need?: Need;
  status: Status; due_date?: string; priority?: string; snoozed_until?: string;
  what?: string; todo?: string; evidence?: string; src?: string; watch?: string;
  notes?: string; files?: ArtFile[]; source?: string; added_by?: string; updated?: string;
  /** The ERP checklist's own sections: first | proc | acc | fire | ops | other. */
  group?: string;
}
export interface Category { id: string; label: string; desc?: string; order?: number }
export interface ArtList { today: string; categories: Category[]; items: ArtItem[]; glossary: Record<string, string> }

export type ArtAction = 'done' | 'reopen' | 'snooze' | 'drop' | 'undo' | 'edit' | 'status' | 'note';

const CACHE = 'artlia:list';

export function cachedList(): ArtList | null {
  try { const s = localStorage.getItem(CACHE); return s ? (JSON.parse(s) as ArtList) : null; } catch { return null; }
}

export async function fetchList(): Promise<ArtList> {
  const l = await post<ArtList>('/artlia/list', {});
  try { localStorage.setItem(CACHE, JSON.stringify(l)); } catch { /* full or blocked: the next open fetches again */ }
  return l;
}

export const actOn = (item: string, action: ArtAction, extra: Record<string, unknown> = {}) =>
  post<{ ok: boolean; item?: ArtItem; error?: string }>('/artlia/act', { item, action, ...extra });

export const addItem = (fields: { title: string; cat: string; kind?: Kind; due_date?: string; phase?: Phase; notes?: string }) =>
  post<{ ok: boolean; item: ArtItem }>('/artlia/add', fields);

export const uploadFile = (item: string, file: { name: string; mimeType: string; data: string }) =>
  post<{ ok: boolean; item: ArtItem }>('/artlia/file', { item, ...file });

export const fileUrl = (ref: string) => `/artlia/files/${encodeURIComponent(ref)}`;
