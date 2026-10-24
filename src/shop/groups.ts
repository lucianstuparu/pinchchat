/**
 * What kind of thing an item is, and its colour (Lucian, 2026-10-24: "two columns like Google Keep,
 * groceries in a powerful yellow, house in blue, garden in green, tech in silver, grouped by type").
 * The server sends every item with its group (shop.mjs + groups.mjs); this guess is for items added
 * offline. The word lists are the same as the server's groups.mjs: change both together.
 */
import type { Item } from './logic';

export type Group = 'groceries' | 'house' | 'garden' | 'tech' | 'other';
export const GROUPS: Group[] = ['groceries', 'house', 'garden', 'tech', 'other'];
export const GROUP_NAMES: Record<Group, string> = { groceries: 'Groceries', house: 'House', garden: 'Garden', tech: 'Tech', other: 'Other' };

/**
 * Keep-style note colours: the card is tinted, the text stays the normal text colour (yellow text is
 * unreadable); `ink` is for the card's title and ticks (at least 4.5:1 on its card). Tech is a steel
 * silver: a plain grey reads as "disabled" next to the others.
 */
const COLOURS: Record<Group, { light: [string, string, string]; dark: [string, string, string] }> = {
  //                 card       border     ink
  groceries: { light: ['#ffe680', '#f2cf3a', '#5c4300'], dark: ['#4d3f0a', '#6b5810', '#ffd84d'] },
  house:     { light: ['#cfe3fb', '#a9cbf2', '#174a85'], dark: ['#173352', '#24496f', '#93c2f5'] },
  garden:    { light: ['#cdeec2', '#a6dc96', '#1f5e22'], dark: ['#1b3a1d', '#29552b', '#94d98f'] },
  tech:      { light: ['#e2e7ed', '#c6ced8', '#3b4754'], dark: ['#2a3139', '#3b4550', '#c3ccd6'] },
  other:     { light: ['#f1efea', '#dedad1', '#55524b'], dark: ['#2b2a28', '#3a3936', '#c9c5bc'] },
};
export const groupColours = (g: Group, mode: 'light' | 'dark') => {
  const [card, border, ink] = COLOURS[g][mode];
  return { card, border, ink };
};

const WORDS: Partial<Record<Group, string[]>> = {
  garden: ['gradin*', 'jardin*', 'garden*', 'seminte', 'samanta', 'graine*', 'semence*', 'seed*', 'plant*', 'rasad*', 'flori', 'floare', 'fleur*',
    'flower*', 'ghiveci*', 'jardiniere', 'pamant', 'terreau', 'compost*', 'ingrasamant*', 'engrais', 'fertili*', 'gazon', 'pelouse', 'furtun*',
    'tuyau d arrosage', 'arrosage', 'aspersor*', 'stropitoare', 'irigat*', 'secateur', 'foarfeca de gradina', 'grebla', 'lopata', 'sapa', 'hose'],
  tech: ['usb*', 'cablu*', 'cable*', 'charger*', 'incarcator*', 'chargeur*', 'baterii', 'baterie', 'battery', 'batteries', 'pile', 'piles',
    'lr44', 'aa', 'aaa', 'hdmi', 'adaptor*', 'adaptateur*', 'adapter*', 'telefon*', 'phone*', 'laptop*', 'ordinateur*', 'mouse', 'souris',
    'tastatura', 'clavier', 'keyboard', 'ssd', 'hdd', 'microsd', 'card sd', 'router*', 'casti', 'ecouteur*', 'headphone*', 'boxa', 'speaker*',
    'foto', 'instax', 'camera', 'imprimant*', 'printer*', 'toner', 'cartus*', 'prelungitor*', 'multiprize', 'rallonge', 'telecomand*'],
  house: ['hartie igienica', 'papier toilette', 'detergent*', 'lessive', 'sanytol', 'dezinfectant*', 'desinfectant*', 'burete*', 'eponge*',
    'saci', 'sac poubelle', 'sacs poubelle', 'sare pentru masina', 'sel lave', 'tablete pentru masina', 'capsule*', 'lampa', 'lampe', 'lamp',
    'bec', 'becuri', 'ampoule*', 'prosop*', 'serviette*', 'cos de rufe', 'rufe', 'linge', 'husa', 'huse', 'cover', 'perna', 'perne', 'oreiller*',
    'lenjerie', 'draps', 'pat', 'lit', 'canapea', 'canape', 'scaun*', 'chaise*', 'raft*', 'etagere*', 'dulap*', 'armoire*', 'radiator*',
    'radiateur*', 'chauffage', 'aspirator*', 'aspirateur*', 'mop', 'matura', 'balai', 'scutece', 'couches', 'servetele', 'lingettes', 'sapun*',
    'savon*', 'sampon*', 'shampoo*', 'pasta de dinti', 'dentifrice', 'periuta*', 'chiuveta', 'evier', 'covor*', 'tapis', 'perdea', 'perdele',
    'rideau*', 'cuier', 'umeras*', 'cintre*', 'vase', 'pahare', 'verres', 'farfurii', 'tigaie', 'poele', 'oala', 'casserole'],
};
const SHOP_GROUP: Record<string, Group> = {
  ikea: 'house', hornbach: 'house', 'leroy-merlin': 'house', castorama: 'house', dedeman: 'house', brico: 'house', 'brico-depot': 'house',
  jardiland: 'garden', truffaut: 'garden', botanic: 'garden', darty: 'tech', fnac: 'tech', boulanger: 'tech', 'media-markt': 'tech',
  pharmacy: 'other', decathlon: 'other',
};
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RULES = (['garden', 'tech', 'house'] as Group[]).map(g => [g, new RegExp(
  `(?:^|[^a-z0-9])(?:${WORDS[g]!.map(w => (w.endsWith('*') ? `${esc(w.slice(0, -1))}[a-z0-9]*` : esc(w))).join('|')})(?![a-z0-9])`)] as const);

/** The group of an item: its own, else from its name, else from its shop, else groceries. */
export function groupOf(item: Pick<Item, 'title' | 'tags'> & { group?: string }): Group {
  if (GROUPS.includes(item.group as Group)) return item.group as Group;
  const name = fold(item.title || '').replace(/[^a-z0-9]+/g, ' ');
  for (const [g, re] of RULES) if (re.test(name)) return g;
  for (const t of item.tags ?? []) if (SHOP_GROUP[t]) return SHOP_GROUP[t];
  return 'groceries';
}
