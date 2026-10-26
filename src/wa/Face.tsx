/**
 * A person's face: their photo when one was added (Profile), otherwise their initial on their own colour.
 * A ring in the call green when they wrote and it is not read yet, with the count in the corner.
 * The photos come from Relay's top (FacePhotos), so every face on every screen shows the same one.
 */
import { useContext } from 'react';
import { faceColour, type Contact } from './api';
import { FacePhotos } from './photos';

export function Face({ contact, size, ring = false, photo }: {
  contact: Pick<Contact, 'id' | 'label'> & { unread?: number }; size: number; ring?: boolean;
  /** A picture to show instead of the kept one (the profile, before Save); null shows the initial. */
  photo?: string | null;
}) {
  const photos = useContext(FacePhotos);
  const src = photo === undefined ? photos[contact.id]?.data : photo;
  const unread = contact.unread ?? 0;
  const glow = ring && unread ? '0 0 0 3px var(--pc-bg-base), 0 0 0 6px var(--pc-accent)' : undefined;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      {src ? (
        <img src={src} alt="" draggable={false} className="h-full w-full rounded-full object-cover" style={{ boxShadow: glow }} />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: faceColour(contact.id), fontSize: Math.round(size * 0.42), boxShadow: glow }}>
          {contact.label.trim()[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      {ring && unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-pc-accent px-1.5 text-[13px] font-bold text-[var(--pc-on-accent)]">{unread}</span>
      )}
    </span>
  );
}
