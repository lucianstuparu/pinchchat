/**
 * Read text aloud with the phone's own voice (Web Speech synthesis; nothing leaves the phone), in the
 * text's language: Romanian for bunica, French for Fleur… For use on the go (Lucian, 2026-10-24:
 * "I contact her when I am out, so not with empty hands").
 */
const LOCALE: Record<string, string> = { ro: 'ro-RO', fr: 'fr-FR', en: 'en-GB', ru: 'ru-RU', de: 'de-DE', it: 'it-IT', es: 'es-ES' };

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Speak the texts one after the other; returns a stop function. `onEnd` runs when all are done or stopped. */
export function speak(texts: string[], lang = 'ro', onEnd?: () => void): () => void {
  if (!canSpeak()) { onEnd?.(); return () => undefined; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const locale = LOCALE[lang] ?? lang;
  const voice = synth.getVoices().find(v => v.lang === locale) ?? synth.getVoices().find(v => v.lang.startsWith(lang));
  const parts = texts.map(t => t.replace(/\*\*/g, '').trim()).filter(Boolean);
  if (parts.length === 0) { onEnd?.(); return () => undefined; }
  let left = parts.length;
  for (const t of parts) {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = locale;
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = u.onerror = () => { if (--left === 0) onEnd?.(); };
    synth.speak(u);
  }
  return () => { synth.cancel(); onEnd?.(); };
}
