/**
 * The shop search (Lucian, 2026-10-24: "shops as tags, I don't want to search through tens of shop
 * filters, better a smart search"). One sheet for both places a shop is chosen: the list's filter
 * and an item's "where to get it". Type a few letters; a shop that is not known yet is one tap away.
 */
import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { SearchHeader } from '../ui/Controls';
import { ShopLogo } from './ShopLogo';
import { NOT_SHOPS, fold, newStore, rankShops, type Store } from './logic';

export function ShopPicker({ stores, counts = {}, recent = {}, current, allShops, onPick, onCreate, onClose, z = 40 }: {
  stores: Store[];
  /** Things to get per shop tag, shown on the row and used for the order. */
  counts?: Record<string, number>;
  /** Last day something was bought per shop tag (the order with nothing typed). */
  recent?: Record<string, string>;
  current: string | null;
  /** Given: the list's filter, with an "All shops" row and this count. */
  allShops?: number;
  onPick: (tag: string | null) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
  z?: 40 | 50;
}) {
  const [typed, setTyped] = useState('');
  const shown = rankShops(stores, typed, counts, recent);
  const fresh = newStore(typed);
  // Offered unless a shop already starts with what is typed ("ik" is IKEA, not a new shop).
  const canAdd = fresh.tag !== '' && !NOT_SHOPS.has(fresh.tag) && !stores.some(s => s.tag === fresh.tag || fold(s.name).startsWith(fold(typed.trim())));
  const row = 'press flex min-h-[56px] w-full items-center gap-3 px-4 text-left active:bg-[var(--pc-hover-strong)]';

  return (
    <Sheet label="Shops" onClose={onClose} z={z} className="flex max-h-[85dvh] flex-col md:max-w-lg">
      <SearchHeader value={typed} onChange={setTyped} onCancel={onClose} placeholder="Find or add a shop" />
      <div className="min-h-0 flex-1 divide-y divide-[var(--pc-separator)] overflow-y-auto pb-2">
        {allShops !== undefined && !typed.trim() && (
          <button type="button" onClick={() => onPick(null)} className={row}>
            <span className="flex-1 text-[16px]">All shops</span>
            <span className="text-[15px] text-pc-text-muted">{allShops}</span>
            {current === null && <Check size={18} className="text-[var(--pc-accent-ink)]" aria-label="chosen" />}
          </button>
        )}
        {shown.map(s => (
          <button key={s.tag} type="button" onClick={() => onPick(s.tag)} className={row}>
            <ShopLogo tag={s.tag} name="" size={28} />
            <span className="min-w-0 flex-1 truncate text-[16px]">{s.name}</span>
            {(counts[s.tag] ?? 0) > 0 && <span className="text-[15px] text-pc-text-muted">{counts[s.tag]}</span>}
            {current === s.tag && <Check size={18} className="text-[var(--pc-accent-ink)]" aria-label="chosen" />}
          </button>
        ))}
        {canAdd && (
          <button type="button" onClick={() => onCreate(fresh.name)} className={row}>
            <Plus size={18} className="shrink-0 text-[var(--pc-accent-ink)]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[16px] text-[var(--pc-accent-ink)]">Add “{fresh.name}” as a shop</span>
          </button>
        )}
        {shown.length === 0 && !canAdd && typed.trim() && (
          <p className="px-8 py-10 text-center text-[15px] text-pc-text-muted">“{typed.trim()}” is a label, not a shop</p>
        )}
      </div>
    </Sheet>
  );
}
