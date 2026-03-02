import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Sun, Moon, Monitor, Laptop, Check, Leaf } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { ThemeName, AccentColor } from '../contexts/ThemeContextDef';
import { useT } from '../hooks/useLocale';

import type { TranslationKey } from '../lib/i18n';

const themeOptions: { value: ThemeName; icon: typeof Sun; labelKey: TranslationKey }[] = [
  { value: 'system', icon: Laptop, labelKey: 'theme.system' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  { value: 'light', icon: Sun, labelKey: 'theme.light' },
  { value: 'oled', icon: Monitor, labelKey: 'theme.oled' },
  { value: 'sand', icon: Leaf, labelKey: 'theme.sand' },
];

const accentOptions: { value: AccentColor; color: string }[] = [
  { value: 'cyan', color: '#22d3ee' },
  { value: 'violet', color: '#8b5cf6' },
  { value: 'emerald', color: '#10b981' },
  { value: 'amber', color: '#f59e0b' },
  { value: 'rose', color: '#f43f5e' },
  { value: 'blue', color: '#3b82f6' },
  { value: 'teal', color: '#00a884' },
];

export function ThemeSwitcher() {
  const { theme, accent, setTheme, setAccent } = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current && btnRef.current.contains(target) ||
        panelRef.current && panelRef.current.contains(target)
      ) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded-2xl border border-[var(--pc-border)] bg-[var(--pc-bg-elevated)]/30 px-2.5 py-1.5 text-xs text-[var(--pc-text-muted)] hover:text-[var(--pc-text-secondary)] hover:bg-[var(--pc-bg-elevated)]/50 transition-colors"
        title={t('theme.title')}
      >
        <Palette size={14} />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('theme.title')}
          className="fixed w-52 rounded-2xl border border-[var(--pc-border-strong)] bg-[var(--pc-bg-surface)] shadow-2xl p-3 animate-fade-in"
          style={{ top: pos.top, right: pos.right, zIndex: 2147483647 }}
        >
          <div className="text-[10px] uppercase tracking-wider text-[var(--pc-text-faint)] font-semibold mb-2">
            {t('theme.mode')}
          </div>
          <div className="flex gap-1.5 mb-3">
            {themeOptions.map(opt => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  aria-pressed={active}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border text-xs transition-all ${
                    active
                      ? 'border-[var(--pc-accent)]/40 bg-[var(--pc-accent)]/10 text-[var(--pc-accent-light)]'
                      : 'border-[var(--pc-border)] text-[var(--pc-text-muted)] hover:bg-[var(--pc-bg-elevated)]/50'
                  }`}
                >
                  <Icon size={16} />
                  <span>{t(opt.labelKey)}</span>
                </button>
              );
            })}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--pc-text-faint)] font-semibold mb-2">
            {t('theme.accent')}
          </div>
          <div className="flex gap-2 justify-center">
            {accentOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAccent(opt.value)}
                className="relative h-7 w-7 rounded-full border-2 transition-all flex items-center justify-center"
                aria-pressed={accent === opt.value}
                aria-label={`${opt.value} accent`}
                style={{
                  backgroundColor: opt.color,
                  borderColor: accent === opt.value ? opt.color : 'transparent',
                  boxShadow: accent === opt.value ? `0 0 8px ${opt.color}40` : 'none',
                }}
                title={opt.value}
              >
                {accent === opt.value && <Check size={14} className="text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
