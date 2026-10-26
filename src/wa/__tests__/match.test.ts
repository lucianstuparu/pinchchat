import { describe, expect, it } from 'vitest';
import { matchContact, type Contact } from '../api';

const c = (id: string, label: string, name: string, aliases: string[] = []): Contact =>
  ({ id, label, name, aliases, phone: '+33', lang: 'ro', tone: 'informal', channel: 'whatsapp', sent: 0 });
const people = [
  c('a', 'Bunica', 'Eugenia Gamurari', ['mamaie']),
  c('b', 'Ludmila', 'Ludmila Stuparu', ['Lucky']),
  c('c', 'Berenger', 'Berenger Legrand', ['agentul imobiliar']),
];

describe('matchContact', () => {
  it('finds a name, also declined, without diacritics', () => {
    expect(matchContact('Spune-i bunicii că ajung la 7', people)?.id).toBe('a');
    expect(matchContact('spune-i Ludmilei că întârzii', people)?.id).toBe('b');
    expect(matchContact('Bérenger: on se voit lundi', people)?.id).toBe('c');
    expect(matchContact('scrie-i lui Eugenia că vin', people)?.id).toBe('a');
  });
  it('other names, also of several words', () => {
    expect(matchContact('zi-i lui mamaie că o sun', people)?.id).toBe('a');
    expect(matchContact('scrie agentul imobiliar că semnăm joi', people)?.id).toBe('c');
  });
  it('the one named first is the one it is for', () => {
    expect(matchContact('spune-i Ludmilei că bunica vine', people)?.id).toBe('b');
  });
  it('nobody named: null (the agent is asked)', () => {
    expect(matchContact('ajung la 7', people)).toBeNull();
    expect(matchContact('', people)).toBeNull();
  });
});
