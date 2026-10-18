import { describe, it, expect } from 'vitest';
import { messengerAgents } from '../agents';

const shared = ['main', 'gateway-lucian', 'admin', 'gateway-ludmila', 'admin-ludmila'];
const sessions = (person: string, agents = shared) => messengerAgents(agents, person).map(a => `${a.id}=${a.session}`);

describe('messengerAgents', () => {
  it('gives Lucian his Inbox and the plain admin agent', () => {
    expect(sessions('lucian')).toEqual(['inbox=agent:gateway-lucian:main', 'admin=agent:admin:main']);
  });

  it('gives Ludmila her own Inbox and admin-ludmila, never Lucian\'s', () => {
    expect(sessions('ludmila')).toEqual(['inbox=agent:gateway-ludmila:main', 'admin=agent:admin-ludmila:main']);
  });

  it('falls back to the first Inbox when nobody is identified', () => {
    expect(sessions('')).toEqual(['inbox=agent:gateway-lucian:main', 'admin=agent:admin:main']);
  });

  it('works on a gateway that has only one person', () => {
    expect(sessions('ludmila', ['main', 'gateway-ludmila', 'admin'])).toEqual([
      'inbox=agent:gateway-ludmila:main', 'admin=agent:admin:main',
    ]);
  });

  it('leaves out Admin when the gateway has none', () => {
    expect(sessions('lucian', ['main', 'gateway-lucian'])).toEqual(['inbox=agent:gateway-lucian:main']);
  });
});
