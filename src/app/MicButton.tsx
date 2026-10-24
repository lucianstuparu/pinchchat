import { L } from '../ui/lang';
import { ArrowUp, Loader2, Mic, Square, X } from 'lucide-react';
import type { Speech } from './speech';

/** The big round mic of both apps (see speech.ts). */
export function MicButton({ speech, size = 56 }: { speech: Speech; size?: number }) {
  const s = speech;
  if (!s.available) return null;
  return (
    <button type="button" onClick={s.toggle} disabled={s.state === 'writing' || s.state === 'starting'}
      aria-label={s.listening ? L('Done speaking') : s.state === 'writing' ? L('Writing what you said') : L('Speak ({engine})', { engine: s.engine })} aria-pressed={s.listening}
      style={{ width: size, height: size }}
      className={`relative flex shrink-0 items-center justify-center rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.18)] press ${
        s.listening ? 'bg-red-500 text-white' : 'bg-pc-accent text-[var(--pc-on-accent)]'}`}>
      {s.state === 'recording' && <span className="absolute inset-0 rounded-full bg-red-500/35 transition-transform duration-100" style={{ transform: `scale(${1 + Math.min(s.level * 1.6, 0.6)})` }} />}
      {s.state === 'live' && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />}
      {s.state === 'recording' || s.state === 'live' ? <Square size={size * 0.34} fill="currentColor" />
        : s.state === 'writing' || s.state === 'starting' ? <Loader2 size={size * 0.44} className="animate-spin" />
        : <Mic size={size * 0.48} strokeWidth={2.2} />}
    </button>
  );
}

/**
 * The one big button of an input bar (oc and Shopping, after ChatGPT's and WhatsApp's bars): the mic
 * while the box is empty, Send once there is something to send, Stop while listening.
 */
export function PrimaryButton({ speech, canSend, onSend, size = 56, sendLabel = L('Send') }: { speech: Speech; canSend: boolean; onSend: () => void; size?: number; sendLabel?: string }) {
  const busy = speech.listening || speech.state === 'writing' || speech.state === 'starting';
  if (busy || !canSend) return <MicButton speech={speech} size={size} />;
  return (
    <button type="button" onClick={onSend} aria-label={sendLabel} style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-pc-accent text-[var(--pc-on-accent)] shadow-[0_4px_14px_rgba(0,0,0,0.18)] press">
      <ArrowUp size={size * 0.46} strokeWidth={2.6} />
    </button>
  );
}

/**
 * Inside the text box, at its right edge, once there is text: Clear at the top and a mic at the bottom
 * to say more (the big button is Send by then). Both are full-size touch targets (40 px).
 */
export function FieldControls({ speech, hasText, onClear }: { speech: Speech; hasText: boolean; onClear: () => void }) {
  if (!hasText || speech.listening || speech.state === 'writing') return null;
  return (
    <div className="flex shrink-0 flex-col items-center justify-between self-stretch py-1">
      <button type="button" onClick={onClear} className="press flex h-10 w-10 items-center justify-center rounded-full text-pc-text-muted active:bg-[var(--pc-hover-strong)]" aria-label="Clear">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-pc-text-faint text-pc-surface"><X size={14} strokeWidth={3} /></span>
      </button>
      {speech.available && (
        <button type="button" onClick={speech.toggle} className="press flex h-10 w-10 items-center justify-center rounded-full text-[var(--pc-accent-ink)] active:bg-[var(--pc-hover-strong)]" aria-label={`Say more (${speech.engine})`}>
          <Mic size={22} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
