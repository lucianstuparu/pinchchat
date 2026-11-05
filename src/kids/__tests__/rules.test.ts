import { describe, it, expect } from 'vitest';
import { activitiesByChild, childrenOf, dayTitle, ideaTags, ideas, objectFor, planLine, plans, slotText, topOf, week, weekEnd, weekday } from '../rules';
import type { Child, KidItem } from '../api';

const T = '2026-11-03';   // a Tuesday
const kids: Child[] = [{ id: 'carla', name: 'Carla', class: 'CP' }, { id: 'lia', name: 'Lia', class: 'PS' }];
let seq = 0;
const k = (over: Partial<KidItem>): KidItem => ({ id: `kid-${++seq}`, n: seq, title: `item ${seq}`, kind: 'task', status: 'todo', ...over });

describe('Săptămâna', () => {
  it('runs from today to the Sunday of next week', () => {
    expect(weekday(T)).toBe(2);
    expect(weekEnd(T)).toBe('2026-11-15');
    expect(weekEnd('2026-11-09')).toBe('2026-11-22');   // a Monday: its own week and the next
    expect(weekEnd('2026-11-08')).toBe('2026-11-15');   // a Sunday: today and next week
  });

  it('puts activity sessions on their weekday within their season, events and deadlines on their day', () => {
    const swim = k({ kind: 'activity', title: 'Înot', child: 'lia', schedule: [{ day: 3, start: '14:00', end: '15:00' }], season_to: '2026-11-10' });
    const judo = k({ kind: 'activity', title: 'Judo', child: 'carla', schedule: [{ day: 5, start: '17:00' }], season_from: '2026-11-10' });
    const party = k({ kind: 'event', title: 'Ziua lui Tom', child: 'lia', due_date: '2026-11-08', time: '15:00' });
    const form = k({ title: 'Autorisation', child: 'carla', due_date: '2026-11-07' });
    const late = k({ title: 'Cantine', due_date: '2026-11-01' });
    const later = k({ title: 'Far', due_date: '2026-12-01' });
    const open = k({ title: 'Undated' });
    const done = k({ title: 'Done', due_date: '2026-11-05', status: 'done' });
    const w = week([swim, judo, party, form, late, later, open, done], T);
    const lines = (d: string) => w.days.find(x => x.date === d)?.lines.map(l => l.item.title) ?? [];
    expect(lines('2026-11-04')).toEqual(['Înot']);
    expect(lines('2026-11-11')).toEqual([]);                 // after the season
    expect(lines('2026-11-06')).toEqual([]);                 // judo starts the 10th
    expect(lines('2026-11-13')).toEqual(['Judo']);
    expect(lines('2026-11-07')).toEqual(['Autorisation']);
    expect(lines('2026-11-08')).toEqual(['Ziua lui Tom']);
    expect(w.overdue.map(i => i.title)).toEqual(['Cantine']);
    expect(w.undated.map(i => i.title)).toEqual(['Undated']);
    expect(w.days.flatMap(d => d.lines).some(l => l.item.title === 'Far' || l.item.title === 'Done')).toBe(false);
  });

  it('shows a several-day event once, on today when it began before, with its last day', () => {
    const hol = k({ kind: 'event', title: 'Vacances', type: 'dayoff', child: 'both', due_date: '2026-10-25', end_date: '2026-11-04' });
    const w = week([hol], T);
    expect(w.days).toHaveLength(1);
    expect(w.days[0].date).toBe(T);
    expect(w.days[0].lines[0].until).toBe('2026-11-04');
  });

  it('orders a day: whole-day lines first, then by time', () => {
    const a = k({ kind: 'event', title: 'late', due_date: T, time: '18:00' });
    const b = k({ kind: 'event', title: 'early', due_date: T, time: '08:30' });
    const c = k({ title: 'deadline', due_date: T });
    expect(week([a, b, c], T).days[0].lines.map(l => l.item.title)).toEqual(['deadline', 'early', 'late']);
  });

  it('the pinned card: overdue first, else the first thing from today', () => {
    const swim = k({ kind: 'activity', title: 'Înot', schedule: [{ day: 3, start: '14:00' }] });
    expect(topOf([swim], T).top?.item.title).toBe('Înot');
    expect(topOf([swim], T).day).toBe('2026-11-04');
    const late = k({ title: 'Cantine', due_date: '2026-11-01' });
    expect(topOf([swim, late], T).top?.item.title).toBe('Cantine');
    expect(topOf([], T).top).toBeNull();
  });

  it('day titles', () => {
    expect(dayTitle(T, T)).toBe('Azi · marți 3 nov');
    expect(dayTitle('2026-11-04', T)).toBe('Mâine · miercuri 4 nov');
    expect(dayTitle('2026-11-07', T)).toBe('sâmbătă 7 nov');
    expect(slotText({ day: 3, start: '14:00', end: '15:00' })).toBe('miercuri 14:00–15:00');
  });
});

describe('Activități, Idei, Planuri', () => {
  it('groups activities by child, both last, sorted by their first session', () => {
    const a = k({ kind: 'activity', title: 'Dans', child: 'carla', schedule: [{ day: 4, start: '17:00' }] });
    const b = k({ kind: 'activity', title: 'Pian', child: 'carla', schedule: [{ day: 1, start: '18:00' }] });
    const c = k({ kind: 'activity', title: 'Înot', child: 'both', schedule: [{ day: 6, start: '10:00' }] });
    const g = activitiesByChild([a, b, c], kids);
    expect(g.map(x => x.label)).toEqual(['Carla', 'Amândouă']);
    expect(g[0].items.map(i => i.title)).toEqual(['Pian', 'Dans']);
  });

  it('idea tags by use; filtered ideas, loved first', () => {
    const a = k({ kind: 'idea', title: 'Felinare', tags: ['ploaie', 'bricolaj'], created: '2026-11-01' });
    const b = k({ kind: 'idea', title: 'Pădure', tags: ['afară'], loved: true, created: '2026-10-01' });
    const c = k({ kind: 'idea', title: 'Plastilină', tags: ['ploaie'], created: '2026-11-02' });
    expect(ideaTags([a, b, c])).toEqual(['ploaie', 'afară', 'bricolaj']);
    expect(ideas([a, b, c], null).map(i => i.title)).toEqual(['Pădure', 'Plastilină', 'Felinare']);
    expect(ideas([a, b, c], 'ploaie').map(i => i.title)).toEqual(['Plastilină', 'Felinare']);
  });

  it('plans with their steps and how many are done', () => {
    const p = k({ kind: 'plan', title: 'Petrecere', due_date: '2027-03-20' });
    const s1 = k({ title: 'Sala', plan: p.id, status: 'done' });
    const s2 = k({ title: 'Invitații', plan: p.id, due_date: '2027-02-20' });
    const [v] = plans([p, s1, s2]);
    expect(v.steps.map(s => s.title)).toEqual(['Invitații', 'Sala']);
    expect(v.done).toBe(1);
    expect(week([p, s1, s2], T).undated).toEqual([]);   // steps live in their plan
  });

  it('children of an item', () => {
    expect(childrenOf({ child: 'both' }, kids).map(c => c.name)).toEqual(['Carla', 'Lia']);
    expect(childrenOf({ child: 'lia' }, kids).map(c => c.name)).toEqual(['Lia']);
    expect(childrenOf({}, kids)).toEqual([]);
  });
});

describe('the drawings', () => {
  const of = (title: string, over: Partial<KidItem> = {}) => objectFor(k({ title, ...over }));
  it('come from the words, with or without diacritics, in Romanian and French', () => {
    expect(of('Înot')).toBe('goggles');
    expect(of('**Natation**')).toBe('goggles');
    expect(of('judo')).toBe('gi');
    expect(of('Pian')).toBe('note');
    expect(of('Curs de dans')).toBe('slipper');
    expect(of('**Dans**')).toBe('slipper');
    expect(of('Ziua lui Tom')).toBe('cake');
    expect(of('Invitație la ziua lui Tom')).toBe('envelope');
    expect(of('Mască de hârtie')).toBe('scissors');
    expect(of('Plante în borcan')).toBe('plant');
  });
  it('take paper before sport, and do not match inside other words', () => {
    expect(of('Semnează fișa pentru înot')).toBe('form');
    expect(of('Pune sâmbetele de gimnastică în calendar')).toBe('calendar');
    expect(of('Sortie dans le parc')).toBe('backpack');    // French "dans" is not dancing
    expect(of('Corp și minte')).toBe('list');              // "cor" is a whole word
    expect(of('Cartier nou')).toBe('list');                // nor is "carte" inside it
  });
  it('fall back on the tags, then on what kind of thing it is', () => {
    expect(of('Ceva', { kind: 'idea', tags: ['bricolaj'] })).toBe('scissors');
    expect(of('Ceva', { kind: 'event', type: 'dayoff' })).toBe('sun');
    expect(of('Ceva', { kind: 'event' })).toBe('calendar');
    expect(of('Ceva', { kind: 'idea' })).toBe('bulb');
    expect(of('Ceva', { kind: 'plan' })).toBe('flag');
    expect(of('Ceva', { kind: 'activity' })).toBe('star');
    expect(of('Ceva')).toBe('list');
  });
});

describe('a plan says where it stands', () => {
  const plan = k({ kind: 'plan', title: 'Plan' });
  const a = k({ title: 'A', status: 'done' }), b = k({ title: 'B' }), c = k({ title: 'C' });
  it('with its next open step, in order', () => {
    expect(planLine({ plan, steps: [a, b, c], done: 1 })).toEqual({ next: b, line: 'Urmează' });
  });
  it('or in words when there is none', () => {
    expect(planLine({ plan, steps: [], done: 0 })).toEqual({ next: null, line: 'Fără pași încă' });
    expect(planLine({ plan, steps: [a], done: 1 })).toEqual({ next: null, line: 'Toți pașii sunt gata' });
    expect(planLine({ plan: { ...plan, status: 'done' }, steps: [a], done: 1 })).toEqual({ next: null, line: 'Gata' });
  });
});
