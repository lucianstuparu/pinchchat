import { memo, useRef, useState } from 'react';
import { AlertCircle, Check, Clock, Copy, FileText, Reply, User } from 'lucide-react';
import type { Components } from 'react-markdown';
import type { ChatMessage } from '../types';
import { LazyMarkdown } from '../components/LazyMarkdown';
import { buildImageSrc } from '../lib/image';
import { formatTime, visibleText } from './messageView';

const mdComponents: Components = {
  a: ({ node, ...props }) => {
    void node;
    return <a {...props} target="_blank" rel="noreferrer noopener" />;
  },
};

const MD_CLASSES =
  'break-words [&_p]:my-1 first:[&_p]:mt-0 last:[&_p]:mb-0 [&_a]:text-pc-accent [&_a]:underline ' +
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 ' +
  '[&_pre]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:bg-pc-code [&_pre]:text-[13px] ' +
  '[&_code]:text-[13px] [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-[var(--pc-hover-strong)] ' +
  '[&_table]:block [&_table]:overflow-x-auto [&_th]:px-2 [&_td]:px-2 [&_blockquote]:border-l-2 [&_blockquote]:border-pc-border-strong [&_blockquote]:pl-2 [&_blockquote]:text-pc-text-muted ' +
  '[&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold';

interface Props {
  msg: ChatMessage;
  onRetry?: (msg: ChatMessage) => void;
  /** Enables swipe-right and long-press → Reply (WhatsApp-style). */
  onReply?: (msg: ChatMessage) => void;
  /** First message of a run shows the sender's avatar; the rest keep its space. */
  showAvatar?: boolean;
}

function Avatar({ mine, visible }: { mine: boolean; visible: boolean }) {
  if (!visible) return <span className="w-7 shrink-0" aria-hidden />;
  return mine ? (
    <span className="mt-0.5 h-7 w-7 shrink-0 self-start rounded-full bg-pc-accent text-white flex items-center justify-center shadow-sm" aria-label="You">
      <User size={16} />
    </span>
  ) : (
    <img src="/logo-192.png" alt="OpenClaw" className="mt-0.5 h-7 w-7 shrink-0 self-start rounded-full shadow-sm" />
  );
}

const SWIPE_MAX = 72;
const SWIPE_TRIGGER = 56;
const LONG_PRESS_MS = 450;

export const MessageBubble = memo(function MessageBubble({ msg, onRetry, onReply, showAvatar = true }: Props) {
  const mine = msg.role === 'user';
  const text = visibleText(msg);
  const images = msg.blocks.filter(b => b.type === 'image') as Array<{ type: 'image'; mediaType: string; data?: string; url?: string }>;
  const typing = msg.isStreaming && !text;
  const canReply = !!onReply && !msg.isStreaming && (text.length > 0 || images.length > 0);

  const [dx, setDx] = useState(0);
  const [menu, setMenu] = useState(false);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null; timer: number | null; armed: boolean } | null>(null);

  const clearTimer = () => {
    if (touch.current?.timer) window.clearTimeout(touch.current.timer);
    if (touch.current) touch.current.timer = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!canReply) return;
    const t = e.touches[0];
    touch.current = {
      x: t.clientX, y: t.clientY, horizontal: null, armed: false,
      timer: window.setTimeout(() => { setMenu(true); navigator.vibrate?.(10); }, LONG_PRESS_MS),
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const mx = t.clientX - s.x;
    const my = t.clientY - s.y;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) clearTimer();
    if (s.horizontal === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) s.horizontal = Math.abs(mx) > Math.abs(my) && mx > 0;
    if (!s.horizontal) return;
    const next = Math.max(0, Math.min(SWIPE_MAX, mx));
    if (next >= SWIPE_TRIGGER && !s.armed) { s.armed = true; navigator.vibrate?.(10); }
    if (next < SWIPE_TRIGGER) s.armed = false;
    setDx(next);
  };

  const onTouchEnd = () => {
    const s = touch.current;
    clearTimer();
    touch.current = null;
    if (s?.armed) onReply?.(msg);
    setDx(0);
  };

  const copy = () => {
    setMenu(false);
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  return (
    <div className={`relative flex gap-1.5 px-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && <Avatar mine={false} visible={showAvatar} />}
      {dx > 0 && (
        <span
          className="absolute left-2 z-[1] top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-pc-surface shadow flex items-center justify-center text-pc-text-muted"
          style={{ opacity: dx / SWIPE_TRIGGER }}
          aria-hidden
        >
          <Reply size={16} />
        </span>
      )}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onContextMenu={canReply ? e => { e.preventDefault(); setMenu(true); } : undefined}
        // pan-y: the browser keeps vertical scrolling but leaves sideways drags to the swipe-to-reply
        // handler; without it Chrome on Android claims the gesture and the swipe never arrives.
        style={{ ...(canReply ? { touchAction: 'pan-y' } : {}), ...(dx ? { transform: `translateX(${dx}px)` } : {}) }}
        className={`relative max-w-[80%] rounded-2xl px-3 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${dx ? '' : 'transition-transform'} ${
          canReply ? 'select-none [-webkit-touch-callout:none]' : ''
        } ${
          mine
            ? 'rounded-tr-md bg-[rgba(var(--pc-accent-rgb),0.18)] text-pc-text'
            : 'rounded-tl-md bg-pc-surface text-pc-text'
        }`}
      >
        {images.map((img, i) => (
          <img
            key={i}
            src={buildImageSrc(img.mediaType, img.data, img.url)}
            alt=""
            className="my-1 max-h-72 w-auto rounded-xl object-contain"
            loading="lazy"
          />
        ))}

        {typing ? (
          <span className="flex gap-1 py-2" aria-label="OpenClaw is typing">
            {[0, 1, 2].map(i => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-pc-text-muted animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        ) : text ? (
          <div className={`text-[15px] leading-snug ${MD_CLASSES}`}>
            <LazyMarkdown components={mdComponents}>{text}</LazyMarkdown>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5 text-[11px] text-pc-text-muted select-none">
          <span>{formatTime(msg.timestamp)}</span>
          {mine && msg.sendStatus === 'sending' && <Clock size={11} aria-label="sending" />}
          {mine && (msg.sendStatus === 'sent' || msg.sendStatus === undefined) && <Check size={12} aria-label="sent" />}
          {mine && msg.sendStatus === 'error' && (
            <button type="button" onClick={() => onRetry?.(msg)} className="inline-flex items-center gap-0.5 text-red-500" aria-label="Not sent — tap to retry">
              <AlertCircle size={12} /> Retry
            </button>
          )}
        </div>

        {menu && (
          <div
            role="menu"
            className={`absolute top-full z-20 mt-1 w-36 rounded-xl border border-pc-border bg-pc-elevated shadow-lg py-1 text-[15px] ${mine ? 'right-0' : 'left-0'}`}
          >
            <button type="button" role="menuitem" className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={() => { setMenu(false); onReply?.(msg); }}>
              <Reply size={16} /> Reply
            </button>
            {text && (
              <button type="button" role="menuitem" className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={copy}>
                <Copy size={16} /> Copy
              </button>
            )}
          </div>
        )}
      </div>
      {mine && <Avatar mine visible={showAvatar} />}
      {menu && <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />}
    </div>
  );
});

/** Small chip for a pending (not yet sent) attachment in the composer. */
export function AttachmentChip({ name, mimeType, preview, onRemove }: { name: string; mimeType: string; preview?: string; onRemove: () => void }) {
  return (
    <div className="relative flex items-center gap-2 rounded-xl bg-pc-surface border border-pc-border pl-1.5 pr-7 py-1.5 max-w-[14rem]">
      {preview && mimeType.startsWith('image/') ? (
        <img src={preview} alt="" className="h-9 w-9 rounded-lg object-cover" />
      ) : (
        <span className="h-9 w-9 rounded-lg bg-pc-input flex items-center justify-center text-pc-text-muted"><FileText size={18} /></span>
      )}
      <span className="truncate text-xs text-pc-text">{name}</span>
      <button type="button" onClick={onRemove} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full h-5 w-5 text-pc-text-muted hover:bg-[var(--pc-hover-strong)]" aria-label={`Remove ${name}`}>
        ×
      </button>
    </div>
  );
}
