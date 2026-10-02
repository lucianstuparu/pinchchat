import { memo } from 'react';
import { AlertCircle, Check, Clock, FileText } from 'lucide-react';
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
}

export const MessageBubble = memo(function MessageBubble({ msg, onRetry }: Props) {
  const mine = msg.role === 'user';
  const text = visibleText(msg);
  const images = msg.blocks.filter(b => b.type === 'image') as Array<{ type: 'image'; mediaType: string; data?: string; url?: string }>;
  const typing = msg.isStreaming && !text;

  return (
    <div className={`flex px-3 ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[85%] rounded-2xl px-3 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
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
      </div>
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
