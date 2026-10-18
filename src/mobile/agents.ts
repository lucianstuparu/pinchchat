/**
 * The agents the messenger can talk to. The Inbox (the user's gateway agent)
 * captures and routes everything and receives shares and the offline outbox;
 * the others are ai.manager domain agents you ask directly.
 */
export interface MessengerAgent {
  id: string;
  label: string;
  session: string;
  placeholder: string;
}

const INBOX_SESSION = import.meta.env.VITE_AGENT_SESSION || 'agent:gateway-lucian:main';

export const AGENTS: MessengerAgent[] = [
  { id: 'inbox', label: 'Inbox', session: INBOX_SESSION,
    placeholder: 'Send anything — a note, a link, a photo. Shared items from other apps land here too.' },
  { id: 'admin', label: 'Admin', session: 'agent:admin:main',
    placeholder: 'Ask about bills, deadlines and contracts — e.g. "what do I have to pay this week?" or "scan my mail for bills".' },
];

export const INBOX = AGENTS[0];
const KEY = 'openclaw-pwa:agent';

export function agentForSession(session: string): MessengerAgent {
  return AGENTS.find(a => a.session === session) ?? INBOX;
}

export function loadAgent(): MessengerAgent {
  try {
    return AGENTS.find(a => a.id === localStorage.getItem(KEY)) ?? INBOX;
  } catch {
    return INBOX;
  }
}

export function saveAgent(agent: MessengerAgent) {
  try {
    localStorage.setItem(KEY, agent.id);
  } catch {
    // Not persisted — the choice still holds for this visit
  }
}
