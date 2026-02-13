import { createContext } from 'react';

export type ThemeName = 'dark' | 'light' | 'oled' | 'system';
export type AccentColor = 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

export interface ThemeContextValue {
  theme: ThemeName;
  accent: AccentColor;
  setTheme: (t: ThemeName) => void;
  setAccent: (a: AccentColor) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  accent: 'cyan',
  setTheme: () => {},
  setAccent: () => {},
});
