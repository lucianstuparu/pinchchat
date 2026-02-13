import { Globe } from 'lucide-react';
import { setLocale, supportedLocales, localeLabels } from '../lib/i18n';
import { useLocale } from '../hooks/useLocale';

export function LanguageSelector() {
  const current = useLocale();

  const cycle = () => {
    const idx = supportedLocales.indexOf(current);
    const next = supportedLocales[(idx + 1) % supportedLocales.length];
    setLocale(next);
  };

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-1.5 rounded-2xl border border-pc-border bg-pc-elevated/30 px-2.5 py-1.5 text-xs text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
      title="Change language"
      aria-label={`Language: ${localeLabels[current] || current}. Click to change.`}
    >
      <Globe size={14} />
      <span className="font-medium">{localeLabels[current] || current.toUpperCase()}</span>
    </button>
  );
}
