import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ImageBlockProps {
  src: string;
  alt?: string;
}

function Lightbox({ src, alt, onClose }: ImageBlockProps & { onClose: () => void }) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 p-2 rounded-full bg-pc-elevated/80 border border-pc-border-strong text-pc-text hover:text-white hover:bg-pc-elevated/80 transition-colors"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt={alt || 'Image'}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function ImageBlock({ src, alt }: ImageBlockProps) {
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      <div className="my-2">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          aria-label={`View ${alt || 'image'} full size`}
          className="block rounded-xl border border-pc-border cursor-pointer hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--pc-accent-dim)]"
        >
          <img
            src={src}
            alt={alt || 'Image'}
            className="max-w-full max-h-80 rounded-xl"
            loading="lazy"
          />
        </button>
      </div>
      {lightbox && <Lightbox src={src} alt={alt} onClose={() => setLightbox(false)} />}
    </>
  );
}

// buildImageSrc moved to ../lib/image.ts
