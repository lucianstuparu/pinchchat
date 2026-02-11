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
      className="flex items-center gap-1.5 rounded-2xl border border-white/8 bg-zinc-800/30 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
      title="Change language"
    >
      <Globe size={14} />
      <span className="font-medium">{localeLabels[current] || current.toUpperCase()}</span>
    </button>
  );
}
