import type { ReactElement } from 'react';
import { Archive, Bath, Package, Refrigerator, Snowflake, type LucideProps } from 'lucide-react';
import type { Where } from './pantry';

/** Where something is kept at home, as a drawn icon (my.design: no emoji as UI icons). */
const ICONS: Record<Where, (p: LucideProps) => ReactElement> = {
  fridge: p => <Refrigerator {...p} />, freezer: p => <Snowflake {...p} />, pantry: p => <Archive {...p} />,
  bathroom: p => <Bath {...p} />, other: p => <Package {...p} />,
};
export function WhereIcon({ where, size = 20, className }: { where?: Where; size?: number; className?: string }) {
  return ICONS[where ?? 'fridge']({ size, className, 'aria-hidden': true });
}
