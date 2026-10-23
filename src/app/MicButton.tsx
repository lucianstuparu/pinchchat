import { Loader2, Mic, Square } from 'lucide-react';
import type { Speech } from './speech';

/** The big round mic of both apps (see speech.ts). */
export function MicButton({ speech, size = 56 }: { speech: Speech; size?: number }) {
  const s = speech;
  if (!s.available) return null;
  return (
    <button type="button" onClick={s.toggle} disabled={s.state === 'writing' || s.state === 'starting'}
      aria-label={s.listening ? 'Done speaking' : s.state === 'writing' ? 'Writing what you said' : `Speak (${s.engine})`} aria-pressed={s.listening}
      style={{ width: size, height: size }}
      className={`relative flex shrink-0 items-center justify-center rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform active:scale-95 ${
        s.listening ? 'bg-red-500 text-white' : 'bg-pc-accent text-[var(--pc-on-accent)]'}`}>
      {s.state === 'recording' && <span className="absolute inset-0 rounded-full bg-red-500/35 transition-transform duration-100" style={{ transform: `scale(${1 + Math.min(s.level * 1.6, 0.6)})` }} />}
      {s.state === 'live' && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />}
      {s.state === 'recording' || s.state === 'live' ? <Square size={size * 0.34} fill="currentColor" />
        : s.state === 'writing' || s.state === 'starting' ? <Loader2 size={size * 0.44} className="animate-spin" />
        : <Mic size={size * 0.48} strokeWidth={2.2} />}
    </button>
  );
}
