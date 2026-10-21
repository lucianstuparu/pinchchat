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

export interface Dictation { stop: () => void }

/** Start dictating; `onText(final, interim)` is called as words arrive. Resolves when it ends. */
export function dictate(lang: string, onText: (final: string, interim: string) => void, onEnd: (error?: string) => void): Dictation | null {
  const C = Ctor();
  if (!C) return null;
  const r = new C();
  r.lang = lang; r.continuous = true; r.interimResults = true;
  r.onresult = (e) => {
    // Rebuild from all results every time: Android Chrome re-sends earlier results with a reset
    // resultIndex, so appending would repeat words.
    let finalText = '', interim = '';
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript.trim() + ' ';
      else interim += res[0].transcript;
    }
    onText(finalText, interim);
  };
  r.onerror = (e) => onEnd(e.error === 'no-speech' ? undefined : e.error);
  r.onend = () => onEnd();
  r.start();
  return { stop: () => r.stop() };
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
        if (Date.now() - started < 700 || blob.size < 1000) return resolve(null);   // a tap, not a note
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        resolve({ fileName: `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`, mimeType: blob.type, content: btoa(bin), size: blob.size });
      };
      rec.stop();
    }),
  };
}
