/**
 * Bills that pay themselves (Lucian 2026-11-05: "bills most are direct debit, I will mark them"). Marked per payee, so next
 * month's bill arrives automatic; v2 then shows those bills in Passing by. Refunds, disputes and letters are not listed.
 * Undo is the switch itself, plus the six seconds on the bar.
 */
import { useEffect, useRef, useState } from 'react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { UndoBar, type UndoInfo } from './UndoBar';
import { fetchPayees, formatAmount, setPayee, type Payee } from './api';

export function PayeesSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [payees, setPayees] = useState<Payee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const undoKey = useRef(0);
  useEffect(() => { fetchPayees().then(setPayees).catch(() => setError('Could not load the list. Try again in a moment.')); }, []);

  const change = async (p: Payee, auto: boolean, offer = true) => {
    setPayees(l => l?.map(x => (x.key === p.key ? { ...x, auto } : x)) ?? null);
    try {
      await setPayee(p.name, auto);
      if (offer) setUndo({ key: ++undoKey.current, label: `${p.name}: ${auto ? 'automatic' : 'to pay by hand'}`, undo: () => void change(p, !auto, false) });
      onChanged();
    } catch {
      setPayees(l => l?.map(x => (x.key === p.key ? { ...x, auto: !auto } : x)) ?? null);
      setError(`Could not change ${p.name}.`);
    }
  };

  return (
    <Sheet label="Bills that pay themselves" onClose={onClose} className="flex max-h-[88dvh] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Bills that pay themselves</h2>
        <CloseButton onClick={onClose} />
      </div>
      <p className="pb-2 text-[13px] text-pc-text-muted">Turn on what is taken by direct debit. New bills from them follow.</p>
      {error && <p className="py-2 text-[15px] text-pc-text-secondary" role="status">{error}</p>}
      {!payees && !error && <p className="py-6 text-center text-[15px] text-pc-text-muted">Loading…</p>}
      {payees?.length === 0 && <p className="py-6 text-center text-[15px] text-pc-text-muted">No open bills right now.</p>}
      <ul className="min-h-0 flex-1 divide-y divide-[var(--pc-separator)] overflow-y-auto">
        {payees?.map(p => (
          <li key={p.key}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 py-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px]">{p.name}</span>
                <span className="block text-[12px] text-pc-text-muted">{p.count === 1 ? '1 open' : `${p.count} open`}{p.amount != null ? ` · ${formatAmount(p.amount, p.currency)}` : ''}</span>
              </span>
              <input type="checkbox" role="switch" checked={p.auto} onChange={e => void change(p, e.target.checked)} aria-label={`${p.name} pays itself`} className="h-6 w-6 shrink-0 accent-[var(--pc-accent)]" />
            </label>
          </li>
        ))}
      </ul>
      <UndoBar info={undo} onClose={() => setUndo(null)} />
    </Sheet>
  );
}
