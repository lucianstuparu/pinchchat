import { describe, expect, it } from 'vitest';
import { columnsFor, coordinationFor, everythingOf, reviewing, slipped, stepLine, toldLine, waitingLine, whenOf, changedBy, duplicateCards, parseClaudeNote, pileOf, previewOf, whatChanged } from '../todayRules';
import type { NowItem } from '../api';

const item = (o: Partial<NowItem>): NowItem => ({ id: 'x', title: 't', kind: 'task', store: 'tasks', scope: 'shared', status: 'todo', priority: 'P3', weight: 1, section: 'later', ...o });

describe('the review of 2026-11-05', () => {
  const T = '2026-11-05';
  const base = { id: 'a', title: 'x', kind: 'task', store: 'tasks', scope: 'private', status: 'todo' } as unknown as NowItem;
  it('late is a count', () => {
    expect(whenOf({ ...base, due_date: '2026-10-25' }, T)).toEqual({ text: '11d', tone: 'late' });
  });
  it('waiting says who and since when', () => {
    expect(whenOf({ ...base, status: 'waiting', face: { name: 'Bérenger' }, waiting_since: '2026-10-30' }, T)?.text).toBe('Bérenger · 6d');
    expect(whenOf({ ...base, status: 'waiting', updated_at: '2026-11-05T08:00:00Z' }, T)?.text).toBe('waiting · today');
  });
  it('someone late with what we wait for carries the flag', () => {
    expect(whenOf({ ...base, status: 'waiting', waits_for: 'Crédit Mutuel', due_date: '2026-10-30' }, T)).toEqual({ text: 'Crédit Mutuel · 6d', tone: 'late' });
  });
  it('a card is for a change near the message, in words of its own', () => {
    const ts = Date.parse('2026-11-05T10:00:00Z');
    expect(changedBy({ updated_at: '2026-11-05T09:59:50Z' }, ts)).toBe(true);
    expect(changedBy({ updated_at: '2026-11-01T09:00:00Z' }, ts)).toBe(false);
    expect(changedBy(undefined, ts)).toBe(false);
    expect(whatChanged({ status: 'done' }, ts, T)).toBe('Done');
    expect(whatChanged({ status: 'cancelled' }, ts, T)).toBe('Not needed');
    expect(whatChanged({ status: 'todo', created: '2026-11-05T09:59:50Z', due_date: T }, ts, T)).toBe('Added · today');
    expect(whatChanged({ status: 'todo', created: '2026-01-01T09:00:00Z' }, ts, T)).toBe('Changed');
  });
  it('a note from another session loses its prefix and gets a number and a line', () => {
    const n = parseClaudeNote('[From Claude] #81 **Oferta** de credit: banca cere asigurarea. Mai mult text aici.');
    expect(n?.n).toBe(81);
    expect(n?.line).toBe('Oferta de credit: banca cere asigurarea.');
    expect(parseClaudeNote('Oferta de credit')).toBeNull();
    expect(previewOf('[From Claude] #81 **Oferta** ⟨art-1⟩')).toBe('81 Oferta'.slice(3));
  });
  it('the strip shows 60 characters of plain text', () => {
    expect(previewOf('**a** b')).toBe('a b');
    expect(previewOf('x'.repeat(70))).toBe(`${'x'.repeat(60)}…`);
  });
  it('one change, one card, on my side when it is mine', () => {
    const t = 1_000_000;
    const coachFirst = duplicateCards([{ id: 'c', mine: false, ts: t, items: ['130'] }, { id: 'm', mine: true, ts: t + 1000, items: ['130'] }]);
    expect([...(coachFirst.get('c') ?? [])]).toEqual(['130']);
    expect(coachFirst.has('m')).toBe(false);
    const mineFirst = duplicateCards([{ id: 'm', mine: true, ts: t, items: ['130'] }, { id: 'c', mine: false, ts: t + 1000, items: ['130'] }]);
    expect([...(mineFirst.get('c') ?? [])]).toEqual(['130']);
    expect(duplicateCards([{ id: 'a', mine: false, ts: t, items: ['1'] }, { id: 'b', mine: false, ts: t + 3_600_000, items: ['1'] }]).size).toBe(0);
  });
  it('the pile groups by matter, largest first, single things under Other', () => {
    const a = { ...base, id: 'a', domain: 'casa-artlia' }, b = { ...base, id: 'b', domain: 'casa-artlia' };
    const c = { ...base, id: 'c', topics: ['house'] }, d = { ...base, id: 'd', face: { logo: 'x.png', name: 'SFR' } }, e = { ...base, id: 'e', face: { logo: 'x.png', name: 'SFR' } };
    expect(pileOf([c, a, d, b, e]).map(g => [g.matter, g.items.length])).toEqual([['Casa Artlia', 2], ['SFR', 2], ['Other', 1]]);
  });
});

describe('whenOf', () => {
  it('says late as a count, never as a red date', () => {
    expect(whenOf(item({ due_date: '2026-11-03' }), '2026-11-05')).toEqual({ text: '2d', tone: 'late' });
    expect(whenOf(item({ due_date: '2026-11-04' }), '2026-11-05')?.text).toBe('1d');
  });
  it('today, tomorrow, waiting, no date', () => {
    expect(whenOf(item({ due_date: '2026-11-05' }), '2026-11-05')?.tone).toBe('today');
    expect(whenOf(item({ due_date: '2026-11-06' }), '2026-11-05')?.text).toBe('tomorrow');
    expect(whenOf(item({ status: 'waiting' }), '2026-11-05')?.text).toBe('waiting · today');
    expect(whenOf(item({}), '2026-11-05')).toBeNull();
  });
});

describe('columnsFor', () => {
  it('keeps every tile once, in order within a column', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map(id => item({ id, glance_title: id }));
    const cols = columnsFor(items, 2);
    expect(cols.flat().map(i => i.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(cols[0].map(i => i.id)).toEqual(['a', 'c', 'e']);
  });
  it('a long title sends the next tile to the shorter column', () => {
    const cols = columnsFor([item({ id: 'long', glance_title: 'a title longer than sixteen' }), item({ id: 'b', glance_title: 'b' }), item({ id: 'c', glance_title: 'c' })], 2);
    expect(cols[1].map(i => i.id)).toEqual(['b', 'c']);
  });
});

describe('plan 02', () => {
  const T = '2026-11-06';
  it('a tile says what it takes', () => {
    expect(stepLine({ step: { first: 'x', minutes: 3, where: 'phone' } })).toBe('3 min · phone');
    expect(stepLine({ step: { first: 'x' } })).toBe('');
    expect(stepLine({})).toBe('');
  });
  it('coordination appears only once a promise slipped; update replaces late once told; a name, no pronoun', () => {
    expect(coordinationFor({ promise: { to: 'B', by: '2026-11-09' } }, T)).toEqual([]);
    expect(coordinationFor({}, T)).toEqual([]);
    const late = coordinationFor({ promise: { to: 'Bérenger', by: '2026-11-05' } }, T);
    expect(late.map(c => c.kind)).toEqual(['late', 'more-time', 'confirm']);
    expect(late[0].label).toBe("Tell Bérenger I'm late");
    expect(coordinationFor({ promise: { to: 'B', by: '2026-11-05', told: [{ at: '2026-11-06T10:00:00Z', kind: 'late' }] } }, T)[0].kind).toBe('update');
    expect(slipped({ promise: { to: 'B' } }, T)).toBe(true);
    expect(slipped({ waiting_on: 'me' }, T)).toBe(true);
  });
  it('the green line: told, or copied when Relay could not reach them', () => {
    expect(toldLine({ promise: { to: 'B', told: [{ at: '2026-11-01T10:00:00Z', kind: 'late' }] } }, T)).toMatch(/^told B · /);
    expect(toldLine({ promise: { to: 'B', told: [{ at: '2026-11-06T10:00:00Z', kind: 'late', how: 'copied' }] } }, T)).toBe('copied · tell B');
    expect(toldLine({ promise: { to: 'B' } }, T)).toBeNull();
  });
  it('what was said and since when', () => {
    expect(waitingLine({ promise: { to: 'B', said: 'by Thursday', on: '2026-10-31' } }, T)).toBe('said "by Thursday" · 6 days ago');
    expect(waitingLine({ promise: { to: 'B', on: T } }, T)).toBe('asked · today');
  });
  it('review tomorrow greys the tile until that day', () => {
    expect(reviewing({ review_on: '2026-11-07' }, T)).toBe(true);
    expect(reviewing({ review_on: T }, T)).toBe(false);
  });
  it('Everything: the registry drives the order, matters inside, loose after, Other last; each thing once', () => {
    const groups = everythingOf([
      item({ id: 'a', realm_id: 'finance', matter: 'CM', step: { first: 'Check it' } }), item({ id: 'b', realm_id: 'finance', matter: 'CM' }),
      item({ id: 'c', realm_id: 'finance', matter: 'Solo', due_date: '2026-11-01' }), item({ id: 'd', realm_id: 'desk', matter: 'SFR' }),
      item({ id: 'e' }), item({ id: 'f', realm_id: 'nonsense' }), item({ id: 'a', realm_id: 'finance', matter: 'CM' }),
    ], T);
    expect(groups.map(g => g.realm.id)).toEqual(['desk', 'finance', 'other']);
    const fin = groups[1];
    expect(fin.count).toBe(3);
    expect(fin.late).toBe(1);
    expect(fin.matters).toEqual([expect.objectContaining({ name: 'CM', next: 'Check it' })]);
    expect(fin.loose.map(i => i.id)).toEqual(['c']);
    expect(groups[2].count).toBe(2);
  });
  it('the card says what moved, from the log, near the message only', () => {
    const ts = Date.parse('2026-11-06T10:00:00Z');
    const at = '2026-11-06T10:00:05Z';
    const line = (after: Record<string, unknown>, extra = {}) => whatChanged({ status: 'todo', created: '2026-01-01T00:00:00Z', changes: [{ at, after }], ...extra }, ts, T);
    expect(line({ due_date: T })).toBe('Due today');
    expect(line({ due_date: null })).toBe('No date now');
    expect(line({ status: 'waiting' }, { waits_for: 'Bérenger' })).toBe('Waiting for Bérenger');
    expect(line({ parked: { on: T } })).toBe('Parked, kept');
    expect(line({ promise: { to: 'B', told: [{}] } })).toBe('Told B');
    expect(whatChanged({ status: 'todo', created: '2026-01-01T00:00:00Z', changes: [{ at: '2026-10-01T00:00:00Z', after: { due_date: T } }] }, ts, T)).toBe('Changed');
  });
  it('the realm question is a card with buttons', () => {
    expect(parseClaudeNote('[From Claude] #12 Which realm does this belong to? ⟨tsk-2026-11-06-abcdef⟩')?.asksRealm).toBe(true);
    expect(parseClaudeNote('[From Claude] #12 Oferta a sosit')?.asksRealm).toBe(false);
  });
  it('a matter name from the server wins', () => {
    expect(pileOf([item({ id: 'a', matter: 'SFR' }), item({ id: 'b', matter: 'SFR' })])[0].matter).toBe('SFR');
  });
});
