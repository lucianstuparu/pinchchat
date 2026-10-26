/**
 * The spoken answer after a read-back ("Trimit?"): the mic listens a few seconds for a short yes or no.
 * Lucian 2026-10-26: "ask for confirmation ... and then if I say ok to send the message", from the car.
 * Only a short answer counts: "da", "ok", "trimite", "yes", "oui" sends (still with the 5 s Undo);
 * "nu", "stop", "anulează" drops it; anything else changes nothing and the buttons stay.
 */
import { canDictate, canRecord, dictate, getDictationLang, getSpeechMode, record, SILENT } from '../app/voice';
import { transcribeAudio } from '../app/api';

export type Answer = 'yes' | 'no' | 'other';

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\s]/gu, ' ').trim();
const YES = new Set(['da', 'ok', 'okay', 'okey', 'okei', 'trimite', 'trimitel', 'trimite-l', 'trimit', 'sigur', 'yes', 'yeah', 'send', 'oui', 'envoie']);
const NO = new Set(['nu', 'stop', 'anuleaza', 'renunt', 'renunta', 'lasa', 'no', 'cancel', 'non', 'nein', 'stai']);

/** A no anywhere wins ("nu trimite"); a yes counts when it comes first ("da, trimite"); at most three words. */
export function answerOf(said: string): Answer {
  const words = plain(said).split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 3) return 'other';
  if (words.some(w => NO.has(w))) return 'no';
  return YES.has(words[0]) ? 'yes' : 'other';
}

const LISTEN_MS = 6000;   // how long it waits for the answer
const QUIET_MS = 1000;    // after speech, this much quiet ends it

/** Listens once; resolves with what was said ('' for nothing). The returned stop() ends it early with ''. */
export function listenOnce(): { done: Promise<string>; stop: () => void } {
  let stop = () => undefined as void;
  const done = new Promise<string>(resolve => {
    let over = false;
    const finish = (t: string) => { if (!over) { over = true; resolve(t.trim()); } };
    if (getSpeechMode() === 'live' && canDictate()) {
      let last = '';
      let quiet: number | undefined;
      const d = dictate(getDictationLang(), t => {
        last = t;
        window.clearTimeout(quiet);
        quiet = window.setTimeout(() => d?.stop(), QUIET_MS);
      }, () => { window.clearTimeout(cap); window.clearTimeout(quiet); finish(last); });
      if (!d) { finish(''); return; }
      const cap = window.setTimeout(() => d.stop(), LISTEN_MS);
      stop = () => { window.clearTimeout(cap); window.clearTimeout(quiet); d.abort(); finish(''); };
      return;
    }
    if (!canRecord()) { finish(''); return; }
    let cancelled = false;
    stop = () => { cancelled = true; finish(''); };
    void (async () => {
      let r;
      try { r = await record(); } catch { finish(''); return; }
      const started = Date.now();
      let spoke = 0;
      const t = window.setInterval(async () => {
        const lv = r.level();
        if (lv > Math.max(SILENT * 2, r.peak() * 0.25)) spoke = Date.now();
        const end = cancelled || Date.now() - started > LISTEN_MS || (spoke && Date.now() - spoke > QUIET_MS);
        if (!end) return;
        window.clearInterval(t);
        const silent = r.peak() < SILENT || !spoke;
        const audio = await r.stop();
        if (cancelled || silent || !audio) { finish(''); return; }
        try { finish(await transcribeAudio(audio)); } catch { finish(''); }
      }, 120);
    })();
  });
  return { done, stop: () => stop() };
}
