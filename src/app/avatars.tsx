/** The two faces of the chat: ME (the person) and the agent's mark. Inline SVG, theme colours. */
import { getUiMode } from '../mobile/uiMode';

/** The coach, and oc's icon (tools/oc-icons.py): a disc with a dot; while it thinks the dot breathes (index.css), and stops with the first token. */
export function CoachMark({ thinking, className = 'h-6 w-6' }: { thinking?: boolean; className?: string }) {
  return (
    <span role="img" aria-label={thinking ? 'The coach is thinking' : 'Coach'} className={`inline-flex ${className} shrink-0 items-center justify-center rounded-full bg-[#f72585]`}>
      <span className={`block aspect-square w-[37.5%] rounded-full bg-white ${thinking ? 'coach-breathe' : ''}`} />
    </span>
  );
}

/** oc v2's person: a neutral disc with the initial. */
export function PersonMark({ name }: { name: string }) {
  return (
    <span role="img" aria-label={name} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e9e9ee] text-[13px] font-bold leading-none text-[#b5179e]">{name[0]?.toUpperCase()}</span>
  );
}

export function MeAvatar({ className = 'h-7 w-7', name }: { className?: string; name?: string }) {
  if (name && getUiMode() === 'v2') return <PersonMark name={name} />;
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-full shadow-sm`} aria-label="Me" role="img">
      <circle cx="16" cy="16" r="16" fill="var(--pc-accent)" />
      <text x="16" y="20.5" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="12" fontWeight="700" fill="#fff" letterSpacing="0.5">ME</text>
    </svg>
  );
}

export function AgentAvatar({ className = 'h-7 w-7', thinking }: { className?: string; thinking?: boolean }) {
  // Casa Artlia's assistant: the icon's house on the accent's pair (pink), never the chat app's mark
  // (Lucian 2026-10-25: it read like his own "ME").
  if (import.meta.env.VITE_APP === 'artlia') return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-full shadow-sm`} aria-label="Asistent" role="img">
      <circle cx="16" cy="16" r="16" fill="var(--pc-pair)" />
      <path d="M16 7.5 7 15.5h2.6v8.5h4.4v-5h4v5h4.4v-8.5H25z" fill="#fff" />
    </svg>
  );
  // The kids app's assistant: two small heads (the app's icon) on the accent's pair.
  if (import.meta.env.VITE_APP === 'kids') return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-full shadow-sm`} aria-label="Asistent" role="img">
      <circle cx="16" cy="16" r="16" fill="var(--pc-pair)" />
      <circle cx="11.5" cy="12.5" r="3.4" fill="#fff" />
      <circle cx="20.5" cy="14" r="2.8" fill="#fff" />
      <path d="M5.8 24.5c.6-4.2 3-6.6 5.7-6.6s5.1 2.4 5.7 6.6zM15.4 24.5c.5-3.4 2.6-5.4 5.1-5.4s4.6 2 5.1 5.4z" fill="#fff" />
    </svg>
  );
  // Lucian 2026-11-05: "Replace the smiley everywhere". v2's 24 px; v1's rows keep their own width.
  return <CoachMark thinking={thinking} className={getUiMode() === 'v2' ? 'h-6 w-6' : className} />;
}

/** Another person in a shared chat (Casa Artlia): their initial on a neutral disc. */
export function PersonAvatar({ name, className = 'h-7 w-7' }: { name: string; className?: string }) {
  if (getUiMode() === 'v2') return <PersonMark name={name} />;
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-full shadow-sm`} aria-label={name} role="img">
      <circle cx="16" cy="16" r="16" fill="#7c5cd6" />
      <text x="16" y="21" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="14" fontWeight="700" fill="#fff">{name[0]}</text>
    </svg>
  );
}
