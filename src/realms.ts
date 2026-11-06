/**
 * The realm registry (my.design v2/oc-v2-brief.md §9): Everything is driven by this list; adding a realm is a row here and in the
 * server's matters.mjs. A matter sits inside a realm. Other is not a realm: it is what the chat still has to ask about.
 */
export interface Realm { id: string; name: string }

export const REALMS: Realm[] = [
  { id: 'desk', name: 'Desk' },
  { id: 'casa-artlia', name: 'Casa Artlia' },
  { id: 'associations', name: 'Associations' },
  { id: 'finance', name: 'Finance and tax' },
  { id: 'projects', name: 'Projects' },
  { id: 'parenting', name: 'Parenting' },
  { id: 'house', name: 'House and garden' },
  { id: 'people', name: 'People' },
];

export const OTHER: Realm = { id: 'other', name: 'Other' };

export const realmName = (id?: string) => REALMS.find(r => r.id === id)?.name ?? OTHER.name;
