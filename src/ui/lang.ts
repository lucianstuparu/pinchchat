/**
 * The words on shared screens, in the build's language. oc and Shopping are English; the Casa
 * Artlia app (VITE_APP=artlia) is Romanian, with French technical terms kept as they are
 * (ai.manager casa-artlia-app.md). `L('Undo')` returns the Romanian when the build is Romanian and
 * the English otherwise; `{x}` in a string is filled from `vars`. A string missing from the table
 * stays English, so nothing breaks while a word waits for its translation.
 */
export const RO = import.meta.env.VITE_APP === 'artlia';

const ro: Record<string, string> = {
  // input bar and voice
  'Message': 'Mesaj',
  'Send': 'Trimite',
  'Clear': 'Șterge',
  'Add': 'Adaugă',
  'Attach': 'Atașează',
  'Dismiss': 'Închide',
  'You': 'Tu',
  'Assistant': 'Asistentul',
  'Photo': 'Fotografie',
  'Cancel reply': 'Renunță la răspuns',
  'Photo or file': 'Fotografie sau fișier',
  'Voice message': 'Mesaj vocal',
  'sent as audio': 'trimis ca înregistrare',
  'Starting…': 'Pornește…',
  'Writing it down…': 'Se scrie…',
  'Writing down your voice message…': 'Se scrie mesajul vocal…',
  'Voice message {t}': 'Mesaj vocal {t}',
  'Send voice message': 'Trimite mesajul vocal',
  'Discard voice message': 'Renunță la mesajul vocal',
  '{label}, tap to remove': '{label}, atinge pentru a scoate',
  'Nothing was recorded': 'Nu s-a înregistrat nimic',
  'Microphone not available: allow it for this app in Chrome’s site settings': 'Microfonul nu e disponibil: permite-l pentru aplicație în setările site-ului din Chrome',
  'Microphone not available: allow it for this app in Chrome’s site settings.': 'Microfonul nu e disponibil: permite-l pentru aplicație în setările site-ului din Chrome.',
  'Microphone blocked: allow it for this app in Chrome’s site settings.': 'Microfon blocat: permite-l pentru aplicație în setările site-ului din Chrome.',
  'The mic stopped ({err}).': 'Microfonul s-a oprit ({err}).',
  'The microphone recorded only silence{device}. With a Bluetooth headset or watch connected, try again with it off.': 'Microfonul a înregistrat doar liniște{device}. Dacă e conectată o cască sau un ceas Bluetooth, încearcă fără.',
  'Nothing was understood. Try again a bit closer.': 'Nu s-a înțeles nimic. Încearcă din nou, mai aproape.',
  'Writing it took too long. Try a shorter piece.': 'A durat prea mult. Încearcă o bucată mai scurtă.',
  'Could not turn it into text. Try again.': 'Nu s-a putut transforma în text. Încearcă din nou.',
  'Listening (Live)… tap the mic when done': 'Ascult (Live)… atinge microfonul când ai terminat',
  'Starting the mic…': 'Pornește microfonul…',
  'The mic hears nothing… Bluetooth headset or watch connected?': 'Microfonul nu aude nimic… cască sau ceas Bluetooth conectat?',
  'Recording for Whisper {t}… tap the mic when done': 'Înregistrez pentru Whisper {t}… atinge microfonul când ai terminat',
  'Done speaking': 'Am terminat',
  'Writing what you said': 'Scriu ce ai spus',
  'Speak ({engine})': 'Vorbește ({engine})',
  'Whisper is writing what you said': 'Whisper scrie ce ai spus',
  ' · {s} s (usually ~15 s)': ' · {s} s (de obicei ~15 s)',
  // bubbles
  'Show all': 'Arată tot',
  'Show less': 'Arată mai puțin',
  'Reply': 'Răspunde',
  'Copy': 'Copiază',
  'Select': 'Selectează',
  'sending': 'se trimite',
  'sent': 'trimis',
  'Not sent — tap to retry': 'Netrimis — atinge pentru a reîncerca',
  'Retry': 'Reîncearcă',
  'OpenClaw is typing': 'Asistentul scrie',
  'Remove {name}': 'Scoate {name}',
  // failed turns (notice.ts)
  'No reply': 'Fără răspuns',
  'sign-in expired': 'autentificarea a expirat',
  'usage limit reached': 'limita de utilizare atinsă',
  'Claude is busy': 'Claude e ocupat',
  'took too long': 'a durat prea mult',
  'no connection': 'fără conexiune',
  'stopped': 'oprit',
  'something went wrong': 'ceva n-a mers',
  'server was busy': 'serverul era ocupat',
  // dates
  'Overdue ({d}d)': 'Întârziat ({d} z)',
  'Today': 'Azi',
  'Tomorrow': 'Mâine',
  // sheets, undo, search
  'Undo': 'Anulează',
  'Close': 'Închide',
  'Search': 'Caută',
  'Cancel': 'Renunță',
  'Settings': 'Setări',
};

export function L(en: string, vars?: Record<string, string | number>): string {
  let s = RO ? (ro[en] ?? en) : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
