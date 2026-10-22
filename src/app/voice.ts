/**
 * Voice input (app v2 §3).
 *  - Dictation: the browser's speech recognition (Chrome on Android/desktop), text lands in the
 *    composer to be edited before sending.
 *  - Voice note: MediaRecorder audio sent as an attachment; the gateway transcribes it with
 *    Whisper and keeps the original.
 */
import type { OutgoingAttachment } from '../mobile/attachments';

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

const Ctor = (): (new () => Recognition) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const canDictate = () => typeof window !== 'undefined' && Ctor() !== null;
export const canRecord = () => typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;

/** stop(): finish and deliver the last words; abort(): stop and drop them (the text was sent). */
export interface Dictation { stop: () => void; abort: () => void }

/** Dictation languages offered in the app; the choice is kept per device. */
export const DICTATION_LANGS = [
  { code: 'ro-RO', short: 'RO', name: 'Română' },
  { code: 'en-GB', short: 'EN', name: 'English' },
  { code: 'fr-FR', short: 'FR', name: 'Français' },
] as const;
const LANG_KEY = 'openclaw-pwa:dictation-lang';
export function getDictationLang(): string {
  try { const v = localStorage.getItem(LANG_KEY); if (v && DICTATION_LANGS.some(l => l.code === v)) return v; } catch { /* default */ }
  return 'ro-RO';
}
export function setDictationLang(code: string) { try { localStorage.setItem(LANG_KEY, code); } catch { /* not kept */ } }

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Joins the recogniser's pieces into one text without repeats. Chrome on Android sends each
 * finished phrase with everything said before it in the session ("call", "call the bank",
 * "call the bank on Friday"), and sometimes re-sends a piece; desktop Chrome sends separate
 * pieces. A piece that already contains the text so far replaces it, a piece the text already
 * ends with is skipped, anything else is appended.
 */
export function mergePieces(pieces: string[]): string {
  let acc = '';
  for (const raw of pieces) {
    const p = raw.trim();
    if (!p) continue;
    const a = norm(acc), n = norm(p);
    if (!a || n.startsWith(a)) acc = p;
    else if (a.endsWith(n) || a.includes(n)) continue;
    else acc = `${acc} ${p}`;
  }
  return acc;
}

/** Start dictating; `onText(text)` gets the whole text so far (finished + in progress). */
export function dictate(lang: string, onText: (text: string, interim: boolean) => void, onEnd: (error?: string) => void): Dictation | null {
  const C = Ctor();
  if (!C) return null;
  const r = new C();
  r.lang = lang; r.continuous = true; r.interimResults = true;
  r.onresult = (e) => {
    const finals: string[] = [];
    let interim = '';
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finals.push(res[0].transcript);
      else interim = res[0].transcript;   // the last one in progress is the whole current phrase
    }
    onText(mergePieces(interim ? [...finals, interim] : finals), !!interim);
  };
  r.onerror = (e) => onEnd(e.error === 'no-speech' || e.error === 'aborted' ? undefined : e.error);
  r.onend = () => onEnd();
  r.start();
  return { stop: () => r.stop(), abort: () => r.abort() };
}

export interface Recorder { stop: () => Promise<OutgoingAttachment | null> }

/** Record a voice note; `stop()` returns it as an attachment (webm/opus or whatever the browser gives). */
export async function record(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  const started = Date.now();
  rec.start(250);
  return {
    stop: () => new Promise(resolve => {
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (Date.now() - started < 400 || blob.size === 0) return resolve(null);   // a slip of the finger
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        resolve({ fileName: `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`, mimeType: blob.type, content: btoa(bin), size: blob.size });
      };
      rec.stop();
    }),
  };
}
