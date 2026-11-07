import { describe, expect, it } from 'vitest';
import { aisleBlocks, aisleOf, type Aisle } from '../aisles';

const of = (title: string, group = 'groceries') => aisleOf({ title, tags: [], group });

// Real names from the list on 2026-11-07.
const REAL: [string, Aisle, string?][] = [
  ['Mere', 'produce'], ['Banane', 'produce'], ['Portocale', 'produce'], ['Pere', 'produce'], ['Căpșuni', 'produce'], ['Ceapă', 'produce'], ['Cartofi', 'produce'],
  ['Castravete mare', 'produce'], ['Dovleci mici', 'produce'],
  ['Pâine tip hot dog (pentru sandviș)', 'bakery'], ['Pâine bio rotundă', 'bakery'], ['Pâine precoaptă Carrefour', 'bakery'],
  ['Pui', 'meat'], ['Rață', 'meat'], ['Jambon fără nitriți', 'meat'], ['Chichis poulet (Le Gaulois)', 'meat'], ['Pește', 'meat'], ['Pește de prăjit în tigaie', 'meat'], ['Truite fumée (tranches)', 'meat'],
  ['Lapte', 'dairy'], ['Lapte UHT', 'dairy'], ['Ouă', 'dairy'], ['Brânză', 'dairy'], ['Unt', 'dairy'], ['Kefir', 'dairy'], ['Kéfir', 'dairy'], ['Iaurt grecesc', 'dairy'], ['Ficello', 'dairy'],
  ['Croissants surgelés Simpl x20', 'frozen'],
  ['Macédoine', 'dry'], ['Lentilles', 'dry'], ['Orez', 'dry'], ['Ovăz (oats)', 'dry'], ['Nuci', 'dry'], ['Arahide', 'dry'], ['Caju', 'dry'], ['Borcane', 'dry'],
  ['Haricots géants blancs à la sauce tomate (fasole)', 'dry'], ["Sardines au naturel Phare d'Eckmühl", 'dry'], ['Ulei de floarea-soarelui sau mix (4 uleiuri bio)', 'dry'],
  ["Cereale de porumb Kellogg's (Corn Flakes)", 'dry'], ['Oh! High Protein Crunchy Müesli Choco', 'dry'],
  ['Dulceață de căpșuni', 'sweets'], ['Ciocolată', 'sweets'], ['Ciocolată cu zmeură (framboise)', 'sweets'], ['Belvita cu cranberries', 'sweets'], ['Batoane proteice', 'sweets'], ['Popcorn sărat', 'sweets'], ['Dulciuri de Halloween pentru copii', 'sweets'],
  ['Apă', 'drinks'], ['Apă plată', 'drinks'],
  ['Meridol perio solution chlorhexidine 0,2%', 'hygiene'], ['Gel de duș', 'hygiene', 'house'], ['Pastă de dinți (Carla)', 'hygiene', 'house'], ['Scutece', 'hygiene', 'house'], ['Elseve Dream Long démêlant (balsam păr)', 'hygiene', 'house'],
  ['Detergent de rufe', 'cleaning', 'house'], ['Saci de gunoi 20 L (baie)', 'cleaning', 'house'], ['Sare pentru mașina de spălat vase', 'cleaning', 'house'], ['Prosoape de bucătărie', 'cleaning', 'house'],
  ['Bec pentru lampă', 'house', 'house'],
  ['Whiskas 1+ cu vită (hrană uscată pisici)', 'pets', 'other'], ['Felix în gelée, mix 44 pliculețe (11x pui, somon, cod, rață)', 'pets', 'other'], ['Litieră pentru Gabi', 'pets', 'other'],
  ['Baterii LR44 (pastilă)', 'tech', 'tech'], ['Distribuitor robinet grădină, 4 căi (GEKA)', 'garden', 'garden'], ['Cartea „Colț Alb” (pentru Carla)', 'other', 'other'],
];

describe('aisles', () => {
  it.each(REAL)('%s goes with %s', (title, aisle, group) => { expect(of(title, group)).toBe(aisle); });

  it('reads the catalogue product when the name says nothing', () => {
    expect(aisleOf({ title: 'Madame', tags: [], group: 'groceries' }, { name: 'Tranches de truite fumée' })).toBe('meat');
  });

  it('a food nothing matches goes with the dry goods', () => { expect(of('Xyz')).toBe('dry'); });

  it('words match whole: "pain" not "painting", "ou" not "soup"', () => {
    expect(of('painting set')).toBe('dry');
    expect(of('soup')).toBe('dry');
  });

  it('neighbours end up together, and blocks follow a walk through the shop', () => {
    const list = ['Kefir', 'Mere', 'Lapte', 'Pui', 'Banane', 'Detergent de rufe'].map(title => ({ title, tags: [] as string[], group: title.startsWith('Det') ? 'house' : 'groceries' }));
    expect(aisleBlocks(list, i => i, () => undefined).map(b => b.map(i => i.title))).toEqual([['Banane', 'Mere'], ['Pui'], ['Kefir', 'Lapte'], ['Detergent de rufe']]);
  });
});
