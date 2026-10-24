/**
 * Look of the desk: neutral backgrounds (white / near-black, like iOS) with one accent colour.
 * Appearance follows the phone (auto) or is fixed light / dark; the accent is a choice of four.
 * Both are chosen in Settings and kept per device.
 *
 * 2026-10-22: replaced the warm (parchment) and green (sage-on-sage) palettes, whose tinted
 * backgrounds were tiring to read; the colour now lives only in the accent.
 */
import { useEffect, useState, type CSSProperties } from 'react';

export type Appearance = 'auto' | 'light' | 'dark';
export type Accent = 'terracotta' | 'teal' | 'coral' | 'green' | 'blue' | 'graphite' | 'keep';
export interface Look { appearance: Appearance; accent: Accent }

/** Accent per mode (dark needs lighter tones), and the agent's colour that goes with it. */
export const ACCENTS: Record<Accent, { name: string; light: string; dark: string; pairLight: string; pairDark: string; ink?: [string, string]; on?: string }> = {
  terracotta: { name: 'Terracotta', light: '#c2593a', dark: '#e07a58', pairLight: '#2f6b55', pairDark: '#5aa889' },
  // The life-manager artifact's colour (Lucian, 2026-10-24: offered beside terracotta, not the default).
  teal:       { name: 'Teal',       light: '#0e9488', dark: '#2bb3a6', pairLight: '#c2593a', pairDark: '#e07a58', ink: ['#0b7268', '#5fd3c6'] },
  // Casa Artlia's colour (Lucian, 2026-10-24: "more optimistic and fresh" than teal). Text in it is a deeper coral (ink).
  coral:      { name: 'Coral',      light: '#f2545b', dark: '#ff8a8f', pairLight: '#2f6b55', pairDark: '#5aa889', ink: ['#b3262e', '#ff8a8f'] },
  green:      { name: 'Green',      light: '#2e7d5b', dark: '#4fb487', pairLight: '#c2593a', pairDark: '#e07a58' },
  blue:       { name: 'Blue',       light: '#1f6fd6', dark: '#4c9bff', pairLight: '#7a4fc2', pairDark: '#a983ff' },
  graphite:   { name: 'Graphite',   light: '#3d3d42', dark: '#c7c7cc', pairLight: '#c2593a', pairDark: '#e07a58' },
  // Google Keep's yellow (the Shopping app, so the move from the Keep list feels familiar). Yellow is a
  // fill colour: text in it is a dark amber (ink), text on it is near-black (on).
  keep:       { name: 'Keep yellow', light: '#fbbc04', dark: '#fdd663', pairLight: '#5f6368', pairDark: '#9aa0a6', ink: ['#a05a00', '#fdd663'], on: '#202124' },
};

const hexRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');

interface Neutral { base: string; surface: string; elevated: string; code: string; border: string; borderStrong: string;
  text: string; text2: string; muted: string; faint: string; hoverRgb: string }
const NEUTRAL: Record<'light' | 'dark', Neutral> = {
  // base = page and chat, surface = the assistant's bubbles and fields, elevated = sheets and menus
  light: { base: '#ffffff', surface: '#f1f1f4', elevated: '#ffffff', code: '#f1f1f4', border: 'rgba(60,60,67,0.13)', borderStrong: 'rgba(60,60,67,0.24)',
    text: '#1c1c1e', text2: '#3a3a3c', muted: '#6e6e73', faint: '#aeaeb2', hoverRgb: '0,0,0' },
  dark: { base: '#000000', surface: '#2c2c2e', elevated: '#1c1c1e', code: '#3a3a3c', border: 'rgba(235,235,245,0.14)', borderStrong: 'rgba(235,235,245,0.26)',
    text: '#f2f2f7', text2: '#d1d1d6', muted: '#98989f', faint: '#636366', hoverRgb: '255,255,255' },
};

function vars(mode: 'light' | 'dark', accent: Accent): Record<string, string> {
  const n = NEUTRAL[mode], a = ACCENTS[accent];
  const acc = mode === 'dark' ? a.dark : a.light, pair = mode === 'dark' ? a.pairDark : a.pairLight;
  const accRgb = hexRgb(acc);
  const base: Record<string, string> = {
    '--pc-bg-base': n.base, '--pc-bg-surface': n.surface, '--pc-bg-elevated': n.elevated, '--pc-bg-input': n.surface,
    '--pc-bg-sidebar': n.surface, '--pc-bg-code': n.code, '--pc-border': n.border, '--pc-border-strong': n.borderStrong,
    '--pc-text-primary': n.text, '--pc-text-secondary': n.text2, '--pc-text-muted': n.muted, '--pc-text-faint': n.faint,
    '--pc-scrollbar-thumb': n.faint, '--pc-scrollbar-track': n.base, '--pc-scrollbar-thumb-hover': n.muted,
    '--pc-hover': `rgba(${n.hoverRgb},0.05)`, '--pc-hover-strong': `rgba(${n.hoverRgb},0.09)`, '--pc-separator': n.border, '--pc-bg-gradient': 'none',
    '--pc-accent': acc, '--pc-accent-light': acc, '--pc-accent-dim': `rgba(${accRgb},0.3)`,
    '--pc-accent-glow': `rgba(${accRgb},0.1)`, '--pc-accent-rgb': accRgb,
    '--pc-pair': pair, '--pc-pair-rgb': hexRgb(pair),
    '--pc-accent-ink': a.ink ? (mode === 'dark' ? a.ink[1] : a.ink[0]) : acc,   // text in the accent colour
    '--pc-on-accent': a.on ?? '#ffffff',                                          // text on an accent fill
    '--pc-mine': `rgba(${accRgb},${mode === 'dark' ? 0.32 : 0.14})`,   // the person's own bubbles
    '--pc-scrim': mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
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

const KEY = 'openclaw-pwa:look';
const OLD_KEY = 'openclaw-pwa:theme';
export function getLook(): Look {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Look> | null;
    if (v && (['auto', 'light', 'dark'] as const).includes(v.appearance as Appearance) && v.accent && v.accent in ACCENTS) return v as Look;
    if (localStorage.getItem(OLD_KEY) === 'green') return { appearance: 'auto', accent: 'green' };
  } catch { /* defaults */ }
  return { appearance: 'auto', accent: 'terracotta' };
}
export function setLook(l: Look) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* not kept */ } }

/** The mode actually shown: 'auto' follows the phone's dark mode, live. */
export function useMode(appearance: Appearance): 'light' | 'dark' {
  const [sysDark, setSysDark] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const q = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!q) return;
    const on = () => setSysDark(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return appearance === 'auto' ? (sysDark ? 'dark' : 'light') : appearance;
}

export const lookVars = (mode: 'light' | 'dark', accent: Accent): CSSProperties =>
  ({ ...vars(mode, accent), colorScheme: mode } as CSSProperties);

/** Browser chrome outside the React tree: status bar colour and the page behind overscroll. */
export function useThemeChrome(mode: 'light' | 'dark') {
  useEffect(() => {
    const n = NEUTRAL[mode];
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevMeta = meta?.content, prevBg = document.body.style.background;
    if (meta) meta.content = n.base;
    document.body.style.background = n.base;
    return () => { if (meta && prevMeta !== undefined) meta.content = prevMeta; document.body.style.background = prevBg; };
  }, [mode]);
}
