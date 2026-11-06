/** Today v2's rules, pure so they are tested: the words for when, and the place of each tile. */
import { formatDay, type NowItem, type TellKind } from './api';
import { OTHER, REALMS, type Realm } from '../realms';

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const nameOf = (i: NowItem) => i.waits_for || i.face?.name || (i.glance_title?.includes(' · ') ? i.glance_title.split(' · ')[0] : '');

/** One meta line. Late is a count beside a flag; waiting says who and since when ("Bérenger · 6d"). */
export function whenOf(item: NowItem, today: string): { text: string; tone: 'late' | 'today' | 'plain' } | null {
  const due = item.due_date || item.scheduled?.slice(0, 10);
  if (item.status === 'waiting') {
    const expected = item.waits_for && item.due_date ? -daysBetween(today, item.due_date) : 0;
    const since = expected > 0 ? expected : Math.max(0, -daysBetween(today, (item.waiting_since || item.updated_at || today).slice(0, 10)));
    return { text: `${nameOf(item) || 'waiting'} · ${since ? `${since}d` : 'today'}`, tone: expected > 0 ? 'late' : 'plain' };
  }
  if (!due) return null;
  const d = daysBetween(today, due);
  if (d < 0) return { text: `${-d}d`, tone: 'late' };
  if (d === 0) return { text: 'today', tone: 'today' };
  if (d === 1) return { text: 'tomorrow', tone: 'plain' };
  return { text: formatDay(due), tone: 'plain' };
}

// ---- The change card (ChangeCards.tsx): whether a message changed an item, and one line of what changed.
const CLOSED_STATES = ['done', 'paid', 'closed', 'bought', 'returned', 'used', 'cancelled', 'passed'];
const NEAR = 5 * 60_000;
export type ItemState = Partial<NowItem> & { created?: string; changes?: Array<{ at: string; after: Record<string, unknown> }> };
export const isClosedState = (s?: string) => CLOSED_STATES.includes(s ?? '');

/** Did this message change the item? Its last change is within minutes of the message. */
export function changedBy(s: ItemState | undefined, ts: number): boolean {
  const at = Date.parse(s?.updated_at ?? '');
  return !Number.isNaN(at) && at > ts - NEAR && at < ts + 60_000;
}

/** One line of what changed, from the item itself; never the person's words back. */
export function whatChanged(s: ItemState, ts: number, today: string): string {
  if (s.status === 'cancelled') return 'Not needed';
  if (isClosedState(s.status)) return 'Done';
  const said = lineFromLog(s, ts, today);
  if (said) return said;
  const created = Date.parse(s.created ?? '');
  const verb = !Number.isNaN(created) && created > ts - NEAR ? 'Added' : 'Changed';
  return s.due_date ? `${verb} · ${s.due_date === today ? 'today' : formatDay(s.due_date)}` : verb;
}

/** The change log's entry nearest the message, in words. Only what the card can say for sure. */
function lineFromLog(s: ItemState, ts: number, today: string): string | null {
  const near = (s.changes ?? []).filter(c => Math.abs(Date.parse(c.at) - ts) < NEAR).at(-1);
  if (!near) return null;
  const a = near.after;
  const day = (d: unknown) => (d === today ? 'today' : formatDay(String(d)));
  if (a.parked) return 'Parked, kept';
  if ('parked' in a) return 'Back from parked';
  if (a.promise && (a.promise as { told?: unknown[] }).told?.length) return `Told ${(a.promise as { to: string }).to}`;
  if (a.review_on) return 'Review tomorrow';
  if (a.snoozed_until) return `Put off to ${day(a.snoozed_until)}`;
  if (a.waits_for || a.status === 'waiting') return s.waits_for ? `Waiting for ${s.waits_for}` : 'Waiting';
  if (a.due_date) return `Due ${day(a.due_date)}`;
  if ('due_date' in a) return 'No date now';
  if (a.priority) return `Priority ${String(a.priority)}`;
  if (a.title) return 'Title changed';
  if (a.given_to) return `Given to ${String(a.given_to)}`;
  return null;
}

// ---- A message that came from another session ("[From Claude] #81 Oferta…"): a card, no prefix.
export interface ClaudeNote { text: string; n?: number; line: string; /** The labelling job asks where it belongs: one tap per realm. */ asksRealm?: boolean }
export function parseClaudeNote(text: string): ClaudeNote | null {
  const m = /^\s*\[From Claude\]\s*/.exec(text);
  if (!m) return null;
  const body = text.slice(m[0].length).trim();
  const num = /^#?(\d+)\b\s*[·:.-]?\s*/.exec(body);
  const rest = num ? body.slice(num[0].length) : body;
  const first = rest.replace(/\*\*/g, '').split(/(?<=[.!?])\s|\n/)[0].trim();
  return { text: rest, n: num ? Number(num[1]) : undefined, line: first.length > 90 ? `${first.slice(0, 89)}…` : first, asksRealm: /^Which realm does this belong to\?/.test(rest) };
}

/** The strip above the composer: the first 60 characters of a message as plain text. */
export function previewOf(text: string): string {
  const note = parseClaudeNote(text);
  const plain = (note ? note.text : text).replace(/⟨[^⟩]*⟩/g, '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 60 ? `${plain.slice(0, 60)}…` : plain;
}

const SAME_CHANGE = 3 * 60_000;
/**
 * One change, one card: when two messages minutes apart name the same item, only one keeps its card. The person's own side wins
 * (a change made by hand); otherwise the first. Returns, per message id, the item ids it must not show.
 */
export function duplicateCards(msgs: Array<{ id: string; mine: boolean; ts: number; items: string[] }>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const drop = (id: string, item: string) => out.set(id, (out.get(id) ?? new Set<string>()).add(item));
  const last = new Map<string, { id: string; mine: boolean; ts: number }>();
  for (const m of msgs) {
    for (const item of m.items) {
      const was = last.get(item);
      if (was && m.ts - was.ts < SAME_CHANGE) {
        if (m.mine && !was.mine) { drop(was.id, item); last.set(item, { id: m.id, mine: m.mine, ts: m.ts }); }
        else drop(m.id, item);
      } else last.set(item, { id: m.id, mine: m.mine, ts: m.ts });
    }
  }
  return out;
}

/** Rough height, for placing tiles by index: stable, so a tile never jumps once it is drawn. */
const weightOf = (i: NowItem) => 84 + ((i.glance_title ?? i.title).length > 16 ? 19 : 0);

/** Which matter a thing belongs to: the server's name for it; until the coach has seen it, the project, the company, its topic. */
export function matterOf(i: NowItem): string {
  if (i.matter) return i.matter;
  if (i.domain === 'casa-artlia') return 'Casa Artlia';
  if (i.face?.logo && i.face.name) return i.face.name;
  return i.topics?.[0] || i.payee || i.face?.name || 'Other';
}

/** The pile by matter: the largest first; matters of one thing gather under Other. */
export function pileOf(items: NowItem[]): Array<{ matter: string; items: NowItem[] }> {
  const by = new Map<string, NowItem[]>();
  for (const it of items) { const m = matterOf(it); by.set(m, [...(by.get(m) ?? []), it]); }
  const other: NowItem[] = by.get('Other') ?? [];
  const groups: Array<{ matter: string; items: NowItem[] }> = [];
  for (const [matter, list] of by) {
    if (matter === 'Other') continue;
    if (list.length === 1) other.push(list[0]); else groups.push({ matter, items: list });
  }
  groups.sort((a, b) => b.items.length - a.items.length || a.matter.localeCompare(b.matter));
  return other.length ? [...groups, { matter: 'Other', items: other }] : groups;
}

// ---- oc v2's plan 02: the step on a tile, the word given, Everything.
const CLEAN_WHERE: Record<string, string> = { phone: 'phone', laptop: 'laptop', out: 'out', paper: 'paper', anywhere: 'anywhere' };
/** "3 min · phone". */
export function stepLine(i: Pick<NowItem, 'step'>): string {
  if (!i.step) return '';
  return [i.step.minutes ? `${i.step.minutes} min` : '', CLEAN_WHERE[i.step.where ?? ''] ?? ''].filter(Boolean).join(' · ');
}

const dayOf = (iso: string) => iso.slice(0, 10);
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** The green line (§14.3): "told Bérenger · 14:20"; when Relay could not reach them, "copied · tell Bérenger". */
export function toldLine(i: Pick<NowItem, 'promise'>, today: string): string | null {
  const last = i.promise?.told?.at(-1);
  if (!last || !i.promise) return null;
  if (last.how === 'copied') return `copied · tell ${i.promise.to}`;
  return `told ${i.promise.to} · ${dayOf(last.at) === today ? clock(last.at) : formatDay(last.at)}`;
}

/** A promise has slipped once its date has gone by; with no date said, someone is simply waiting. */
export function slipped(i: Pick<NowItem, 'promise' | 'waiting_on'>, today: string): boolean {
  if (i.waiting_on === 'me') return true;
  if (!i.promise?.to) return false;
  return !i.promise.by || i.promise.by < today;
}

/** The actions, most likely first (§14.3). "Update" replaces "late" once a late message went out. A name, not a pronoun: contacts hold none. */
export function coordinationFor(i: Pick<NowItem, 'promise' | 'waiting_on'>, today: string): Array<{ kind: TellKind; label: string }> {
  if (!slipped(i, today)) return [];
  const name = i.promise?.to ?? 'them';
  const told = (i.promise?.told?.length ?? 0) > 0;
  return [
    told ? { kind: 'update', label: `Update ${name} on the delay` } : { kind: 'late', label: `Tell ${name} I'm late` },
    { kind: 'more-time', label: 'Ask for more time' },
    { kind: 'confirm', label: `Confirm ${name} still needs it` },
  ];
}

/** "said 'by Thursday' · 6 days ago". */
export function waitingLine(i: Pick<NowItem, 'promise'>, today: string): string {
  const p = i.promise;
  const since = p?.on ? Math.max(0, daysBetween(p.on, today)) : 0;
  const ago = since === 0 ? 'today' : since === 1 ? 'yesterday' : `${since} days ago`;
  return p?.said ? `said "${p.said}" · ${ago}` : `asked · ${ago}`;
}

export const reviewing = (i: Pick<NowItem, 'review_on'>, today: string) => !!i.review_on && i.review_on > today;

export interface RealmGroup { realm: Realm; matters: Array<{ name: string; items: NowItem[]; next?: string }>; loose: NowItem[]; count: number; late: number }

/** Everything: realms in the registry's order, a matter of two or more inside, the rest loose; Other last, and only when it holds something. */
export function everythingOf(items: NowItem[], today: string): RealmGroup[] {
  const seen = new Set<string>();
  const unique = items.filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  const out: RealmGroup[] = [];
  for (const realm of [...REALMS, OTHER]) {
    const here = unique.filter(i => (REALMS.some(r => r.id === i.realm_id) ? i.realm_id : OTHER.id) === realm.id);
    if (!here.length) continue;
    const by = new Map<string, NowItem[]>();
    for (const i of here) { const m = i.matter ?? ''; by.set(m, [...(by.get(m) ?? []), i]); }
    const matters: RealmGroup['matters'] = [], loose: NowItem[] = [];
    for (const [name, list] of by) {
      if (name && list.length > 1) matters.push({ name, items: list, next: list.find(i => i.step)?.step?.first });
      else loose.push(...list);
    }
    matters.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
    out.push({ realm, matters, loose, count: here.length, late: here.filter(i => i.due_date && i.due_date < today && !i.automatic).length });
  }
  return out;
}

export function columnsFor(items: NowItem[], n: number): NowItem[][] {
  const cols: NowItem[][] = Array.from({ length: n }, () => []);
  const h = new Array<number>(n).fill(0);
  for (const it of items) {
    const c = h.indexOf(Math.min(...h));
    cols[c].push(it);
    h[c] += weightOf(it);
  }
  return cols;
}


/** A title split around its key word group: [before, key, after], or null when the key is not in it. */
export function keyParts(text: string, key?: string): [string, string, string] | null {
  if (!key) return null;
  const at = text.toLocaleLowerCase().indexOf(key.toLocaleLowerCase());
  return at < 0 ? null : [text.slice(0, at), text.slice(at, at + key.length), text.slice(at + key.length)];
}
