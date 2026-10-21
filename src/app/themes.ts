/**
 * Themes for the desk: the warm palette (parchment and terracotta) and a green one (sage, deep
 * green, with coral as its pair colour for highlights). Chosen in the ⋮ menu, kept per device.
 */
import { useEffect, type CSSProperties } from 'react';

export type ThemeName = 'warm' | 'green';

interface Palette { base: string; surface: string; elevated: string; code: string; border: string; borderStrong: string;
  text: string; text2: string; muted: string; faint: string; accent: string; accentLight: string; accentRgb: string; pair: string; pairRgb: string }

const PALETTES: Record<ThemeName, Palette> = {
  warm: { base: '#f4ebdf', surface: '#fdf7ef', elevated: '#fffaf4', code: '#efe3d3', border: 'rgba(92,60,30,0.12)', borderStrong: 'rgba(92,60,30,0.2)',
    text: '#2d2219', text2: '#5b4636', muted: '#8b735f', faint: '#b8a38e', accent: '#c0603a', accentLight: '#d9805c', accentRgb: '192,96,58', pair: '#2f6b4f', pairRgb: '47,107,79' },
  green: { base: '#edf2e8', surface: '#f6f9f2', elevated: '#fbfdf8', code: '#e2eadb', border: 'rgba(40,70,50,0.12)', borderStrong: 'rgba(40,70,50,0.22)',
    text: '#1d2a22', text2: '#3f5447', muted: '#6b7f72', faint: '#9fb0a5', accent: '#2f6b4f', accentLight: '#4b8a6a', accentRgb: '47,107,79', pair: '#d9775a', pairRgb: '217,119,90' },
};

function vars(p: Palette): Record<string, string> {
  const base: Record<string, string> = {
    '--pc-bg-base': p.base, '--pc-bg-surface': p.surface, '--pc-bg-elevated': p.elevated, '--pc-bg-input': p.surface,
    '--pc-bg-sidebar': p.surface, '--pc-bg-code': p.code, '--pc-border': p.border, '--pc-border-strong': p.borderStrong,
    '--pc-text-primary': p.text, '--pc-text-secondary': p.text2, '--pc-text-muted': p.muted, '--pc-text-faint': p.faint,
    '--pc-scrollbar-thumb': p.faint, '--pc-scrollbar-track': p.base, '--pc-scrollbar-thumb-hover': p.muted,
    '--pc-hover': `rgba(${p.pairRgb === p.accentRgb ? p.accentRgb : '60,60,40'},0.05)`.replace('60,60,40', p.accentRgb),
    '--pc-hover-strong': `rgba(${p.accentRgb},0.11)`, '--pc-separator': p.border, '--pc-bg-gradient': 'none',
    '--pc-accent': p.accent, '--pc-accent-light': p.accentLight, '--pc-accent-dim': `rgba(${p.accentRgb},0.3)`,
    '--pc-accent-glow': `rgba(${p.accentRgb},0.1)`, '--pc-accent-rgb': p.accentRgb,
    '--pc-pair': p.pair, '--pc-pair-rgb': p.pairRgb,
  };
  // Tailwind's --color-pc-* tokens are declared on :root as var(--pc-...): set both so utilities follow.
  const tw: Record<string, string> = {
    '--color-pc-base': base['--pc-bg-base'], '--color-pc-surface': base['--pc-bg-surface'], '--color-pc-elevated': base['--pc-bg-elevated'],
    '--color-pc-input': base['--pc-bg-input'], '--color-pc-code': base['--pc-bg-code'], '--color-pc-border': base['--pc-border'],
    '--color-pc-border-strong': base['--pc-border-strong'], '--color-pc-text': base['--pc-text-primary'],
    '--color-pc-text-secondary': base['--pc-text-secondary'], '--color-pc-text-muted': base['--pc-text-muted'],
    '--color-pc-text-faint': base['--pc-text-faint'], '--color-pc-accent': base['--pc-accent'], '--color-pc-accent-light': base['--pc-accent-light'],
  };
  return { ...base, ...tw };
}

const KEY = 'openclaw-pwa:theme';
export function getTheme(): ThemeName {
  try { const t = localStorage.getItem(KEY); return t === 'green' ? 'green' : 'warm'; } catch { return 'warm'; }
}
export function setTheme(t: ThemeName) { try { localStorage.setItem(KEY, t); } catch { /* not persisted */ } }

export const themeVars = (t: ThemeName): CSSProperties => ({ ...vars(PALETTES[t]), colorScheme: 'light' } as CSSProperties);

/** Browser chrome outside the React tree: status bar colour and the page behind overscroll. */
export function useThemeChrome(t: ThemeName) {
  useEffect(() => {
    const p = PALETTES[t];
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevMeta = meta?.content, prevBg = document.body.style.background;
    if (meta) meta.content = p.surface;
    document.body.style.background = p.base;
    return () => { if (meta && prevMeta !== undefined) meta.content = prevMeta; document.body.style.background = prevBg; };
  }, [t]);
}
