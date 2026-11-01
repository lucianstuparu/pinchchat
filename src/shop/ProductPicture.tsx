/**
 * A product's picture (2026-11-01): the cut-out the server made from its photo (cutout-worker.mjs),
 * on a plain tile with a soft shadow, so every product sits the same way; the photo itself where the
 * cut-out was refused or is not made yet. In grids a pill on the picture carries the short name
 * (Lucian chose "Pill on image" from a trial of three placements); in list rows the name is beside it.
 */
import { Package } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Product } from './logic';
import { pictureOf } from './photos';

export function ProductPicture({ p, size, label, radius = 12, dim, children }: {
  p?: Product; size?: number; label?: string; radius?: number; dim?: boolean;
  /** Badges in the corners (grid tiles). */
  children?: ReactNode;
}) {
  const pic = pictureOf(p);
  const box = size ? { width: size, height: size } : undefined;
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-pc-surface ${size ? '' : 'aspect-square w-full'} ${dim ? 'opacity-75' : ''}`}
      style={{ ...box, borderRadius: radius }}>
      {pic ? (
        <img src={pic.src} alt="" loading="lazy" draggable={false}
          className={pic.cut ? 'h-full w-full object-contain p-[4%] [filter:drop-shadow(0_3px_4px_rgba(0,0,0,0.18))]' : 'h-full w-full object-cover'} />
      ) : (
        <Package size={(size ?? 96) / 2.6} className="text-pc-text-faint" />
      )}
      {label && (
        <span className="absolute inset-x-1.5 bottom-1.5 flex justify-center">
          <span className="line-clamp-2 max-w-full rounded-[10px] bg-white/90 px-2 py-0.5 text-center text-[12px] font-semibold leading-tight text-pc-text shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-black/65">
            {label}
          </span>
        </span>
      )}
      {children}
    </span>
  );
}
