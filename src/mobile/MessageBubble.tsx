import { L } from '../ui/lang';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, Check, CheckSquare, ChevronDown, Clock, Copy, FileText, Mic, Reply, TextSelect, Volume2 } from 'lucide-react';
import { markCopyables } from './copyables';
import { AgentAvatar, MeAvatar, PersonAvatar } from '../app/avatars';
import { getUiMode } from './uiMode';
import { parseClaudeNote, type ClaudeNote } from '../app/todayRules';
import type { Components } from 'react-markdown';
import type { ChatMessage } from '../types';
import { LazyMarkdown } from '../components/LazyMarkdown';
import { buildImageSrc } from '../lib/image';
import { formatTime, senderOf, visibleText } from './messageView';
import { extractItems } from './messageItems';
import { ItemActions } from './ItemActions';
import { failedTurn, isLong, voiceMessage } from './notice';
import { canSpeak, speak } from '../ui/speak';

/** A small copy button after a value (a link, a number, an email); a tick for a moment once copied. */
function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1500);
    return () => window.clearTimeout(t);
  }, [done]);
  return (
    <button type="button" aria-label={done ? L('Copied') : L('Copy {value}', { value })}
      // its own tap: no long-press menu, no unfolding, no swipe
      onTouchStart={e => e.stopPropagation()} onContextMenu={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); void navigator.clipboard?.writeText(value).then(() => setDone(true)).catch(() => undefined); }}
      className={`relative inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] align-[-5px] text-pc-text-muted select-none before:absolute before:-inset-[9px] before:content-[''] active:bg-[var(--pc-hover-strong)] ${className}`}>
      {done ? <Check size={14} strokeWidth={2.5} className="text-pc-accent" /> : <Copy size={14} />}
    </button>
  );
}

const textOf = (n: ReactNode): string =>
  typeof n === 'string' || typeof n === 'number' ? String(n)
    : Array.isArray(n) ? n.map(textOf).join('')
    : n && typeof n === 'object' && 'props' in n ? textOf((n.props as { children?: ReactNode }).children) : '';

const mdComponents: Components = {
  a: ({ node, children, ...props }) => {
    void node;
    const href = props.href ?? '';
    return <><a {...props} target="_blank" rel="noreferrer noopener">{children}</a>{href && <CopyButton value={href.replace(/^mailto:|^tel:/, '')} className="ml-0.5" />}</>;
  },
  // Inline code is what can be copied: the agents write addresses, references and numbers that way,
  // and markCopyables() turns the ones it recognises into it.
  code: ({ node, className, children, ...props }) => {
    void node;
    const value = textOf(children);
    if (className || value.includes('\n')) return <code className={className} {...props}>{children}</code>;
    return <span className="whitespace-nowrap"><code {...props}>{children}</code><CopyButton value={value} className="ml-0.5" /></span>;
  },
  pre: ({ node, children, ...props }) => {
    void node;
    return <div className="relative"><pre {...props}>{children}</pre><CopyButton value={textOf(children).replace(/\n$/, '')} className="absolute right-1 top-1 bg-pc-code" /></div>;
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
  /** Enables swipe-left and long-press → Reply (Telegram-style; swipe right opens To do). */
  onReply?: (msg: ChatMessage) => void;
  /** First message of a run shows the sender's avatar; the rest keep its space. */
  showAvatar?: boolean;
  /** How to show the items a message names (default: cards with Done / Snooze). */
  renderItems?: (items: Array<{ id: string; label: string }>, ctx?: { ts: number; msgId: string; onCards: () => void }) => ReactNode;
  /** oc v2: a note from another session, as a card. */
  renderNote?: (note: ClaudeNote, itemId?: string) => ReactNode;
  /** Multi-select (copy several messages): enter it from the long-press menu, tap to toggle. */
  selecting?: boolean;
  selected?: boolean;
  onSelect?: (msg: ChatMessage) => void;
  /**
   * A chat shared by several people (Casa Artlia): messages start with "[Name] ". `me` is the
   * signed-in person's name; others' messages show on the left with their name and initial.
   */
  me?: string;
  /** The chat is shared: user messages carry "[Name] ", taken off the text. */
  shared?: boolean;
}


/** A failed turn: one line with the cause; the gateway's full text a tap away. */
function FailedTurn({ summary, detail, time, showAvatar }: { summary: string; detail: string; time: string; showAvatar: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-1.5 px-2 justify-start">
      <Avatar mine={false} visible={showAvatar} />
      <div className="min-w-0 max-w-[80%]">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="press inline-flex min-h-10 max-w-full items-center gap-2 rounded-[12px] border border-pc-border bg-pc-surface px-3 text-left text-[15px] text-pc-text">
          <AlertCircle size={16} className="shrink-0 text-red-500" aria-hidden />
          <span className="min-w-0 truncate">{summary}</span>
          <span className="shrink-0 text-[12px] text-pc-text-muted">{time}</span>
          <ChevronDown size={16} className={`shrink-0 text-pc-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open && <p className="mt-1 px-1 text-[13px] leading-snug text-pc-text-muted break-words select-text">{detail}</p>}
      </div>
    </div>
  );
}

function Avatar({ mine, visible, person, me, thinking }: { mine: boolean; visible: boolean; person?: string | null; me?: string; thinking?: boolean }) {
  if (!visible) return <span className={`${V2 ? 'w-6' : 'w-7'} shrink-0`} aria-hidden />;
  return <span className="mt-0.5 shrink-0 self-start">{mine ? <MeAvatar name={me} /> : person ? <PersonAvatar name={person} /> : <AgentAvatar thinking={thinking} />}</span>;
}

const V2 = getUiMode() === 'v2';
const SWIPE_MAX = 72;
const SWIPE_TRIGGER = 56;
const LONG_PRESS_MS = 450;

export const MessageBubble = memo(function MessageBubble({ msg, onRetry, onReply, showAvatar = true, renderItems, renderNote, selecting, selected, onSelect, me, shared }: Props) {
  const sender = msg.role === 'user' && shared ? senderOf(visibleText(msg)) : null;
  const other = sender?.name && me && sender.name !== me ? sender.name : null;   // someone else in a shared chat
  const mine = msg.role === 'user' && !other;
  // Agent messages may name register items (⟨adm-…⟩ markers): hide the markers, add Done / Snooze rows.
  // Item markers (⟨id⟩) never show as text, in anyone's message: they become the item's card.
  const { text: raw, items } = extractItems(msg.role === 'user' && sender ? sender.text : visibleText(msg));
  // A voice message shows the words said (Whisper, before sending), after a mic.
  const voiceNote = msg.role === 'user' ? voiceMessage(raw) : null;
  const text = voiceNote ? voiceNote.said : raw;
  const images = msg.blocks.filter(b => b.type === 'image') as Array<{ type: 'image'; mediaType: string; data?: string; url?: string }>;
  const typing = msg.isStreaming && !text;
  const canReply = !!onReply && !msg.isStreaming && (text.length > 0 || images.length > 0);

  // oc v2: a reply that became change cards (app/ChangeCards) drops its prose.
  const [cardsOnly, setCardsOnly] = useState(false);
  const [dx, setDx] = useState(0);
  const [menu, setMenu] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  // "Select text" (the long-press menu, on the phone): the bubble lets the browser select until a tap
  // elsewhere. With a mouse, text is always selectable.
  const [selectable, setSelectable] = useState(false);
  const bubble = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectable) return;
    const away = (e: PointerEvent) => { if (!bubble.current?.contains(e.target as Node)) setSelectable(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [selectable]);
  const selectText = () => {
    setMenu(false); setUnfolded(true); setSelectable(true);
    window.setTimeout(() => {
      const el = bubble.current?.querySelector('[data-text]');
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }, 50);
  };
  const touchMenu = canReply && !selectable;
  const failed = !mine && !msg.isStreaming ? failedTurn(text) : null;
  const long = isLong(text);
  const folded = long && !unfolded;
  // A long-press (menu) or a swipe (reply) is not a tap that opens a folded message.
  const noTap = useRef(false);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null; timer: number | null; armed: boolean } | null>(null);

  const clearTimer = () => {
    if (touch.current?.timer) window.clearTimeout(touch.current.timer);
    if (touch.current) touch.current.timer = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!touchMenu) return;
    const t = e.touches[0];
    noTap.current = false;
    touch.current = {
      x: t.clientX, y: t.clientY, horizontal: null, armed: false,
      timer: window.setTimeout(() => { noTap.current = true; setMenu(true); navigator.vibrate?.(10); }, LONG_PRESS_MS),
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const mx = t.clientX - s.x;
    const my = t.clientY - s.y;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) { clearTimer(); noTap.current = true; }
    if (s.horizontal === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) s.horizontal = Math.abs(mx) > Math.abs(my) && mx < 0;
    if (!s.horizontal) return;
    const next = Math.max(0, Math.min(SWIPE_MAX, -mx));
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

  if (failed && !selecting) return <FailedTurn {...failed} time={formatTime(msg.timestamp)} showAvatar={showAvatar} />;
  // oc v2: thinking is the coach's mark breathing, with no empty bubble under it.
  if (V2 && typing) return <div className="flex gap-1.5 px-2 py-1"><Avatar mine={false} visible person={other} thinking /></div>;
  const claudeNote = V2 && renderNote && !mine ? parseClaudeNote(text) : null;
  if (claudeNote) return <div className="flex gap-1.5 px-2"><Avatar mine={false} visible={showAvatar} />{renderNote?.(claudeNote, items[0]?.id)}</div>;

  return (
    <div className={`relative flex gap-1.5 px-2 ${mine ? 'justify-end' : 'justify-start'} ${selecting ? 'cursor-pointer' : ''} ${selected ? 'bg-[rgba(var(--pc-accent-rgb),0.12)] rounded-[20px]' : ''}`}
      onClick={selecting ? () => onSelect?.(msg) : undefined}>
      {selecting && (
        <span className={`self-center ${selected ? 'text-pc-accent' : 'text-pc-text-faint'}`} aria-label={selected ? 'selected' : 'not selected'}>
          <CheckSquare size={18} />
        </span>
      )}
      {!mine && <Avatar mine={false} visible={showAvatar} person={other} />}
      {dx > 0 && (
        <span
          className="absolute right-2 z-[1] top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-pc-surface shadow flex items-center justify-center text-pc-text-muted"
          style={{ opacity: dx / SWIPE_TRIGGER }}
          aria-hidden
        >
          <Reply size={16} />
        </span>
      )}
      <div
        ref={bubble}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        // Right-click with text selected keeps the browser's own menu (Copy); otherwise ours.
        onContextMenu={touchMenu ? e => { if (window.getSelection()?.toString()) return; e.preventDefault(); setMenu(true); } : undefined}
        onClick={folded && !selecting ? () => { if (!noTap.current) setUnfolded(true); } : undefined}
        // pan-y: the browser keeps vertical scrolling but leaves sideways drags to the swipe-to-reply
        // handler; without it Chrome on Android claims the gesture and the swipe never arrives.
        style={{ ...(canReply ? { touchAction: 'pan-y' } : {}), ...(dx ? { transform: `translateX(${-dx}px)` } : {}) }}
        className={`relative ${folded ? 'cursor-pointer' : ''} ${items.length > 0 ? 'min-w-0 flex-1' : 'max-w-[80%]'} rounded-[20px] px-3 pt-1.5 pb-1 shadow-none ${dx ? '' : 'transition-transform'} ${
          touchMenu ? '[@media(pointer:coarse)]:select-none [@media(pointer:coarse)]:[-webkit-touch-callout:none]' : ''
        } ${
          mine
            ? `rounded-tr-md ${V2 ? 'bg-[#f1f0f3] text-[#1c1c1e]' : 'bg-[var(--pc-mine,rgba(var(--pc-accent-rgb),0.18))] text-pc-text'}`
            : `rounded-tl-md ${V2 ? 'bg-[var(--pc-accent-tint)] text-[#1c1c1e]' : 'bg-pc-surface text-pc-text'}`
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

        {other && showAvatar && <p className="text-[12px] font-semibold text-[var(--pc-accent-ink)]">{other}</p>}
        {typing ? (
          <span className="flex gap-1 py-2" aria-label={L('OpenClaw is typing')}>
            {[0, 1, 2].map(i => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-pc-text-muted animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        ) : voiceNote && !text ? (
          <p className="flex items-center gap-1.5 py-0.5 text-[16px] text-pc-text-muted"><Mic size={16} className="shrink-0 text-[var(--pc-accent-ink)]" aria-hidden /> {L('Voice message')}</p>
        ) : text && !(cardsOnly && !long) ? (
          <>
            {/* Long messages start folded at about eight lines; the rest is a tap away. */}
            {voiceNote && <Mic size={15} className="float-left mr-1.5 mt-[3px] text-[var(--pc-accent-ink)]" aria-label={L('Voice message')} />}
            <div data-text className={`text-[16px] leading-[22px] ${MD_CLASSES} ${folded ? 'max-h-[176px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]' : ''}`}>
              <LazyMarkdown components={mdComponents}>{mine ? text : markCopyables(text)}</LazyMarkdown>
            </div>
            {long && (
              <button type="button" onClick={e => { e.stopPropagation(); setUnfolded(u => !u); }} aria-expanded={!folded}
                className="press -ml-1 min-h-10 px-1 text-[15px] font-semibold text-pc-accent">
                {folded ? L('Show all') : L('Show less')}
              </button>
            )}
          </>
        ) : null}
        {!typing && !msg.isStreaming && items.length > 0 && (renderItems ? renderItems(items, { ts: msg.timestamp, msgId: msg.id, onCards: () => setCardsOnly(true) }) : <ItemActions items={items} />)}

        <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5 text-[12px] text-pc-text-muted select-none">
          <span>{formatTime(msg.timestamp)}</span>
          {mine && msg.sendStatus === 'sending' && <Clock size={11} aria-label={L('sending')} />}
          {mine && (msg.sendStatus === 'sent' || msg.sendStatus === undefined) && <Check size={12} aria-label={L('sent')} />}
          {mine && msg.sendStatus === 'error' && (
            <button type="button" onClick={() => onRetry?.(msg)} className="inline-flex items-center gap-0.5 text-red-500" aria-label={L('Not sent — tap to retry')}>
              <AlertCircle size={12} /> {L('Retry')}
            </button>
          )}
        </div>

        {menu && (
          <div
            role="menu"
            className={`absolute top-full z-20 mt-1 w-36 rounded-xl border border-pc-border bg-pc-elevated shadow-lg py-1 text-[15px] ${mine ? 'right-0' : 'left-0'}`}
          >
            <button type="button" role="menuitem" className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={() => { setMenu(false); onReply?.(msg); }}>
              <Reply size={16} /> {L('Reply')}
            </button>
            {text && (
              <button type="button" role="menuitem" className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={copy}>
                <Copy size={16} /> {L('Copy')}
              </button>
            )}
            {text && (
              <button type="button" role="menuitem" className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={selectText}>
                <TextSelect size={16} /> {L('Select text')}
              </button>
            )}
            {text && canSpeak() && (
              <button type="button" role="menuitem" className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={() => { setMenu(false); speak([text], 'ro'); }}>
                <Volume2 size={16} /> {L('Read aloud')}
              </button>
            )}
            {onSelect && (
              <button type="button" role="menuitem" className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--pc-hover)]" onClick={() => { setMenu(false); onSelect(msg); }}>
                <CheckSquare size={16} /> {L('Select')}
              </button>
            )}
          </div>
        )}
      </div>
      {mine && <Avatar mine visible={showAvatar} me={me} />}
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
      <span className="truncate text-[12px] text-pc-text">{name}</span>
      <button type="button" onClick={onRemove} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full h-5 w-5 text-pc-text-muted hover:bg-[var(--pc-hover-strong)]" aria-label={L('Remove {name}', { name })}>
        ×
      </button>
    </div>
  );
}
