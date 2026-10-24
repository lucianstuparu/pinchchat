/** The two faces of the chat: ME (the person) and the agent's mark. Inline SVG, theme colours. */
export function MeAvatar({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-full shadow-sm`} aria-label="Me" role="img">
      <circle cx="16" cy="16" r="16" fill="var(--pc-accent)" />
      <text x="16" y="20.5" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="12" fontWeight="700" fill="#fff" letterSpacing="0.5">ME</text>
    </svg>
  );
}

export function AgentAvatar({ className = 'h-7 w-7' }: { className?: string }) {
  // The assistant's face, as in the app icon (a smiling bubble on a sunrise gradient, Lucian 2026-10-24).
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-full shadow-sm`} aria-label="Assistant" role="img">
      <defs><linearGradient id="agent-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ec7040" /><stop offset="1" stopColor="#cc4a32" /></linearGradient></defs>
      <circle cx="16" cy="16" r="16" fill="url(#agent-sun)" />
      <circle cx="11.5" cy="13" r="2" fill="#fff" />
      <circle cx="20.5" cy="13" r="2" fill="#fff" />
      <path d="M10.5 18.5 Q16 24 21.5 18.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Another person in a shared chat (Casa Artlia): their initial on a neutral disc. */
export function PersonAvatar({ name, className = 'h-7 w-7' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-full shadow-sm`} aria-label={name} role="img">
      <circle cx="16" cy="16" r="16" fill="#7c5cd6" />
      <text x="16" y="21" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="14" fontWeight="700" fill="#fff">{name[0]}</text>
    </svg>
  );
}
