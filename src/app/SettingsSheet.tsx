import { useState, type ReactNode } from 'react';
import { CloseButton, Sheet } from '../ui/Sheet';
import { Segmented as SharedSegmented } from '../ui/Controls';
import { Bell, Check, ChevronRight, Languages, LogOut, Mail, MessageCircle, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { DICTATION_LANGS, getDictationLang, getSpeechMode, setDictationLang, setSpeechMode, type SpeechMode } from './voice';
import { ACCENTS, type Accent, type Appearance, type Look } from './themes';
import type { PushState } from '../mobile/pushNotifications';

/** Settings, iOS style: grouped rows, switches and segmented controls. Opened from the avatar. */
interface Props {
  person: string | null;
  mode: 'light' | 'dark';
  look: Look;
  onLook: (l: Look) => void;
  /** Omit both to hide the notifications row (an app without push). */
  push?: PushState | 'busy';
  onTogglePush?: () => void;
  /** Omit to hide "Other views" (an app without them). */
  onView?: (v: 'mobile' | 'full') => void;
  /** Hide the colour choice (an app with a fixed colour, e.g. Shopping in Keep yellow). */
  fixedAccent?: boolean;
  /** Omit to hide "Mail rules" (an app without them). */
  onRules?: () => void;
  /** Extra groups between Appearance and Sign out. */
  children?: ReactNode;
  onLogout: () => void;
  onClose: () => void;
}

const Group = ({ title, children, foot }: { title?: string; children: ReactNode; foot?: string }) => (
  <section className="mb-6">
    {title && <h3 className="mb-1.5 px-4 text-[13px] text-pc-text-muted">{title}</h3>}
    <div className="divide-y divide-[var(--pc-separator)] overflow-hidden rounded-[12px] bg-pc-elevated">{children}</div>
    {foot && <p className="mt-1.5 px-4 text-[12px] leading-snug text-pc-text-muted">{foot}</p>}
  </section>
);
const Icon = ({ children, bg }: { children: ReactNode; bg: string }) => (
  <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[8px] text-white" style={{ background: bg }}>{children}</span>
);
function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string, ReactNode?]>; onChange: (v: T) => void; label?: string }) {
  return <SharedSegmented size="s" choice label={label} value={value} onChange={onChange} options={options.map(([v, labelText, icon]) => ({ value: v, label: labelText, icon }))} />;
}

export function SettingsSheet({ person, mode, look, onLook, push, onTogglePush, onRules, onView, onLogout, onClose, children, fixedAccent }: Props) {
  const [speech, setSpeech] = useState<SpeechMode>(getSpeechMode);
  const [lang, setLang] = useState(getDictationLang);
  const name = person ? person[0].toUpperCase() + person.slice(1) : 'You';
  const pushOn = push === 'on';
  return (
    <Sheet label="Settings" onClose={onClose} className={`max-h-[92dvh] overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 md:max-w-md ${mode === 'dark' ? 'bg-[#000]' : 'bg-[#f2f2f7]'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[22px] font-bold">Settings</h2>
          <CloseButton onClick={onClose} />
        </div>

        <Group>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pc-accent text-[20px] font-semibold text-[var(--pc-on-accent,#fff)]">{name[0]}</span>
            <div className="min-w-0">
              <p className="text-[17px] font-semibold">{name}</p>
              <p className="text-[13px] text-pc-text-muted">{person ? 'Signed in' : 'Not signed in'}</p>
            </div>
          </div>
        </Group>

        {push && onTogglePush && push !== 'unsupported' && (
          <Group foot={push === 'blocked' ? 'Blocked in Chrome. Allow notifications for this app in Chrome’s site settings.' : fixedAccent ? 'When you arrive at a shop: what to get there. Needs the Home Assistant app with location on.' : 'Reminders and answers that arrive while the app is closed.'}>
            <button type="button" onClick={onTogglePush} disabled={push === 'blocked' || push === 'busy'} className="flex w-full items-center gap-3 px-4 py-2.5 text-left disabled:opacity-60" role="switch" aria-checked={pushOn}>
              <Icon bg="#ff3b30"><Bell size={16} /></Icon>
              <span className="flex-1 text-[16px]">Notifications</span>
              <span className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${pushOn ? 'bg-[#34c759]' : 'bg-pc-text-faint/40'}`}>
                <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-[left] ${pushOn ? 'left-[22px]' : 'left-[2px]'}`} />
              </span>
            </button>
          </Group>
        )}

        {onRules && <Group foot="Mail you are waiting for: a notification or a task when it arrives.">
          <button type="button" onClick={onRules} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
            <Icon bg="#007aff"><Mail size={16} /></Icon>
            <span className="flex-1 text-[16px]">Mail rules</span>
            <ChevronRight size={17} className="text-pc-text-faint" />
          </button>
        </Group>}

        <Group title="Appearance">
          <div className="space-y-3 px-4 py-3">
            <Segmented<Appearance> label="Appearance" value={look.appearance} onChange={a => onLook({ ...look, appearance: a })}
              options={[['auto', 'Auto', <Monitor key="a" size={14} />], ['light', 'Light', <Sun key="l" size={14} />], ['dark', 'Dark', <Moon key="d" size={14} />]]} />
          </div>
          {!fixedAccent && <div className="flex items-center gap-3 px-4 py-3">
            <Icon bg="#af52de"><Palette size={16} /></Icon>
            <span className="flex-1 text-[16px]">Colour</span>
            <div className="flex gap-2.5" role="radiogroup" aria-label="Accent colour">
              {(Object.keys(ACCENTS) as Accent[]).filter(a => a !== 'keep' && a !== 'signal').map(a => (
                <button key={a} type="button" role="radio" aria-checked={look.accent === a} aria-label={ACCENTS[a].name} onClick={() => onLook({ ...look, accent: a })}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-[var(--pc-bg-elevated)] transition"
                  style={{ background: mode === 'dark' ? ACCENTS[a].dark : ACCENTS[a].light, boxShadow: look.accent === a ? `0 0 0 2px var(--pc-bg-elevated), 0 0 0 4px ${mode === 'dark' ? ACCENTS[a].dark : ACCENTS[a].light}` : undefined }}>
                  {look.accent === a && <Check size={15} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>}
        </Group>

        <Group title="The mic" foot={speech === 'live'
          ? 'Live: the text appears while you speak, in one language (below). Mixed languages come out wrong.'
          : 'Whisper (home server): any language, mixed too. The text comes when you stop, after 10–20 s.'}>
          <div className="space-y-3 px-4 py-3">
            <Segmented<SpeechMode> label="The mic" value={speech} onChange={m => { setSpeech(m); setSpeechMode(m); }}
              options={[['live', 'Live'], ['whisper', 'Whisper']]} />
            {speech === 'live' && (
              <div className="flex items-center gap-3">
                <Icon bg="#007aff"><Languages size={16} /></Icon>
                <div className="flex-1">
                  <Segmented label="Live language" value={lang} onChange={c => { setLang(c); setDictationLang(c); }}
                    options={DICTATION_LANGS.map(l => [l.code, l.name] as [string, string])} />
                </div>
              </div>
            )}
          </div>
        </Group>

        {children}

        {onView && <Group title="Other views">
          <button type="button" onClick={() => onView('mobile')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
            <Icon bg="#8e8e93"><MessageCircle size={16} /></Icon>
            <span className="flex-1 text-[16px]">Classic messenger</span>
            <ChevronRight size={17} className="text-pc-text-faint" />
          </button>
          <button type="button" onClick={() => onView('full')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
            <Icon bg="#8e8e93"><Monitor size={16} /></Icon>
            <span className="flex-1 text-[16px]">Full PinchChat (advanced)</span>
            <ChevronRight size={17} className="text-pc-text-faint" />
          </button>
        </Group>}

        <Group>
          <button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[16px] text-red-500">
            <LogOut size={17} /> Sign out
          </button>
        </Group>
    </Sheet>
  );
}
