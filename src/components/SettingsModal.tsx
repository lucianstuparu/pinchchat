import { useEffect } from 'react';
import { X, Settings, Sun, Moon, Monitor, Laptop, Check, Volume2, VolumeOff, Leaf } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useSendShortcut } from '../hooks/useSendShortcut';
import { useT, useLocale } from '../hooks/useLocale';
import { setLocale, supportedLocales, localeLabels } from '../lib/i18n';
import type { ThemeName, AccentColor } from '../contexts/ThemeContextDef';
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

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

interface Props {
  open: boolean;
  onClose: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-pc-text-faint font-semibold mt-5 mb-2 first:mt-0">
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pc-accent/50 ${
        checked ? 'bg-pc-accent' : 'bg-pc-border-strong'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function SettingsModal({ open, onClose, soundEnabled, onToggleSound }: Props) {
  const t = useT();
  const { theme, accent, setTheme, setAccent } = useTheme();
  const { sendOnEnter, toggle: toggleSendShortcut } = useSendShortcut();
  const currentLocale = useLocale();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm mx-4 rounded-3xl border border-pc-border bg-[var(--pc-bg-base)]/95 backdrop-blur-xl shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pc-border">
          <div className="flex items-center gap-2.5">
            <Settings size={18} className="text-pc-accent-light/70" />
            <h2 className="text-sm font-semibold text-pc-text">{t('settings.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Appearance */}
          <SectionTitle>{t('settings.appearance')}</SectionTitle>

          {/* Theme mode */}
          <div className="mb-3">
            <div className="text-xs text-pc-text-secondary mb-2">{t('theme.mode')}</div>
            <div className="flex gap-1.5">
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
                        ? 'border-pc-accent/40 bg-pc-accent/10 text-pc-accent-light'
                        : 'border-pc-border text-pc-text-muted hover:bg-[var(--pc-hover)]'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{t(opt.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent color */}
          <div className="mb-1">
            <div className="text-xs text-pc-text-secondary mb-2">{t('theme.accent')}</div>
            <div className="flex gap-2">
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
          </div>

          {/* Language */}
          <SectionTitle>{t('settings.language')}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {supportedLocales.map(loc => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
                aria-pressed={currentLocale === loc}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                  currentLocale === loc
                    ? 'border-pc-accent/40 bg-pc-accent/10 text-pc-accent-light font-medium'
                    : 'border-pc-border text-pc-text-muted hover:bg-[var(--pc-hover)]'
                }`}
              >
                {currentLocale === loc && <Check size={12} />}
                {localeLabels[loc] || loc.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Chat */}
          <SectionTitle>{t('settings.chat')}</SectionTitle>
          <div className="flex items-center justify-between py-1.5">
            <div className="text-xs text-pc-text-secondary">{t('settings.sendShortcut')}</div>
            <button
              onClick={toggleSendShortcut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pc-border text-xs text-pc-text-secondary hover:bg-[var(--pc-hover)] transition-colors"
            >
              {sendOnEnter
                ? t('settings.sendEnter')
                : (isMac ? '⌘+' : 'Ctrl+') + t('settings.sendEnter')
              }
            </button>
          </div>

          {/* Notifications */}
          {onToggleSound && (
            <>
              <SectionTitle>{t('settings.notifications')}</SectionTitle>
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 text-xs text-pc-text-secondary">
                  {soundEnabled ? <Volume2 size={14} /> : <VolumeOff size={14} />}
                  {t('settings.notificationSound')}
                </div>
                <ToggleSwitch
                  checked={!!soundEnabled}
                  onChange={onToggleSound}
                  label={t('settings.notificationSound')}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
