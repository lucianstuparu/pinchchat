/**
 * A shop as its logo instead of its name (Lucian, 2026-10-25: "use shop logos instead of text, it's
 * too much text"). Logos are the shops' own site icons, kept in public/brands; a shop without
 * one gets its initials on a tinted square, the pharmacy a cross. The name stays for screen readers
 * and as a tooltip.
 */
import { Cross } from 'lucide-react';

const LOGOS: Record<string, string> = {
  carrefour: 'carrefour', 'carrefour-market': 'carrefour', lidl: 'lidl', 'grand-frais': 'grand-frais',
  leclerc: 'leclerc', migros: 'migros', ikea: 'ikea', hornbach: 'hornbach',
};

/** Two letters for a shop with no logo: the initials of its words, else its first two letters. */
const initialsOf = (name: string) => {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(w => w && !/^(la|le|les|de|du)$/i.test(w));
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2)).toUpperCase();
};

export function ShopLogo({ tag, name, size = 20 }: { tag: string; name: string; size?: number }) {
  const box = { width: size, height: size };
  if (LOGOS[tag]) {
    return <img src={`/brands/${LOGOS[tag]}.png`} alt={name} title={name} style={box} className="inline-block shrink-0 rounded-[4px] bg-white object-contain" />;
  }
  if (tag === 'pharmacy') {
    return <span role="img" aria-label={name} title={name} style={box} className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-emerald-600 text-white"><Cross size={size * 0.7} fill="currentColor" strokeWidth={0} /></span>;
  }
  return (
    <span role="img" aria-label={name} title={name} style={{ ...box, fontSize: size * 0.45 }}
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-pc-text-faint/25 font-bold leading-none text-pc-text-secondary">
      {initialsOf(name)}
    </span>
  );
}

/** Several shops in a row (an item meant for Lidl or Grand Frais). */
export function ShopLogos({ tags, storeName, size = 16 }: { tags: string[]; storeName: (t: string) => string; size?: number }) {
  if (tags.length === 0) return null;
  return <span className="inline-flex shrink-0 items-center gap-1">{tags.map(t => <ShopLogo key={t} tag={t} name={storeName(t)} size={size} />)}</span>;
}
