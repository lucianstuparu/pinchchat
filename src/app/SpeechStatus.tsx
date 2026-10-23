/**
 * While Whisper writes (several seconds on the home server): what is happening, for how long, and a
 * moving bar (my.design patterns/progress-row.md). Above the box, so it shows even when the box has text.
 */
import type { Speech } from './speech';

export function SpeechStatus({ speech }: { speech: Speech }) {
  if (speech.state !== 'writing') return null;
  return (
    <div className="mx-2 mb-1.5" role="status" aria-live="polite">
      <p className="text-[13px] text-pc-text-muted">Whisper is writing what you said{speech.secs >= 2 ? ` \u00b7 ${speech.secs} s (usually ~15 s)` : '\u2026'}</p>
      <div className="mt-1 h-1 overflow-hidden rounded-[2px] bg-[var(--pc-separator)]" aria-hidden><div className="progress-indeterminate h-full w-1/3 rounded-[2px] bg-pc-accent" /></div>
    </div>
  );
}
