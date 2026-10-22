/**
 * The pantry in the app (Shopping Phase D): what is at home and when it expires. The same rules
 * as the server's pantry.mjs for the operations, so a change shows at once and replays offline.
 */
export type Where = 'fridge' | 'freezer' | 'pantry' | 'bathroom' | 'other';
export interface PantryEntry {
  id: string; kind?: 'pantry'; title: string; product?: string; qty?: string; where?: Where; due_date?: string; guessed?: boolean;
  notes?: string; status: 'open' | 'used' | 'wasted'; added_by?: string; created?: string; updated?: string; closed_by?: string; closed_on?: string;
}
export type PantryOp =
  | { op: 'pantry-add'; id: string; title: string; product?: string; qty?: string; where?: Where; expires?: string; in_days?: number }
  | { op: 'pantry-edit'; id: string; title?: string; qty?: string; where?: Where; expires?: string }
  | { op: 'pantry-close'; id: string; how: 'used' | 'wasted' }
  | { op: 'pantry-reopen'; id: string };

export const WHERE: Array<{ key: Where; label: string; icon: string }> = [
  { key: 'fridge', label: 'Fridge', icon: '🧊' }, { key: 'freezer', label: 'Freezer', icon: '❄️' },
  { key: 'pantry', label: 'Cupboard', icon: '🗄️' }, { key: 'bathroom', label: 'Bathroom', icon: '🛁' }, { key: 'other', label: 'Other', icon: '📦' },
];
export const whereIcon = (w?: Where) => WHERE.find(x => x.key === (w ?? 'fridge'))?.icon ?? '📦';

export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const daysUntil = (d: string, today: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);

export function newPantryId(now = new Date()): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('');
  return `pan-${now.toISOString().slice(0, 10)}-${hex}`;
}

/** Group for display: expired, this week, later, no date. */
export type PantryGroup = 'expired' | 'week' | 'later' | 'nodate';
export function groupOf(e: PantryEntry, today: string): PantryGroup {
  if (!e.due_date) return 'nodate';
  const d = daysUntil(e.due_date, today);
  return d < 0 ? 'expired' : d <= 7 ? 'week' : 'later';
}

/** "Expired 2 days ago", "Expires today", "Tomorrow", "Fri 24 Oct", with "~" when it was guessed. */
export function expiryLabel(e: PantryEntry, today: string): string {
  if (!e.due_date) return 'No date';
  const d = daysUntil(e.due_date, today);
  const g = e.guessed ? '~' : '';
  if (d < -1) return `Expired ${-d} days ago`;
  if (d === -1) return 'Expired yesterday';
  if (d === 0) return 'Expires today';
  if (d === 1) return `${g}Tomorrow`;
  return g + new Date(`${e.due_date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function applyPantry(list: PantryEntry[], op: PantryOp, person: string, now = new Date().toISOString()): PantryEntry[] {
  const today = now.slice(0, 10);
  if (op.op === 'pantry-add') {
    if (list.some(e => e.id === op.id)) return list;
    const due = op.expires || (op.in_days ? addDays(today, op.in_days) : undefined);
    return [...list, { id: op.id, kind: 'pantry', title: op.title.trim(), product: op.product, qty: op.qty, where: op.where ?? 'fridge', due_date: due,
      status: 'open', added_by: person, created: now, updated: now }];
  }
  return list.map(e => {
    if (e.id !== op.id) return e;
    switch (op.op) {
      case 'pantry-edit':
        return { ...e, updated: now,
          ...(op.title ? { title: op.title } : {}), ...(op.qty !== undefined ? { qty: op.qty || undefined } : {}),
          ...(op.where ? { where: op.where } : {}), ...(op.expires !== undefined ? { due_date: op.expires || undefined, guessed: false } : {}) };
      case 'pantry-close':
        return e.status === 'open' ? { ...e, status: op.how, closed_by: person, closed_on: today, updated: now } : e;
      case 'pantry-reopen':
        return { ...e, status: 'open', closed_by: undefined, closed_on: undefined, updated: now };
    }
    return e;
  });
}
