/**
 * What a thing looks like (my.design v2/oc-v2-brief.md §8, oc-v2-review.md "Faces"): an object and/or a logo, initials on a
 * colour until the shared library has one. Drawn in the house stroke from the boards. Decorative: the caption beside it
 * always says what it is. An object not in the set falls back to the logo or the initials, so a new name never breaks.
 */
import type { ReactNode } from 'react';
import type { Face } from '../app/api';

const INK = 'var(--pc-text-primary)';
const PAPER = 'var(--pc-bg-elevated)';
const s = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Each object: its box, the drawing, and where a logo sits on it. */
const OBJECTS: Record<string, { w: number; h: number; draw: ReactNode; badge: { x: number; y: number; size: number } }> = {
  envelope: { w: 100, h: 70, badge: { x: 8, y: 34, size: 28 }, draw: <>
    <rect x="2" y="2" width="96" height="66" rx="6" fill={PAPER} {...s} />
    <path d="M2 8l48 32 48-32" fill="none" {...s} />
  </> },
  phone: { w: 44, h: 72, badge: { x: 10, y: 24, size: 24 }, draw: <rect x="4" y="2" width="36" height="68" rx="7" fill={PAPER} {...s} /> },
  stack: { w: 80, h: 62, badge: { x: 9, y: 26, size: 22 }, draw: <>
    <rect x="16" y="2" width="60" height="42" rx="4" fill={PAPER} {...s} />
    <rect x="10" y="9" width="60" height="42" rx="4" fill={PAPER} {...s} />
    <rect x="4" y="16" width="60" height="42" rx="4" fill={PAPER} {...s} />
  </> },
  doc: { w: 58, h: 76, badge: { x: 9, y: 8, size: 18 }, draw: <>
    <rect x="3" y="2" width="52" height="72" rx="5" fill={PAPER} {...s} />
    <path d="M11 38h36M11 48h36M11 58h24" fill="none" stroke="var(--pc-text-faint)" strokeWidth="3" strokeLinecap="round" />
  </> },
  folder: { w: 84, h: 62, badge: { x: 12, y: 26, size: 24 }, draw: <path d="M3 12a4 4 0 0 1 4-4h22l8 8h40a4 4 0 0 1 4 4v34a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill={PAPER} {...s} /> },
  door: { w: 50, h: 78, badge: { x: 10, y: 10, size: 18 }, draw: <>
    <rect x="4" y="2" width="42" height="74" rx="3" fill={PAPER} {...s} />
    <circle cx="37" cy="42" r="2.5" fill={INK} />
  </> },
  pot: { w: 60, h: 62, badge: { x: 18, y: 32, size: 22 }, draw: <>
    <path d="M8 24h44v12a22 22 0 0 1-44 0z" fill={PAPER} {...s} />
    <path d="M30 4v20M20 12l10 12 10-12" fill="none" stroke="#1f7a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </> },
};

function Mark({ face, size }: { face: Face; size: number }) {
  const radius = Math.round(size * 0.22);
  if (face.logo) {
    return <img src={`/reg/faces/${encodeURIComponent(face.logo)}`} alt="" draggable={false} loading="lazy" width={size} height={size}
      style={{ width: size, height: size, borderRadius: radius }} className="block bg-white object-contain" />;
  }
  return (
    <span className="flex items-center justify-center font-bold leading-none text-white"
      style={{ width: size, height: size, borderRadius: radius, background: face.color, fontSize: Math.round(size * (face.letters.length > 1 ? 0.4 : 0.5)) }}>
      {face.letters}
    </span>
  );
}

/** `size` is the height the face may take. */
export function ObjectFace({ face, size, glow }: { face: Face; size: number; /** The one glow on the screen, under the next thing. */ glow?: boolean }) {
  const obj = face.object ? OBJECTS[face.object] : undefined;
  const under = glow ? <span className="absolute left-[10%] h-2 w-4/5 rounded-[50%]" style={{ bottom: -7, background: 'var(--pc-accent-glow)' }} /> : null;
  if (!obj) return <span aria-hidden className="relative inline-block shrink-0"><Mark face={face} size={size} />{under}</span>;
  const scale = size / obj.h;
  const hasMark = !!face.logo || !!face.name;
  return (
    <span aria-hidden className="relative inline-block shrink-0" style={{ width: obj.w * scale, height: size }}>
      {under}
      <svg viewBox={`0 0 ${obj.w} ${obj.h}`} width={obj.w * scale} height={size} className="block">{obj.draw}</svg>
      {hasMark && (
        <span className="absolute" style={{ left: obj.badge.x * scale, top: obj.badge.y * scale }}>
          <Mark face={face} size={Math.round(obj.badge.size * scale)} />
        </span>
      )}
    </span>
  );
}
