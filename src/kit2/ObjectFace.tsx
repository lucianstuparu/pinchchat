/**
 * What a thing looks like (my.design v2/README.md, review 2): a brand's mono (a rounded square with its letters in its colour) or a
 * drawn object, one picture and never both (Lucian 2026-11-07, assumed, to confirm); never a raster logo. Drawn in the house stroke from the boards; others come from
 * the drawing job as SVG. Decorative: the caption beside it always says what it is. Keep OBJECTS in step with faces.mjs KNOWN_OBJECTS.
 */
import type { ReactNode } from 'react';
import type { Face } from '../app/api';

const INK = 'var(--pc-text-primary)';
const PAPER = 'var(--pc-bg-elevated)';
const s = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Each object: its box and the drawing. */
const OBJECTS: Record<string, { w: number; h: number; draw: ReactNode }> = {
  envelope: { w: 100, h: 70, draw: <>
    <rect x="2" y="2" width="96" height="66" rx="6" fill={PAPER} {...s} />
    <path d="M2 8l48 32 48-32" fill="none" {...s} />
  </> },
  phone: { w: 44, h: 72, draw: <>
    <rect x="4" y="2" width="36" height="68" rx="7" fill={PAPER} {...s} />
    <rect x="9" y="9" width="26" height="46" rx="2" fill="#f2f2f7" />
    <circle cx="22" cy="62" r="2.5" fill={INK} />
  </> },
  letter: { w: 58, h: 70, draw: <>
    <rect x="3" y="2" width="52" height="66" rx="3" fill={PAPER} {...s} />
    <path d="M9 30h40M9 39h40M9 48h26" fill="none" stroke="#d1d1d6" strokeWidth="3" strokeLinecap="round" />
  </> },
  person: { w: 60, h: 70, draw: <>
    <circle cx="30" cy="20" r="16" fill={PAPER} {...s} />
    <path d="M4 68c1-17 12-26 26-26s25 9 26 26z" fill={PAPER} {...s} />
  </> },
  stack: { w: 80, h: 62, draw: <>
    <rect x="16" y="2" width="60" height="42" rx="4" fill={PAPER} {...s} />
    <rect x="10" y="9" width="60" height="42" rx="4" fill={PAPER} {...s} />
    <rect x="4" y="16" width="60" height="42" rx="4" fill={PAPER} {...s} />
  </> },
  doc: { w: 58, h: 76, draw: <>
    <rect x="3" y="2" width="52" height="72" rx="5" fill={PAPER} {...s} />
    <path d="M11 38h36M11 48h36M11 58h24" fill="none" stroke="var(--pc-text-faint)" strokeWidth="3" strokeLinecap="round" />
  </> },
  folder: { w: 84, h: 62, draw: <path d="M3 12a4 4 0 0 1 4-4h22l8 8h40a4 4 0 0 1 4 4v34a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill={PAPER} {...s} /> },
  door: { w: 50, h: 78, draw: <>
    <rect x="4" y="2" width="42" height="74" rx="3" fill={PAPER} {...s} />
    <circle cx="37" cy="42" r="2.5" fill={INK} />
  </> },
  calendar: { w: 72, h: 72, draw: <>
    <rect x="4" y="10" width="64" height="58" rx="7" fill={PAPER} {...s} />
    <path d="M4 26h64M22 4v12M50 4v12" fill="none" {...s} />
  </> },
  bag: { w: 64, h: 76, draw: <>
    <path d="M6 24h52l4 48H2z" fill={PAPER} {...s} />
    <path d="M20 32V16a12 12 0 0 1 24 0v16" fill="none" {...s} />
  </> },
  pot: { w: 60, h: 62, draw: <>
    <path d="M8 24h44v12a22 22 0 0 1-44 0z" fill={PAPER} {...s} />
    <path d="M30 4v20M20 12l10 12 10-12" fill="none" stroke="#1f7a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </> },
};

const fileOf = (name: string) => `/reg/faces/${encodeURIComponent(name)}`;

function Mono({ letters, color, size }: { letters: string; color?: string; size: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center font-extrabold leading-none"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), background: color ?? '#e9e9ee', color: color ? '#fff' : '#3a3a3c', fontSize: Math.round(size * (letters.length > 2 ? 0.34 : 0.42)) }}>{letters}</span>
  );
}

/** `size` is the height the face may take. */
export function ObjectFace({ face, size, glow }: { face: Face; size: number; /** The one glow on the screen, under the next thing. */ glow?: boolean }) {
  const obj = OBJECTS[face.object ?? (face.drawing ? '' : 'doc')];
  const under = glow ? <span className="absolute left-[10%] h-2 w-4/5 rounded-[50%]" style={{ bottom: -7, background: 'var(--pc-accent-glow)' }} /> : null;
  if (face.mono && (face.mono_color || (!face.drawing && !face.object))) return <span aria-hidden className="relative inline-block shrink-0"><Mono letters={face.mono} color={face.mono_color} size={size} />{under}</span>;
  if (face.drawing) {
    return (
      <span aria-hidden className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {under}
        <img src={fileOf(face.drawing)} alt="" draggable={false} loading="lazy" width={size} height={size} className="block h-full w-full" />
      </span>
    );
  }
  if (!obj) return null;
  const scale = size / obj.h;
  return (
    <span aria-hidden className="relative inline-block shrink-0" style={{ width: obj.w * scale, height: size }}>
      {under}
      <svg viewBox={`0 0 ${obj.w} ${obj.h}`} width={obj.w * scale} height={size} className="block">{obj.draw}</svg>
    </span>
  );
}
