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
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-full shadow-sm`} aria-label="Assistant" role="img">
      <circle cx="16" cy="16" r="16" fill="var(--pc-pair, #2f6b4f)" />
      {/* a small constellation: three nodes, two links — the manager and its agents */}
      <path d="M10 20 L16 11 L22 20" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="2.6" fill="#fff" />
      <circle cx="16" cy="11" r="2.6" fill="#fff" />
      <circle cx="22" cy="20" r="2.6" fill="#fff" />
    </svg>
  );
}
