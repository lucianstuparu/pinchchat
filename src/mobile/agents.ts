/**
 * The agents the messenger can talk to. Each person has their own gateway
 * (ai.manager D7: Lucian's and Ludmila's), so the list is built from the
 * connected gateway's agents: its `gateway-<person>` agent is the Inbox
 * (captures and routes everything, receives shares and the offline outbox),
 * and `admin` is the Admin & finance agent you ask directly.
 */
export interface MessengerAgent {
  id: string;
  label: string;
  session: string;
  placeholder: string;
}

const FALLBACK_INBOX = import.meta.env.VITE_AGENT_SESSION || 'agent:gateway-lucian:main';
const INBOX_TEXT = 'Send anything — a note, a link, a photo. Shared items from other apps land here too.';

const DOMAIN_AGENTS: Array<Omit<MessengerAgent, 'session'>> = [
  { id: 'admin', label: 'Admin',
    placeholder: 'Ask about bills, deadlines and contracts — e.g. "what do I have to pay this week?" or "scan my mail for bills".' },
];

/** Inbox first, then the domain agents this gateway actually has. */
export function messengerAgents(gatewayAgents: string[]): MessengerAgent[] {
  const gateway = gatewayAgents.find(a => a.startsWith('gateway-'));
  const inbox: MessengerAgent = {
    id: 'inbox', label: 'Inbox', placeholder: INBOX_TEXT,
    session: gateway ? `agent:${gateway}:main` : FALLBACK_INBOX,
  };
  return [inbox, ...DOMAIN_AGENTS
    .filter(a => gatewayAgents.includes(a.id))
    .map(a => ({ ...a, session: `agent:${a.id}:main` }))];
}

const KEY = 'openclaw-pwa:agent';

export function loadAgentId(): string {
  try {
    return localStorage.getItem(KEY) ?? 'inbox';
  } catch {
    return 'inbox';
  }
}

export function saveAgentId(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not persisted — the choice still holds for this visit
  }
}
