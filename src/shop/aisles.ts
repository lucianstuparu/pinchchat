/**
 * Where a thing roughly is in a shop, so the In the shop list reads shelf by shelf (Lucian, 2026-11-07:
 * "they have fruits and vegetables in one place, meats and fish in one place, dairy in another ... I
 * don't need to actually see the text"). No headings: the app only puts neighbours together, so the
 * order of the aisles is a typical walk through a supermarket, not any one shop's.
 *
 * The words are RO, FR and EN, tested on the real list. The rules run in this order because some names
 * hold another aisle's word: "Whiskas cu vită" is for the cat, "Sardines" and "sauce tomate" are tins,
 * "Dulceață de căpșuni" is jam. A food nothing matches goes with the dry goods.
 */
import { GROUPS, groupOf } from './groups';
import type { Item, Product } from './logic';

const ORDER = ['produce', 'bakery', 'meat', 'dairy', 'frozen', 'dry', 'sweets', 'drinks', 'hygiene', 'cleaning', 'house', 'pets', 'garden', 'tech', 'other'] as const;
export type Aisle = typeof ORDER[number];

const WORDS: [Aisle, string[]][] = [
  ['pets', ['whiskas', 'felix', 'litier*', 'croquette*', 'pisic*', 'catel*', 'purina', 'sheba', 'friskies']],
  ['hygiene', ['meridol', 'gel de dus', 'gel dus', 'gel douche', 'sampon*', 'shampo*', 'balsam', 'demelant', 'elseve', 'pasta de dinti', 'dentifrice', 'periuta*',
    'floss', 'sapun*', 'savon*', 'deodorant*', 'scutece', 'couches', 'servetele umede', 'papier toilette', 'hartie igienica']],
  ['cleaning', ['detergent*', 'lessive', 'saci', 'sac poubelle', 'sacs poubelle', 'sare pentru masina', 'tablete pentru masina', 'cif', 'vanish', 'nettoyant*', 'degraissant*',
    'detartrant*', 'antikal', 'deboucheur', 'dissolvant', 'burete*', 'eponge*', 'prosoape de bucatarie', 'essuie tout', 'sanytol', 'dezinfectant*', 'desinfectant*']],
];
const FOOD: [Aisle, string[]][] = [
  ['frozen', ['surgel*', 'congel*', 'inghetat*', 'glace', 'glaces', 'frozen']],
  ['dry', ['sardine*', 'macedoine', 'bocal', 'borcan*', 'conserv*', 'haricots', 'fasole', 'lentil*', 'linte', 'sauce', 'sos', 'orez', 'riz', 'ovaz', 'muesli', 'cereale*', 'paste', 'pates',
    'gnocchi', 'ulei*', 'huile*', 'melange', 'faina', 'farine', 'zahar', 'sucre', 'sare', 'sel', 'nuci', 'caju', 'arahide', 'cacahuete*', 'psyllium', 'chanvre']],
  ['sweets', ['ciocolat*', 'chocolat*', 'dulci*', 'dulcea*', 'confiture', 'gem', 'biscuit*', 'belvita', 'batoane', 'bars', 'popcorn', 'chips', 'bomboane', 'cranberries', 'miere', 'miel']],
  ['bakery', ['paine', 'pain', 'pains', 'baguette*', 'croissant*', 'brioche*', 'boule', 'lipie']],
  ['meat', ['pui', 'rata', 'vita', 'porc', 'jambon', 'carne', 'cirnat*', 'carnat*', 'poulet', 'canard', 'boeuf', 'dinde', 'saucisse*', 'chichis', 'peste', 'truite', 'somon', 'saumon', 'cod', 'ton', 'thon', 'poulpe*', 'crevet*']],
  ['dairy', ['lapte', 'lait', 'oua', 'ou', 'oeuf*', 'branza', 'brinza', 'fromage*', 'chevre', 'ficello', 'unt', 'beurre', 'iaurt*', 'yaourt*', 'kefir', 'smantana', 'creme fraiche', 'cascaval', 'madame loik']],
  ['drinks', ['apa', 'eau', 'suc', 'jus', 'vin', 'bere', 'biere', 'cafea', 'cafe', 'ceai', 'the', 'cola']],
  ['produce', ['mere', 'mar', 'pomme*', 'banan*', 'portocal*', 'orange*', 'pere', 'poire*', 'capsuni', 'fraise*', 'lamai*', 'citron*', 'struguri', 'raisin*', 'ceapa', 'oignon*', 'cartof*', 'pomme de terre',
    'castravet*', 'concombre*', 'dovlec*', 'courge*', 'rosii', 'tomate*', 'morcov*', 'carotte*', 'salat*', 'ardei', 'poivron*', 'usturoi', 'ail', 'spanac', 'epinard*', 'varza', 'chou', 'broccoli', 'legume*', 'fruct*', 'fruit*']],
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rules = (list: [Aisle, string[]][]) => list.map(([a, words]) => [a, new RegExp(
  `(?:^|[^a-z0-9])(?:${words.map(w => (w.endsWith('*') ? `${esc(w.slice(0, -1))}[a-z0-9]*` : esc(w))).join('|')})(?![a-z0-9])`)] as const);
const ANY = rules(WORDS);
const EATEN = rules(FOOD);
const firstOf = (list: typeof ANY, name?: string): Aisle | null => {
  if (!name) return null;
  const n = fold(name);
  return list.find(([, re]) => re.test(n))?.[0] ?? null;
};

/** The aisle of a thing: its name first, then its catalogue product's name, then its kind. */
export function aisleOf(item: Pick<Item, 'title' | 'tags'> & { group?: string }, product?: Pick<Product, 'name'>): Aisle {
  const named = firstOf(ANY, item.title) ?? firstOf(ANY, product?.name);
  if (named) return named;
  const g = groupOf(item);
  if (g !== 'groceries' && GROUPS.includes(g)) return g;
  return firstOf(EATEN, item.title) ?? firstOf(EATEN, product?.name) ?? 'dry';
}

/** A list split into runs of neighbours, aisle by aisle, by name inside each. The caller's order is kept for equal names. */
export function aisleBlocks<T>(list: T[], itemOf: (t: T) => Pick<Item, 'title' | 'tags' | 'product'> & { group?: string }, productOf: (id?: string) => Pick<Product, 'name'> | undefined): T[][] {
  const keyed = list.map(t => { const i = itemOf(t); return { t, a: ORDER.indexOf(aisleOf(i, productOf(i.product))), n: fold(i.title) }; });
  keyed.sort((x, y) => x.a - y.a || x.n.localeCompare(y.n));
  const out: T[][] = [];
  let last = -1;
  for (const k of keyed) { if (k.a !== last) { out.push([]); last = k.a; } out[out.length - 1].push(k.t); }
  return out;
}
