/**
 * What a kids item looks like (my.design decisions 2026-11-05): a drawing of the real thing, in the
 * house stroke of the v2 boards (2 px ink, paper fill, at most one spot of colour). rules.ts objectFor
 * picks it from the words, so nothing here needs a model or a server. Decorative: the title beside it
 * always says what it is.
 */
import type { ReactNode } from 'react';
import { objectFor, type KidObjectName } from './rules';
import type { KidItem } from './api';

const FAINT = 'var(--pc-text-faint)';
const ACCENT = 'var(--pc-accent)';
const none = { fill: 'none' } as const;
const inkFill = { fill: 'var(--pc-text-primary)' } as const;
const WATER = '#9fd3ee', FLAME = '#e8933a', LEAF = '#3d9a5f', ROSE = '#e58fb4', GOLD = '#f5cf63';

const DRAW: Record<KidObjectName, ReactNode> = {
  goggles: <>
    <path d="M4 30c0-6 4-9 10-9h10c4 0 5 4 8 4s4-4 8-4h10c6 0 10 3 10 9v4c0 7-4 11-11 11h-6c-5 0-7-7-11-7s-6 7-11 7h-6C8 45 4 41 4 34z" />
    <ellipse cx="18" cy="33" rx="8" ry="6" fill={WATER} /><ellipse cx="46" cy="33" rx="8" ry="6" fill={WATER} />
  </>,
  gi: <>
    <path d="M22 8 7 16l5 15 7-3v28h26V28l7 3 5-15-15-8-10 14z" />
    <path d="M32 22v14" {...none} /><path d="M19 37h26" {...none} strokeWidth={4} /><path d="m32 38-5 11m5-11 5 11" {...none} />
  </>,
  ball: <>
    <circle cx="32" cy="32" r="25" />
    <path d="m32 20 11 8-4 13H25l-4-13z" {...inkFill} />
    <path d="M32 7v13M43 28l13-4M39 41l8 12M25 41l-8 12M21 28 8 24" {...none} />
  </>,
  note: <>
    <path d="M24 48V14l28-6v34" {...none} />
    <circle cx="16" cy="48" r="8" {...inkFill} /><circle cx="44" cy="42" r="8" {...inkFill} />
  </>,
  slipper: <>
    <path d="M5 42c9 0 15-9 23-13 6-3 12-4 18-2 7 2 13 8 13 14 0 6-6 9-15 9H15c-6 0-10-3-10-8z" />
    <path d="M28 29c-3-8 1-17 8-21M34 26c2-6 8-12 15-12" {...none} stroke={ROSE} />
  </>,
  racket: <>
    <ellipse cx="25" cy="24" rx="17" ry="20" transform="rotate(-35 25 24)" />
    <path d="M14 18 32 34M21 10l18 15M16 29l14-18M24 35l14-18" {...none} stroke={FAINT} />
    <path d="m38 38 18 20" {...none} strokeWidth={4} /><circle cx="52" cy="14" r="6" fill={GOLD} />
  </>,
  snow: <path d="M32 5v54M9 18l46 28M55 18 9 46M32 15l-7-6m7 6 7-6M32 49l-7 6m7-6 7 6M17 23l-9 2m9-2-3-9M47 41l9-2m-9 2 3 9M47 23l9 2m-9-2 3-9M17 41l-9-2m9 2-3 9" {...none} stroke={WATER} />,
  bike: <>
    <circle cx="14" cy="44" r="11" {...none} /><circle cx="50" cy="44" r="11" {...none} />
    <path d="M14 44 26 24h18l6 20M26 24l8 20H14M44 24l-2-9h8M26 24l-2-6h-6" {...none} />
  </>,
  cake: <>
    <path d="M9 57V33h46v24z" />
    <path d="M9 33h46v10c-9 6-14-1-19 3s-8 0-13-2-9 4-14-2z" fill={ROSE} />
    <path d="M32 33V21" {...none} />
    <path d="M32 5c4 5 4 10 0 12-4-2-4-7 0-12z" fill={FLAME} stroke="none" />
  </>,
  envelope: <>
    <rect x="5" y="13" width="54" height="40" rx="5" />
    <path d="m5 18 27 21 27-21" {...none} />
    <path d="M32 49c-5-3-7-5-7-7a3 3 0 0 1 7-1 3 3 0 0 1 7 1c0 2-2 4-7 7z" fill={ROSE} stroke="none" />
  </>,
  form: <>
    <rect x="11" y="5" width="42" height="54" rx="5" />
    <path d="M20 18h24M20 28h24" {...none} stroke={FAINT} strokeWidth={3} />
    <path d="M20 43c4-6 6-6 7-2s3 4 5 0 4-3 5 0 4 2 7 0" {...none} stroke={ACCENT} />
  </>,
  school: <>
    <path d="M7 57V29l25-14 25 14v28z" />
    <path d="M26 57V41h12v16" {...none} /><path d="M32 15V4" {...none} />
    <path d="M32 4h10l-3 3 3 3H32z" fill={FLAME} stroke="none" />
    <path d="M14 36h5M45 36h5" {...none} />
  </>,
  backpack: <>
    <path d="M15 28c0-11 7-18 17-18s17 7 17 18v29H15z" />
    <path d="M25 10c0-7 14-7 14 0" {...none} />
    <rect x="22" y="37" width="20" height="13" rx="3" fill={GOLD} />
    <path d="M22 28h20" {...none} />
  </>,
  sun: <>
    <circle cx="32" cy="32" r="13" fill={GOLD} />
    <path d="M32 5v8M32 51v8M5 32h8M51 32h8M13 13l6 6M45 45l6 6M13 51l6-6M45 19l6-6" {...none} />
  </>,
  book: <path d="M32 16c-6-5-15-6-26-5v41c11-1 20 0 26 5 6-5 15-6 26-5V11c-11-1-20 0-26 5zM32 16v41" />,
  plaster: <>
    <rect x="4" y="21" width="56" height="22" rx="11" transform="rotate(-35 32 32)" />
    <rect x="21" y="23" width="22" height="18" rx="3" transform="rotate(-35 32 32)" fill={ROSE} />
  </>,
  gift: <>
    <rect x="10" y="27" width="44" height="30" rx="3" /><rect x="6" y="18" width="52" height="10" rx="3" />
    <path d="M32 18v39" {...none} stroke={ROSE} strokeWidth={4} />
    <path d="M32 18c-6-12-20-10-15-3 2 3 9 3 15 3zM32 18c6-12 20-10 15-3-2 3-9 3-15 3z" {...none} />
  </>,
  scissors: <>
    <circle cx="16" cy="49" r="8" {...none} /><circle cx="40" cy="53" r="8" {...none} />
    <path d="M21 43 54 6M35 46 11 8" {...none} />
  </>,
  brush: <>
    <path d="m55 7 3 3-23 28-6-6z" />
    <path d="M29 32c-7 0-11 4-12 11-1 5-4 7-9 8 8 4 18 3 23-3 4-5 4-10 4-10z" fill={ROSE} />
  </>,
  plant: <>
    <path d="M32 40V18" {...none} stroke={LEAF} />
    <path d="M32 29c-9 0-15-5-17-15 10 0 15 5 17 15zM32 22c0-8 5-14 15-16 0 11-5 16-15 16z" fill={LEAF} stroke="none" />
    <path d="M15 40h34l-4 18H19z" />
  </>,
  pot: <>
    <path d="M12 30h40v15a12 12 0 0 1-12 12H24a12 12 0 0 1-12-12z" />
    <path d="M6 30h52M12 37H5M52 37h7" {...none} />
    <path d="M24 21c-3-4 3-6 0-11M40 21c-3-4 3-6 0-11" {...none} stroke={FAINT} />
  </>,
  bag: <>
    <path d="M11 22h42l4 36H7z" />
    <path d="M22 31V17a10 10 0 0 1 20 0v14" {...none} />
  </>,
  ticket: <>
    <path d="M5 18h54v9a5 5 0 0 0 0 10v9H5v-9a5 5 0 0 0 0-10z" />
    <path d="M43 19v26" {...none} strokeDasharray="3 5" /><path d="M14 28h20M14 36h13" {...none} stroke={FAINT} strokeWidth={3} />
  </>,
  calendar: <>
    <rect x="7" y="11" width="50" height="46" rx="7" />
    <path d="M7 25h50M21 5v11M43 5v11" {...none} />
    <circle cx="43" cy="42" r="6" fill={ACCENT} stroke="none" />
  </>,
  bulb: <>
    <path d="M32 5a19 19 0 0 0-11 34c3 3 4 5 4 8h14c0-3 1-5 4-8A19 19 0 0 0 32 5z" fill={GOLD} />
    <path d="M26 53h12M28 59h8" {...none} />
  </>,
  list: <>
    <rect x="11" y="9" width="42" height="50" rx="5" />
    <rect x="23" y="4" width="18" height="10" rx="3" />
    <path d="m19 29 3 3 6-6M19 45l3 3 6-6" {...none} stroke={ACCENT} /><path d="M33 30h12M33 46h12" {...none} stroke={FAINT} strokeWidth={3} />
  </>,
  star: <path d="m32 6 8 17 18 2-13 13 3 19-16-9-16 9 3-19L6 25l18-2z" fill={GOLD} />,
  flag: <>
    <path d="M15 59V6" {...none} />
    <path d="M15 8h36l-9 11 9 11H15z" fill={ACCENT} />
    <path d="M6 59h18" {...none} />
  </>,
};

/** `glow` marks the one highlighted thing on a screen. */
export function KidObject({ item, size, glow }: { item: Pick<KidItem, 'kind' | 'title' | 'type' | 'tags'>; size: number; glow?: boolean }) {
  return (
    <span aria-hidden className="relative block shrink-0" style={{ width: size, height: size }}>
      {glow && <span className="absolute left-[12%] h-2 w-[76%] rounded-[50%] bg-[rgba(var(--pc-accent-rgb),0.35)]" style={{ bottom: -3 }} />}
      <svg viewBox="0 0 64 64" width={size} height={size} className="relative block [&_*]:[vector-effect:non-scaling-stroke]"
        fill="var(--pc-bg-elevated)" stroke="var(--pc-text-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {DRAW[objectFor(item)]}
      </svg>
    </span>
  );
}
