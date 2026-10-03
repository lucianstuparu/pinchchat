/**
 * The messenger's own palette: warm light (parchment, warm browns, terracotta accent).
 *
 * Applied as CSS custom properties on the messenger's root element, so it overrides the shared
 * PinchChat theme for the messenger only; the full UI ("Advanced") keeps the user's theme.
 */
import { useEffect, type CSSProperties } from 'react';

export const WARM_SURFACE = '#fdf7ef';
export const WARM_BASE = '#f4ebdf';

const PALETTE: Record<string, string> = {
  '--pc-bg-base': WARM_BASE,
  '--pc-bg-surface': WARM_SURFACE,
  '--pc-bg-elevated': '#fffaf4',
  '--pc-bg-input': WARM_SURFACE,
  '--pc-bg-sidebar': 'rgba(253,247,239,0.97)',
  '--pc-bg-code': '#efe3d3',
  '--pc-border': 'rgba(92,60,30,0.12)',
  '--pc-border-strong': 'rgba(92,60,30,0.2)',
  '--pc-text-primary': '#2d2219',
  '--pc-text-secondary': '#5b4636',
  '--pc-text-muted': '#8b735f',
  '--pc-text-faint': '#b8a38e',
  '--pc-scrollbar-thumb': '#c9b49d',
  '--pc-scrollbar-track': WARM_BASE,
  '--pc-scrollbar-thumb-hover': '#8b735f',
  '--pc-hover': 'rgba(92,60,30,0.05)',
  '--pc-hover-strong': 'rgba(92,60,30,0.09)',
  '--pc-separator': 'rgba(92,60,30,0.08)',
  '--pc-bg-gradient': 'none',
  '--pc-accent': '#c0603a',
  '--pc-accent-light': '#d9805c',
  '--pc-accent-dim': 'rgba(192,96,58,0.3)',
  '--pc-accent-glow': 'rgba(192,96,58,0.1)',
  '--pc-accent-rgb': '192,96,58',
};

// Tailwind's --color-pc-* tokens are declared on :root as var(--pc-...), so they resolve there;
// overriding only --pc-* on a descendant would not reach the utilities. Set both.
const TAILWIND_TOKENS: Record<string, string> = {
  '--color-pc-base': '--pc-bg-base',
  '--color-pc-surface': '--pc-bg-surface',
  '--color-pc-elevated': '--pc-bg-elevated',
  '--color-pc-input': '--pc-bg-input',
  '--color-pc-code': '--pc-bg-code',
  '--color-pc-border': '--pc-border',
  '--color-pc-border-strong': '--pc-border-strong',
  '--color-pc-text': '--pc-text-primary',
  '--color-pc-text-secondary': '--pc-text-secondary',
  '--color-pc-text-muted': '--pc-text-muted',
  '--color-pc-text-faint': '--pc-text-faint',
  '--color-pc-accent': '--pc-accent',
  '--color-pc-accent-light': '--pc-accent-light',
};

export const WARM_VARS = {
  ...PALETTE,
  ...Object.fromEntries(Object.entries(TAILWIND_TOKENS).map(([token, source]) => [token, PALETTE[source]])),
  colorScheme: 'light',
} as CSSProperties;

/** Browser chrome outside the React tree: status bar colour and the page behind overscroll. */
export function useWarmChrome() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevMeta = meta?.content;
    const prevBg = document.body.style.background;
    if (meta) meta.content = WARM_SURFACE;
    document.body.style.background = WARM_BASE;
    return () => {
      if (meta && prevMeta !== undefined) meta.content = prevMeta;
      document.body.style.background = prevBg;
    };
  }, []);
}
