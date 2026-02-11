import { Menu, Bot, Sparkles } from 'lucide-react';
import type { ConnectionStatus, Session } from '../types';

interface Props {
  status: ConnectionStatus;
  sessionKey: string;
  onToggleSidebar: () => void;
  activeSessionData?: Session;
}

export function Header({ status, sessionKey, onToggleSidebar, activeSessionData }: Props) {
  const sessionLabel = sessionKey.split(':').pop() || sessionKey;

  return (
    <>
    <header className="h-14 border-b border-white/8 bg-[#232329]/90 backdrop-blur-xl flex items-center px-4 gap-3 shrink-0">
      <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-2xl hover:bg-white/5 text-zinc-400 transition-colors">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-zinc-800/40">
          <Bot className="h-4 w-4 text-cyan-200" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300 text-sm tracking-wide">ClawChat</span>
            <Sparkles className="h-3.5 w-3.5 text-cyan-300/60" />
          </div>
          <span className="text-xs text-zinc-500 truncate block">{sessionLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {status === 'connected' ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-zinc-800/30 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-300/80 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
            <span className="text-xs text-zinc-300 hidden sm:inline">Connecté</span>
          </div>
        ) : status === 'connecting' ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-zinc-800/30 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400/80 pulse-dot" />
            <span className="text-xs text-zinc-300 hidden sm:inline">Connexion…</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-zinc-800/30 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400/80" />
            <span className="text-xs text-zinc-300 hidden sm:inline">Déconnecté</span>
          </div>
        )}
      </div>
    </header>
      {(() => {
        const ctx = activeSessionData?.contextTokens;
        const total = activeSessionData?.totalTokens || 0;
        if (!ctx) return null;
        const pct = Math.min(100, (total / ctx) * 100);
        const barColor = pct > 95 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-cyan-400 to-violet-500';
        return (
          <div className="px-4 py-1.5 bg-[#232329]/60 border-b border-white/8 flex items-center gap-3">
            <div className="flex-1 h-[5px] rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-zinc-400 tabular-nums shrink-0 whitespace-nowrap">
              {(total / 1000).toFixed(1)}k / {(ctx / 1000).toFixed(0)}k tokens
            </span>
          </div>
        );
      })()}
    </>
  );
}
