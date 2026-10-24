/**
 * Shared controls of oc and Shopping (my.design): the icon button (40 px), segmented tabs and the
 * app header. Sizes and radii come from the my.design tokens: buttons 40 / 48 / 56, radii 8 / 12 / 20.
 */
import { L } from './lang';
import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

/** A 40 px round icon button, quiet (no fill) unless `filled`. */
export function IconButton({ label, onClick, children, filled = false, disabled, className = '' }: {
  label: string; onClick: () => void; children: ReactNode; filled?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className={`press relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${
        filled ? 'bg-pc-surface text-pc-text-secondary' : 'text-pc-text active:bg-[var(--pc-hover-strong)]'} ${className}`}>
      {children}
    </button>
  );
}

/** Segmented tabs: one track (radius 12), the chosen segment raised (radius 8); a muted count after the label. */
export function Segmented<T extends string>({ value, options, onChange, label, size = 'm', choice = false }: {
  value: T; options: Array<{ value: T; label: string; count?: number; icon?: ReactNode }>; onChange: (v: T) => void;
  label?: string; size?: 's' | 'm';
  /** A setting (radio group) rather than tabs that switch what is shown. */
  choice?: boolean;
}) {
  return (
    <div className="grid min-w-0 flex-1 gap-1 rounded-[12px] bg-pc-surface p-[3px]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role={choice ? 'radiogroup' : 'tablist'} aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role={choice ? 'radio' : 'tab'} {...(choice ? { 'aria-checked': value === o.value } : { 'aria-selected': value === o.value })} onClick={() => onChange(o.value)}
          className={`press flex items-center justify-center gap-1.5 truncate rounded-[8px] font-medium transition-colors ${size === 's' ? 'h-9 text-[13px]' : 'h-10 text-[15px]'} ${
            value === o.value ? 'bg-pc-elevated text-pc-text shadow-sm' : 'text-pc-text-muted'}`}>
          {o.icon}{o.label}{o.count ? <span className="text-pc-text-muted">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** The header row while searching: the field (radius 12) and Cancel. */
export function SearchHeader({ value, onChange, onCancel, placeholder = L('Search') }: {
  value: string; onChange: (v: string) => void; onCancel: () => void; placeholder?: string;
}) {
  return (
    <div className="flex h-[52px] items-center gap-1 px-2">
      <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-pc-surface pl-3 pr-1">
        <Search size={17} className="shrink-0 text-pc-text-muted" />
        <input autoFocus type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} enterKeyHint="search"
          className="min-w-0 flex-1 border-0 bg-transparent text-[16px] shadow-none outline-none focus:outline-none focus-visible:outline-none placeholder:text-pc-text-muted [&::-webkit-search-cancel-button]:hidden" />
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="press flex h-10 w-10 shrink-0 items-center justify-center">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pc-text-faint text-pc-surface"><X size={12} strokeWidth={3} /></span>
          </button>
        )}
      </div>
      <button type="button" onClick={onCancel} className="press h-10 px-2 text-[16px] text-[var(--pc-accent-ink)]">{L('Cancel')}</button>
    </div>
  );
}

/** The header row of both apps: title and a status line, icon buttons, the person's initial (Settings). */
export function AppHeader({ title, subtitle, actions, initial, onSettings, logo = '/logo-192.png' }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; initial: string; onSettings: () => void;
  /** The app's own icon, top left, so each app is recognisable at a glance (Lucian, 2026-10-24). */
  logo?: string | null;
}) {
  return (
    <div className="flex h-[52px] items-center gap-1 px-2">
      {logo && <img src={logo} alt="" className="ml-1.5 h-8 w-8 shrink-0 rounded-[8px]" />}
      <div className="min-w-0 flex-1 px-2">
        <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="flex items-center gap-1 truncate text-[12px] leading-tight text-pc-text-muted">{subtitle}</p>}
      </div>
      {actions}
      <button type="button" onClick={onSettings} aria-label="Settings" className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pc-accent text-[15px] font-semibold text-[var(--pc-on-accent)]">{initial}</span>
      </button>
    </div>
  );
}
