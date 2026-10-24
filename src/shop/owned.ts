/**
 * Things we own in the app: what was bought that stays, mostly found in the order mails by the
 * Shopper's morning scan. The same rules as the server's owned.mjs for the operations, so a change
 * shows at once and replays offline.
 */
export interface OwnedEntry {
  id: string; kind?: 'owned'; title: string; group?: string; shop?: string; bought_on?: string; price?: number; currency?: string; qty?: string;
  order?: string; mail?: string; return_by?: string; warranty_until?: string; notes?: string;
  status: 'owned' | 'returned' | 'gone'; source?: 'mail' | 'chat' | 'app'; added_by?: string; created?: string; updated?: string;
  closed_by?: string; closed_on?: string;
}
export type OwnedOp =
  | { op: 'owned-close'; id: string; how: 'returned' | 'gone' }
  | { op: 'owned-reopen'; id: string };

export function applyOwned(list: OwnedEntry[], op: OwnedOp, person: string, now = new Date().toISOString()): OwnedEntry[] {
  return list.map(e => {
    if (e.id !== op.id) return e;
    if (op.op === 'owned-close') return e.status === 'owned' ? { ...e, status: op.how, closed_by: person, closed_on: now.slice(0, 10), updated: now } : e;
    return { ...e, status: 'owned', closed_by: undefined, closed_on: undefined, updated: now };
  });
}

/** The mail it came from, in Gmail (the message id is the one the mail reader gives). */
export const mailLink = (id: string) => `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(id)}`;

export const money = (v?: number, cur?: string) => (v === undefined ? '' : new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'EUR' }).format(v));
