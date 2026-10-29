import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { formatDay } from './api';

/**
 * Sent notifications (Lucian 2026-10-29: "do we have a log of all sent notifications? maybe I clear them
 * by mistake"): the last 30 days of what oc, Shopping and Relay pushed to this person, newest first,
 * kept by oc-push on CT 105. A reminder opens its item; the other apps' notifications open that app.
 */
interface Sent { ts: string; app: 'oc' | 'shop' | 'relay'; title: string; body?: string; url?: string; item?: string; sent?: number }

const APP: Record<Sent['app'], { name: string; origin: string | null }> = {
  oc: { name: 'oc', origin: null },
  shop: { name: 'Shopping', origin: 'https://shop.stuparu.eu' },
  relay: { name: 'Relay', origin: 'https://msg.stuparu.eu' },
};

const dayOf = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDay(iso);
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function NotificationsSheet({ mode, onOpenItem, onClose }: { mode: 'light' | 'dark'; onOpenItem: (id: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<Sent[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/push/history', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`Could not load them (${r.status})`))))
      .then((d: { items: Sent[] }) => setItems(d.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  const days: Array<[string, Sent[]]> = [];
  for (const n of items ?? []) {
    const day = dayOf(n.ts);
    const last = days[days.length - 1];
    if (last && last[0] === day) last[1].push(n); else days.push([day, [n]]);
  }

  const open = (n: Sent) => {
    const app = APP[n.app] ?? APP.oc;
    if (app.origin) { window.location.href = `${app.origin}${n.url ?? '/'}`; return; }
    if (n.item) onOpenItem(n.item);
  };

  return (
    <Sheet label="Sent notifications" onClose={onClose} className={`flex max-h-[92dvh] flex-col px-4 pt-2 md:max-w-md ${mode === 'dark' ? 'bg-[#000]' : 'bg-[#f2f2f7]'}`}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="text-[22px] font-bold">Sent notifications</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="mb-4 text-[13px] leading-snug text-pc-text-muted">Everything sent to your phone in the last 30 days, also the ones you cleared.</p>
        {error && <p className="mb-3 text-[14px] text-red-500">{error}</p>}
        {items === null && !error && <p className="text-[14px] text-pc-text-muted">Loading…</p>}
        {items?.length === 0 && <p className="text-[15px] text-pc-text-muted">Nothing sent yet.</p>}
        {days.map(([day, list]) => (
          <section key={day} className="mb-6">
            <h3 className="mb-1.5 px-4 text-[13px] text-pc-text-muted">{day}</h3>
            <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-elevated">
              {list.map((n, i) => {
                const app = APP[n.app] ?? APP.oc;
                const tappable = !!app.origin || !!n.item;
                return (
                  <button key={`${n.ts}-${i}`} type="button" onClick={() => open(n)} disabled={!tappable}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left disabled:cursor-default">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-pc-text-muted">{timeOf(n.ts)}{n.app !== 'oc' ? ` · ${app.name}` : ''}{n.sent === 0 ? ' · not delivered' : ''}</span>
                      <span className="mt-0.5 block text-[16px] font-semibold leading-snug">{n.title}</span>
                      {n.body && <span className="mt-0.5 block whitespace-pre-line text-[14px] leading-snug text-pc-text-secondary line-clamp-3">{n.body}</span>}
                    </span>
                    {tappable && <ChevronRight size={17} className="mt-6 shrink-0 text-pc-text-faint" />}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
