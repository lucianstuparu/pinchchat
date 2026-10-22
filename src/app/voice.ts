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

/**
 * stop(): the recording as an attachment, or null when it was a slip of the finger.
 * level(): the input level right now, 0..1 (for a live meter); peak(): the loudest so far.
 * device: the microphone's name, when the browser tells it.
 */
export interface Recorder { stop: () => Promise<OutgoingAttachment | null>; level: () => number; peak: () => number; device: string }

/** Below this peak level the recording is silence (a muted or wrong microphone). */
export const SILENT = 0.02;

const isRemote = (label: string) => /bluetooth|headset|hands-?free|watch|airpods|buds/i.test(label);

/**
 * The phone's own microphone if it has one: with a Bluetooth headset or watch connected, Chrome may
 * take theirs, which often records silence (2026-10-22: a 2 KB "recording" of several seconds).
 */
async function openMic(): Promise<MediaStream> {
  const want: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  let stream = await navigator.mediaDevices.getUserMedia({ audio: want });
  const label = stream.getAudioTracks()[0]?.label ?? '';
  if (isRemote(label)) {
    const builtIn = (await navigator.mediaDevices.enumerateDevices())
      .find(d => d.kind === 'audioinput' && d.label && !isRemote(d.label) && d.deviceId !== 'default' && d.deviceId !== 'communications');
    if (builtIn) {
      stream.getTracks().forEach(t => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ audio: { ...want, deviceId: { exact: builtIn.deviceId } } });
    }
  }
  return stream;
}

/** Record a voice note; `stop()` returns it as an attachment (webm/opus or whatever the browser gives). */
export async function record(): Promise<Recorder> {
  const stream = await openMic();
  const type = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  // A level meter on the same stream: shows the person the mic hears them, and tells silence apart.
  let ctx: AudioContext | null = null, analyser: AnalyserNode | null = null, peakLevel = 0;
  try {
    ctx = new AudioContext();
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
  } catch { /* no meter: recording still works */ }
  const buf = new Uint8Array(512);
  const level = () => {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(buf);
    let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128));
    const l = Math.min(1, m / 100);
    if (l > peakLevel) peakLevel = l;
    return l;
  };
  const started = Date.now();
  rec.start(250);
  return {
    level, peak: () => { level(); return peakLevel; }, device: stream.getAudioTracks()[0]?.label ?? '',
    stop: () => new Promise(resolve => {
      rec.onstop = async () => {
        level();
        stream.getTracks().forEach(t => t.stop());
        void ctx?.close();
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (Date.now() - started < 400 || blob.size === 0) return resolve(null);   // a slip of the finger
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        resolve({ fileName: `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`, mimeType: blob.type, content: btoa(bin), size: blob.size });
      };
      rec.stop();
    }),
  };
}
