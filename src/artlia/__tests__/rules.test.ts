import { describe, it, expect } from 'vitest';
import { byPhase, catStats, sectionsOf, groupNow, matchesArt, plan, senderOf, termRuns, topOf, withSender } from '../rules';
import type { ArtItem, Category } from '../api';

const T = '2026-10-24';
let seq = 0;
const it_ = (over: Partial<ArtItem>): ArtItem => ({ id: `art-${++seq}`, n: seq, title: `item ${seq}`, cat: 'erp', status: 'todo', ...over });
const cats: Category[] = [{ id: 'erp', label: 'ERP', order: 1 }, { id: 'banca', label: 'Bancă', order: 2 }];

describe('Acum', () => {
  it('puts each open item in one group, by due date, then de verificat, then priority', () => {
    const items = [
      it_({ title: 'late', due_date: '2026-10-20' }),
      it_({ title: 'this week', due_date: '2026-10-29' }),
      it_({ title: 'in three weeks', due_date: '2026-11-12' }),
      it_({ title: 'far', due_date: '2027-03-01' }),
      it_({ title: 'to check', status: 'check' }),
      it_({ title: 'starred', priority: 'P1' }),
      it_({ title: 'done', status: 'done', due_date: '2026-10-20' }),
      it_({ title: 'put off', due_date: '2026-11-01', snoozed_until: '2026-10-30' }),
    ];
    const g = groupNow(items, T);
    expect(g.overdue.map(i => i.title)).toEqual(['late']);
    expect(g.week.map(i => i.title)).toEqual(['this week']);
    expect(g.soon.map(i => i.title)).toEqual(['in three weeks']);
    expect(g.check.map(i => i.title)).toEqual(['to check']);
    expect(g.priority.map(i => i.title)).toEqual(['starred']);
    expect(g.putOff).toBe(1);
    expect(topOf(items, T).top?.title).toBe('late');
  });
});

describe('Plan', () => {
  it('dated items go to the next milestone, undated ones to their phase, the rest to Fără dată', () => {
    const items = [
      it_({ kind: 'milestone', title: 'Oferta de credit', due_date: '2026-10-30' }),
      it_({ kind: 'milestone', title: 'Lucrări', due_date: '2027-06-30', phase: 'lucrari' }),
      it_({ kind: 'milestone', title: 'Comisia', due_date: '2027-08-31', phase: 'deschidere' }),
      it_({ title: 'sign offer', due_date: '2026-10-29' }),
      it_({ title: 'door', phase: 'lucrari' }),
      it_({ title: 'PV', phase: 'deschidere' }),
      it_({ title: 'registre', phase: 'dupa' }),
      it_({ title: 'floating' }),
    ];
    const p = plan(items, T);
    expect(p.map(s => s.label)).toEqual(['Oferta de credit', 'Lucrări', 'Comisia', 'După deschidere', 'Fără dată']);
    expect(p[0].items.map(i => i.title)).toEqual(['sign offer']);
    expect(p[1].items.map(i => i.title)).toEqual(['door']);
    expect(p[2].items.map(i => i.title)).toEqual(['PV']);
    expect(p[3].items.map(i => i.title)).toEqual(['registre']);
    expect(p[4].items.map(i => i.title)).toEqual(['floating']);
  });
});

describe('Categorii', () => {
  it('counts open, overdue and done per category; milestones and dropped items do not count', () => {
    const items = [
      it_({ cat: 'erp', due_date: '2026-10-01' }), it_({ cat: 'erp', status: 'done' }), it_({ cat: 'erp', status: 'cancelled' }),
      it_({ cat: 'erp', kind: 'milestone' }), it_({ cat: 'banca' }),
    ];
    const [erp, banca] = catStats(items, cats, T);
    expect([erp.open, erp.overdue, erp.done, erp.total]).toEqual([1, 1, 1, 2]);
    expect(banca.open).toBe(1);
    expect(byPhase([it_({ phase: 'deschidere' }), it_({}), it_({ phase: 'lucrari' })]).map(g => g.label))
      .toEqual(['În timpul lucrărilor', 'Înainte de deschidere', 'Altele']);
  });
});

describe('a category screen', () => {
  it('uses the checklist groups when the items have them, else the phases', () => {
    expect(sectionsOf([it_({ group: 'fire' }), it_({ group: 'first' }), it_({})]).map(s => s.label))
      .toEqual(['De făcut întâi', 'Securitate la incendiu', 'Altele']);
    expect(sectionsOf([it_({ phase: 'dupa' })]).map(s => s.label)).toEqual(['După deschidere']);
  });
});

describe('texts', () => {
  it('finds glossary terms', () => {
    expect(termRuns('Ask whether a [[DP]] is needed')).toEqual([{ text: 'Ask whether a ' }, { text: 'DP', term: 'DP' }, { text: ' is needed' }]);
  });
  it('knows who wrote a message in the shared chat', () => {
    expect(senderOf('[Ludmila] am sunat la mairie')).toEqual({ name: 'Ludmila', text: 'am sunat la mairie' });
    expect(senderOf('fără nume')).toEqual({ name: null, text: 'fără nume' });
    expect(withSender('Lucian', 'salut')).toBe('[Lucian] salut');
  });
  it('searches by number or words, accents aside', () => {
    const i = it_({ n: 42, title: 'Ușa spre scara exterioară', what: 'bureau n°3' });
    expect(matchesArt(i, '42')).toBe(true);
    expect(matchesArt(i, 'usa scara')).toBe(true);
    expect(matchesArt(i, 'bureau')).toBe(true);
    expect(matchesArt(i, 'lift')).toBe(false);
  });
});
