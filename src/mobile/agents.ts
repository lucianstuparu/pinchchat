/**
 * The agents the messenger can talk to, for the person logged in. Lucian and
 * Ludmila share one gateway for now (ai.manager D7), so the app asks the
 * server who is logged in (/whoami, from the Cloudflare Access identity) and
 * picks that person's agents: `gateway-<person>` is the Inbox (captures and
 * routes everything, receives shares and the offline outbox) and
 * `admin-<person>` (or plain `admin`) the Admin & finance agent.
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

/** Who is logged in: a person name, or "" when unknown (e.g. opened on the LAN without Access). */
export async function fetchPerson(): Promise<string> {
  try {
    const r = await fetch('/whoami', { cache: 'no-store', credentials: 'same-origin' });
    const t = r.ok ? (await r.text()).trim() : '';
    return /^[a-z][a-z0-9-]{0,30}$/.test(t) ? t : '';
  } catch {
    return '';
  }
}

/** Inbox first, then the domain agents this gateway has for this person. */
export function messengerAgents(gatewayAgents: string[], person: string): MessengerAgent[] {
  const gateway = (person && gatewayAgents.includes(`gateway-${person}`))
    ? `gateway-${person}`
    : gatewayAgents.find(a => a.startsWith('gateway-'));
  const inbox: MessengerAgent = {
    id: 'inbox', label: 'Inbox', placeholder: INBOX_TEXT,
    session: gateway ? `agent:${gateway}:main` : FALLBACK_INBOX,
  };
  const own = (id: string) => (person && gatewayAgents.includes(`${id}-${person}`) ? `${id}-${person}` : id);
  return [inbox, ...DOMAIN_AGENTS
    .filter(a => gatewayAgents.includes(own(a.id)))
    .map(a => ({ ...a, session: `agent:${own(a.id)}:main` }))];
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
