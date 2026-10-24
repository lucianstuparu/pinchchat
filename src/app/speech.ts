/**
 * The mic, one for both apps (oc and Shopping; oc-app-design.md §6): a big round button at the
 * bottom right. It only writes: what is said lands in the text box, to edit or add to; nothing is
 * sent until Send. Tapping it again adds more.
 *  - Live (Settings > The mic): the phone's recogniser writes while you speak, in one language;
 *  - Whisper: the recording goes to the home server, any language or a mix, the text comes after.
 */
import { L } from '../ui/lang';
import { useEffect, useRef, useState } from 'react';
import type { OutgoingAttachment } from '../mobile/attachments';
import { SILENT, canDictate, canRecord, dictate, getDictationLang, getSpeechMode, record, type Dictation, type Recorder } from './voice';

export type MicState = 'idle' | 'starting' | 'recording' | 'writing' | 'live';

export interface Speech {
  state: MicState;
  listening: boolean;
  available: boolean;
  /** 'Live' or 'Whisper': which one this tap will use. */
  engine: 'Live' | 'Whisper';
  secs: number;
  level: number;
  /** false after a few seconds of silence while recording. */
  heard: boolean;
  error: string | null;
  clearError: () => void;
  toggle: () => void;
  /** The text was sent or cleared: stop, and drop anything still on its way. */
  cancel: () => void;
}

/** `text` is the box as it is now (Live writes after it); `setText` receives an updater. */
export function useSpeech(text: string, setText: (f: (prev: string) => string) => void,
  transcribe: (audio: OutgoingAttachment) => Promise<string>): Speech {
  const textNow = useRef(text);
  useEffect(() => { textNow.current = text; }, [text]);
  const [state, setState] = useState<MicState>('idle');
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recorder | null>(null);
  const dict = useRef<Dictation | null>(null);
  const round = useRef(0);   // bumped on send/clear, so late text is dropped
  const live = getSpeechMode() === 'live' && canDictate();

  const cancel = () => {
    round.current++;
    if (rec.current) { const r = rec.current; rec.current = null; void r.stop(); }
    if (dict.current) { const d = dict.current; dict.current = null; d.abort(); }
    setState('idle');
  };

  const toggle = async () => {
    setError(null);
    if (state === 'live') { dict.current?.stop(); return; }   // its last words still land
    if (state === 'idle' && live) {
      const mine = ++round.current;
      const now = textNow.current;
      const base = now.trim() ? now.replace(/\s*$/, ' ') : '';
      const d = dictate(getDictationLang(), t => { if (round.current === mine) setText(() => base + t); }, err => {
        if (round.current !== mine) return;
        dict.current = null; setState('idle');
        if (err === 'not-allowed') setError(L('Microphone blocked: allow it for this app in Chrome’s site settings.'));
        else if (err) setError(L('The mic stopped ({err}).', { err }));
      });
      if (d) { dict.current = d; setState('live'); }
      return;
    }
    if (state === 'idle') {
      setState('starting');
      try { rec.current = await record(); setSecs(0); setState('recording'); }
      catch { setState('idle'); setError(L('Microphone not available: allow it for this app in Chrome’s site settings.')); }
      return;
    }
    if (state !== 'recording' || !rec.current) return;
    const r = rec.current; rec.current = null;
    const mine = round.current;
    const silent = r.peak() < SILENT;
    setSecs(0); setState('writing');
    const audio = await r.stop();
    if (!audio) { setState('idle'); return; }
    if (silent) {
      setState('idle');
      setError(L('The microphone recorded only silence{device}. With a Bluetooth headset or watch connected, try again with it off.', { device: r.device ? ` (${r.device})` : '' }));
      return;
    }
    try {
      const t = (await transcribe(audio)).trim();
      if (round.current === mine && t) setText(prev => (prev.trim() ? `${prev.replace(/\s*$/, ' ')}${t}` : t));
      else if (!t) setError(L('Nothing was understood. Try again a bit closer.'));
    } catch (e) {
      setError(e instanceof Error && e.message === 'offline' ? L('Speech needs a connection; type it for now.')
        : e instanceof Error && e.message === 'slow' ? L('Writing it took too long. Try a shorter piece.') : L('Could not turn it into text. Try again.'));
    } finally { if (round.current === mine) setState('idle'); }
  };

  useEffect(() => {
    if (state !== 'recording') return;
    const t = window.setInterval(() => setSecs(n => n + 1), 1000);
    const m = window.setInterval(() => {
      const r = rec.current; if (!r) return;
      setLevel(r.level());
      setHeard(r.peak() >= SILENT);
    }, 120);
    return () => { window.clearInterval(t); window.clearInterval(m); setLevel(0); setHeard(true); };
  }, [state]);
  // While Whisper writes, count the seconds too, so the box can say how long it has been.
  useEffect(() => {
    if (state !== 'writing') return;
    const t = window.setInterval(() => setSecs(n => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [state]);
  useEffect(() => () => { void rec.current?.stop(); dict.current?.abort(); }, []);

  return {
    state, listening: state === 'live' || state === 'recording' || state === 'starting',
    available: canRecord() || canDictate(), engine: live ? 'Live' : 'Whisper',
    secs, level, heard, error, clearError: () => setError(null), toggle: () => void toggle(), cancel,
  };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The text box's placeholder while the mic works; `idle` when it does not. */
export function speechPlaceholder(s: Speech, idle: string): string {
  if (s.state === 'live') return L('Listening (Live)… tap the mic when done');
  if (s.state === 'starting') return L('Starting the mic…');
  if (s.state === 'recording') {
    return s.secs >= 3 && !s.heard ? L('The mic hears nothing… Bluetooth headset or watch connected?')
      : L('Recording for Whisper {t}… tap the mic when done', { t: clock(s.secs) });
  }
  if (s.state === 'writing') return '';   // SpeechStatus above the box says it, with the time
  return idle;
}
