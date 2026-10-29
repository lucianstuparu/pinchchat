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
  'Speech needs a connection; type it for now.': 'Dictarea are nevoie de conexiune; scrie deocamdată.',
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
  'Read aloud': 'Citește cu voce tare',
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
  // WhatsApp card
  'to': 'către', 'Message text': 'Textul mesajului', 'Not sent': 'Nu s-a trimis', 'Sent {t}': 'Trimis {t}',
  'Expired · ask again': 'Expirat · cere-l din nou', 'Done': 'Gata', 'Sending…': 'Se trimite…',
  'Edit the text': 'Editează textul', 'Do not send': 'Nu trimite', 'Could not send it': 'Nu s-a putut trimite',
  // sheets, undo, search
  'Undo': 'Anulează',
  'Close': 'Închide',
  'Search': 'Caută',
  'Cancel': 'Renunță',
  'Settings': 'Setări',
  'Similar meaning': 'Sens apropiat',
  'Ask the assistant': 'Întreabă asistentul',
  'Searching further…': 'Se caută mai departe…',
  'Clear search': 'Golește căutarea',
  // notes (src/notes)
  'Notes': 'Note', 'Home': 'Acasă', 'Casa Artlia': 'Casa Artlia', 'Private': 'Privat', 'All': 'Toate', 'Where': 'Unde',
  'Who': 'Cine', 'What': 'Ce', 'When': 'Când', 'Price': 'Preț', 'Phone': 'Telefon', 'Email': 'Email', 'Website': 'Site',
  'Search the notes': 'Caută în note', 'New note': 'Notă nouă', 'Loading…': 'Se încarcă…', 'No connection': 'Fără conexiune',
  'No notes match.': 'Nicio notă nu se potrivește.',
  'Share a screenshot, a link or a text to this app and choose “Keep as a note”. The assistant reads it and fills in the details.':
    'Trimite aici (Partajează) o captură de ecran, un link sau un text și alege „Păstrează ca notă”. Asistentul o citește și completează detaliile.',
  'Reading it…': 'Se citește…', 'could not be read': 'nu s-a putut citi', 'Archived: {t}': 'Arhivat: {t}', 'Moved to {p}': 'Mutat în {p}',
  'The assistant could not read it.': 'Asistentul nu a putut-o citi.', 'Try again': 'Încearcă din nou', 'Photo, full size': 'Fotografia, mărită',
  'Written with it': 'Scris odată cu ea', 'Where it belongs': 'Unde ține', 'Where it belongs (the assistant’s guess)': 'Unde ține (după asistent)',
  'Archive': 'Arhivează', 'Keep as a note': 'Păstrează ca notă', 'Keeping…': 'Se păstrează…', 'Send in the chat instead': 'Trimite în chat',
  'The assistant reads it, writes down the details and tags, and guesses where it belongs. You can change it after.':
    'Asistentul o citește, notează detaliile și etichetele și ghicește unde ține. Poți schimba după.',
  'Link (optional)': 'Link (opțional)', 'Link': 'Link', 'A line with it': 'Un rând cu ea',
  'A line with it (optional): “for the Artlia kitchen?”': 'Un rând (opțional): „pentru bucătăria Artlia?”', 'What to keep': 'Ce păstrezi',
  'Add a photo or screenshot': 'Adaugă o poză sau o captură', 'Could not add {n}': 'Nu s-a putut adăuga {n}', 'Remove {n}': 'Scoate {n}',
  'Could not keep it': 'Nu s-a putut păstra', 'Kept. The assistant is reading it.': 'Păstrată. Asistentul o citește.',
};

export function L(en: string, vars?: Record<string, string | number>): string {
  let s = RO ? (ro[en] ?? en) : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
