/**
 * What a thing looks like (my.design v2/oc-v2-brief.md §8, oc-v2-review.md "Faces"): a real logo, a drawing, or a drawing with
 * the logo on it; never initials (Lucian 2026-11-05). Drawn in the house stroke from the boards; others come from the drawing
 * job as images. Decorative: the caption beside it always says what it is. Keep OBJECTS in step with faces.mjs KNOWN_OBJECTS.
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
  phone: { w: 44, h: 72, badge: { x: 10, y: 22, size: 24 }, draw: <>
    <rect x="4" y="2" width="36" height="68" rx="7" fill={PAPER} {...s} />
    <rect x="9" y="9" width="26" height="46" rx="2" fill="#f2f2f7" />
    <circle cx="22" cy="62" r="2.5" fill={INK} />
  </> },
  letter: { w: 58, h: 70, badge: { x: 7, y: 7, size: 16 }, draw: <>
    <rect x="3" y="2" width="52" height="66" rx="3" fill={PAPER} {...s} />
    <path d="M9 30h40M9 39h40M9 48h26" fill="none" stroke="#d1d1d6" strokeWidth="3" strokeLinecap="round" />
  </> },
  person: { w: 60, h: 70, badge: { x: 36, y: 44, size: 20 }, draw: <>
    <circle cx="30" cy="20" r="16" fill={PAPER} {...s} />
    <path d="M4 68c1-17 12-26 26-26s25 9 26 26z" fill={PAPER} {...s} />
  </> },
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
  calendar: { w: 72, h: 72, badge: { x: 24, y: 32, size: 24 }, draw: <>
    <rect x="4" y="10" width="64" height="58" rx="7" fill={PAPER} {...s} />
    <path d="M4 26h64M22 4v12M50 4v12" fill="none" {...s} />
  </> },
  bag: { w: 64, h: 76, badge: { x: 20, y: 38, size: 24 }, draw: <>
    <path d="M6 24h52l4 48H2z" fill={PAPER} {...s} />
    <path d="M20 32V16a12 12 0 0 1 24 0v16" fill="none" {...s} />
  </> },
  pot: { w: 60, h: 62, badge: { x: 18, y: 32, size: 22 }, draw: <>
    <path d="M8 24h44v12a22 22 0 0 1-44 0z" fill={PAPER} {...s} />
    <path d="M30 4v20M20 12l10 12 10-12" fill="none" stroke="#1f7a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </> },
};

const fileOf = (name: string) => `/reg/faces/${encodeURIComponent(name)}`;

function Logo({ name, size }: { name: string; size: number }) {
  return <img src={fileOf(name)} alt="" draggable={false} loading="lazy" width={size} height={size}
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }} className="block bg-white object-contain" />;
}

/** `size` is the height the face may take. */
export function ObjectFace({ face, size, glow }: { face: Face; size: number; /** The one glow on the screen, under the next thing. */ glow?: boolean }) {
  if (face.mono && !face.logo && !face.drawing && !face.object) {
    return (
      <span aria-hidden className="relative flex shrink-0 items-center justify-center rounded-[22%] bg-[#e9e9ee] font-extrabold leading-none text-[#3a3a3c]"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>{face.mono}</span>
    );
  }
  const obj = OBJECTS[face.object ?? (face.logo || face.drawing ? '' : 'doc')];
  const under = glow ? <span className="absolute left-[10%] h-2 w-4/5 rounded-[50%]" style={{ bottom: -7, background: 'var(--pc-accent-glow)' }} /> : null;
  if (face.drawing) {
    return (
      <span aria-hidden className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {under}
        <img src={fileOf(face.drawing)} alt="" draggable={false} loading="lazy" width={size} height={size} className="block h-full w-full" />
        {face.logo && <span className="absolute bottom-0 left-0"><Logo name={face.logo} size={Math.round(size * 0.4)} /></span>}
      </span>
    );
  }
  if (!obj) return <span aria-hidden className="relative inline-block shrink-0">{face.logo && <Logo name={face.logo} size={size} />}{under}</span>;
  const scale = size / obj.h;
  return (
    <span aria-hidden className="relative inline-block shrink-0" style={{ width: obj.w * scale, height: size }}>
      {under}
      <svg viewBox={`0 0 ${obj.w} ${obj.h}`} width={obj.w * scale} height={size} className="block">{obj.draw}</svg>
      {face.logo && (
        <span className="absolute" style={{ left: obj.badge.x * scale, top: obj.badge.y * scale }}>
          <Logo name={face.logo} size={Math.round(obj.badge.size * scale)} />
        </span>
      )}
    </span>
  );
}
