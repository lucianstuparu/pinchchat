import { MessageSquare, X, Sparkles } from 'lucide-react';
import type { Session } from '../types';

interface Props {
  sessions: Session[];
  activeSession: string;
  onSwitch: (key: string) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ sessions, activeSession, onSwitch, open, onClose }: Props) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:relative top-0 left-0 h-full w-72 bg-[#1e1e24]/95 border-r border-white/8 z-50 transform transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} flex flex-col backdrop-blur-xl`}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-r from-cyan-400/15 to-violet-500/15 blur-lg" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 bg-zinc-800/50">
                <Sparkles className="h-4 w-4 text-cyan-200" />
              </div>
            </div>
            <span className="font-semibold text-sm text-zinc-200 tracking-wide">Sessions</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {sessions.length === 0 && (
            <div className="px-3 py-8 text-center text-zinc-500 text-sm">Aucune session</div>
          )}
          {sessions.map(s => {
            const isActive = s.key === activeSession;
            return (
              <button
                key={s.key}
                onClick={() => { onSwitch(s.key); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left text-sm transition-all mb-1 ${
                  isActive
                    ? 'bg-white/5 text-cyan-200 border border-white/8 shadow-[0_0_12px_rgba(34,211,238,0.08)]'
                    : s.isActive
                      ? 'bg-violet-500/5 text-violet-200 border border-violet-500/15 shadow-[0_0_10px_rgba(168,85,247,0.06)]'
                      : 'text-zinc-400 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="relative">
                  <MessageSquare size={15} className={isActive ? 'text-cyan-300/70' : s.isActive ? 'text-violet-400/70' : ''} />
                  {s.isActive && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(168,85,247,0.7)] animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="flex-1 truncate">{s.label || s.key}</span>
                    {s.messageCount != null && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${isActive ? 'bg-cyan-400/10 text-cyan-300' : 'bg-white/5 text-zinc-500'}`}>
                        {s.messageCount}
                      </span>
                    )}
                  </div>
                  {(() => {
                    if (!s.contextTokens) return null;
                    const pct = Math.min(100, ((s.totalTokens || 0) / s.contextTokens) * 100);
                    const barColor = pct > 95 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-cyan-400 to-violet-500';
                    return (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-[3px] rounded-full bg-white/5 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-zinc-500 tabular-nums shrink-0">{Math.round(pct)}%</span>
                      </div>
                    );
                  })()}
                </div>
              </button>
            );
          })}
        </div>
        {/* Footer glow dots */}
        <div className="px-4 py-3 border-t border-white/8 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300/60 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/60 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-300/50 shadow-[0_0_10px_rgba(99,102,241,0.4)]" />
        </div>
      </aside>
    </>
  );
}
