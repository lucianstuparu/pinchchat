/**
 * Everything, by realm (my.design v2/oc-v2-brief.md §6.6, §9; review 01 point 3): a map of the realms with their counts, then each realm
 * with its matters inside and the loose things after. The registry (src/realms.ts) drives it. Remembered surfaces and pinch come later.
 */
import { useRef } from 'react';
import { Flag } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { ObjectFace } from '../kit2/ObjectFace';
import type { NowItem } from './api';
import { everythingOf, stepLine, whenOf } from './todayRules';

export function ThingRow({ item, today, onOpen }: { item: NowItem; today: string; onOpen: (i: NowItem) => void }) {
  const when = whenOf(item, today);
  const line = [item.automatic ? 'automatic' : '', stepLine(item)].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={() => onOpen(item)} className="press flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">{item.face && <ObjectFace face={item.face} size={28} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight">{item.glance_title ?? item.title.replace(/\*\*/g, '')}</span>
        {line && <span className="block text-[12px] leading-tight text-pc-text-muted">{line}</span>}
      </span>
      {when && <span className={`inline-flex shrink-0 items-center gap-1 text-[12px] ${when.tone === 'late' ? 'font-semibold' : when.tone === 'today' ? 'font-semibold text-[var(--pc-today)]' : 'text-pc-text-muted'}`}>{when.tone === 'late' && <Flag size={12} strokeWidth={2.5} aria-hidden />}{when.text}</span>}
    </button>
  );
}

export function EverythingV2({ items, parked, today, onClose, onOpen }: { items: NowItem[]; parked: NowItem[]; today: string; onClose: () => void; onOpen: (i: NowItem) => void }) {
  const groups = everythingOf(items, today);
  const box = useRef<HTMLDivElement>(null);
  const open = (i: NowItem) => { onClose(); onOpen(i); };
  const jump = (id: string) => box.current?.querySelector(`[data-realm="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  return (
    <Sheet label="Everything" onClose={onClose} className="flex max-h-[92dvh] flex-col md:max-w-lg">
      <div ref={box} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <h2 className="px-1 pb-2 pt-1 text-[22px] font-bold">Everything</h2>
        <nav aria-label="Realms" className="grid grid-cols-2 gap-2 pb-4">
          {groups.map(g => (
            <button key={g.realm.id} type="button" onClick={() => jump(g.realm.id)} className="press flex min-h-12 items-center justify-between gap-2 rounded-[12px] bg-pc-elevated px-3 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <span className="min-w-0 text-[15px] font-semibold leading-tight">{g.realm.name}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-pc-text-muted">
                {g.late > 0 && <span className="inline-flex items-center gap-0.5 font-semibold text-pc-text"><Flag size={12} strokeWidth={2.5} aria-label="late" />{g.late}</span>}
                {g.count}
              </span>
            </button>
          ))}
        </nav>
        <div className="space-y-5">
          {groups.map(g => (
            <section key={g.realm.id} data-realm={g.realm.id} aria-label={g.realm.name} className="scroll-mt-2">
              <h3 className="px-1 pb-2 text-[17px] font-bold">{g.realm.name} · {g.count}</h3>
              <div className="space-y-2">
                {g.matters.map(m => (
                  <div key={m.name} className="rounded-[12px] bg-pc-elevated">
                    <div className="px-3 pt-2">
                      <p className="text-[13px] font-bold uppercase tracking-wide text-pc-text-muted">{m.name} · {m.items.length}</p>
                      {m.next && <p className="text-[13px] leading-snug text-[var(--pc-accent-ink)]">next · {m.next}</p>}
                    </div>
                    <div className="divide-y divide-[var(--pc-separator)]">{m.items.map(i => <ThingRow key={i.id} item={i} today={today} onOpen={open} />)}</div>
                  </div>
                ))}
                {g.loose.length > 0 && <div className="divide-y divide-[var(--pc-separator)] rounded-[12px] bg-pc-elevated">{g.loose.map(i => <ThingRow key={i.id} item={i} today={today} onOpen={open} />)}</div>}
              </div>
            </section>
          ))}
          {parked.length > 0 && (
            <section aria-label="Parked">
              <h3 className="px-1 pb-2 text-[17px] font-bold">Parked · {parked.length}</h3>
              <div className="divide-y divide-[var(--pc-separator)] rounded-[12px] bg-pc-elevated">{parked.map(i => <ThingRow key={i.id} item={i} today={today} onOpen={open} />)}</div>
            </section>
          )}
          {groups.length === 0 && parked.length === 0 && <p className="px-1 py-6 text-[15px] text-pc-text-muted">Nothing open.</p>}
        </div>
      </div>
    </Sheet>
  );
}
