import { useEffect, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { actOnItem, fetchItemStates, isClosed, type ItemState, type MessageItem } from './messageItems';

const fmt = (d?: string) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

/** One row per register item named in a message: its state, and Done / Snooze. */
export function ItemActions({ items }: { items: MessageItem[] }) {
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [today, setToday] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = items.map(i => i.id).join(',');

  useEffect(() => {
    let alive = true;
    fetchItemStates(ids.split(','))
      .then(r => { if (alive) { setStates(r.items); setToday(r.today); } })
      .catch(() => { /* offline or not signed in: the buttons still try, and say if it fails */ });
    return () => { alive = false; };
  }, [ids]);

  const act = async (id: string, action: 'done' | 'snooze') => {
    setBusy(id); setError(null);
    try {
      const r = await actOnItem(id, action);
      setStates(s => ({ ...s, [id]: { ...s[id], status: r.status, remind_on: r.remind_on } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change it');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-1.5 -mx-1 space-y-1" aria-label="Items">
      {items.map(item => {
        const s = states[item.id];
        const closed = isClosed(s);
        const snoozed = !closed && !!s?.remind_on && !!today && s.remind_on > today;
        return (
          <div key={item.id} className="rounded-xl border border-pc-border bg-[var(--pc-hover)] px-2.5 py-1.5">
            <div className="text-[13px] leading-snug">{item.label || s?.title || item.id}</div>
            <div className="mt-1 flex items-center gap-2 text-[12px]">
              {closed ? (
                <span className="inline-flex items-center gap-1 text-pc-text-muted"><Check size={13} /> {s!.status}</span>
              ) : (
                <>
                  <button type="button" disabled={busy === item.id} onClick={() => void act(item.id, 'done')}
                    className="rounded-full bg-pc-accent px-3 py-1 font-medium text-white disabled:opacity-60">Done</button>
                  <button type="button" disabled={busy === item.id} onClick={() => void act(item.id, 'snooze')}
                    className="rounded-full border border-pc-border px-3 py-1 disabled:opacity-60">Snooze 3 days</button>
                  {snoozed && <span className="inline-flex items-center gap-1 text-pc-text-muted"><Clock size={12} /> {fmt(s!.remind_on)}</span>}
                </>
              )}
            </div>
          </div>
        );
      })}
      {error && <p className="px-1 text-[12px] text-red-500">{error}</p>}
    </div>
  );
}
