/**
 * A person's face: their initial on their own colour. A ring in the call green when they wrote and
 * it is not read yet, with the count in the corner.
 */
import { faceColour, type Contact } from './api';

export function Face({ contact, size, ring = false }: { contact: Pick<Contact, 'id' | 'label'> & { unread?: number }; size: number; ring?: boolean }) {
  const unread = contact.unread ?? 0;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
        style={{ background: faceColour(contact.id), fontSize: Math.round(size * 0.42),
          boxShadow: ring && unread ? '0 0 0 3px var(--pc-bg-base), 0 0 0 6px var(--pc-accent)' : undefined }}>
        {contact.label.trim()[0]?.toUpperCase() ?? '?'}
      </span>
      {ring && unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-pc-accent px-1.5 text-[13px] font-bold text-[var(--pc-on-accent)]">{unread}</span>
      )}
    </span>
  );
}
