/**
 * Read text aloud with the phone's own voice (Web Speech synthesis; nothing leaves the phone), in the
 * text's language: Romanian for bunica, French for Fleur… For use on the go (Lucian, 2026-10-24:
 * "I contact her when I am out, so not with empty hands").
 */
const LOCALE: Record<string, string> = { ro: 'ro-RO', fr: 'fr-FR', en: 'en-GB', ru: 'ru-RU', de: 'de-DE', it: 'it-IT', es: 'es-ES' };

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Speak the texts one after the other; returns a stop function. `onEnd` runs when all are done or stopped. */
export function speak(texts: string[], lang = 'ro', onEnd?: () => void): () => void {
  return speakParts(texts.map(text => ({ text, lang })), onEnd);
}

/** The same with a language per part: Relay's read-back says "To Fleur" in Romanian, the message in French. */
export function speakParts(list: Array<{ text: string; lang: string }>, onEnd?: () => void): () => void {
  if (!canSpeak()) { onEnd?.(); return () => undefined; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const parts = list.map(p => ({ ...p, text: p.text.replace(/\*\*/g, '').trim() })).filter(p => p.text);
  if (parts.length === 0) { onEnd?.(); return () => undefined; }
  let left = parts.length, ended = false;
  const finish = () => { if (!ended) { ended = true; onEnd?.(); } };
  for (const p of parts) {
    const locale = LOCALE[p.lang] ?? p.lang;
    const voice = synth.getVoices().find(v => v.lang === locale) ?? synth.getVoices().find(v => v.lang.startsWith(p.lang));
    const u = new SpeechSynthesisUtterance(p.text);
    u.lang = locale;
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = u.onerror = () => { if (--left === 0) finish(); };
    synth.speak(u);
  }
  return () => { synth.cancel(); finish(); };
}
