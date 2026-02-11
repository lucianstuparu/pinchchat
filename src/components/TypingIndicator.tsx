import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="animate-fade-in flex items-start gap-3 px-4 py-3">
      <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/60">
        <Bot className="h-4 w-4 text-cyan-200" />
      </div>
      <div className="rounded-3xl border border-white/10 bg-zinc-900/55 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
        <div className="flex items-center gap-1.5">
          <span className="bounce-dot h-2 w-2 rounded-full bg-gradient-to-r from-cyan-300/80 to-violet-400/80" />
          <span className="bounce-dot h-2 w-2 rounded-full bg-gradient-to-r from-cyan-300/80 to-violet-400/80" />
          <span className="bounce-dot h-2 w-2 rounded-full bg-gradient-to-r from-cyan-300/80 to-violet-400/80" />
          <span className="ml-2 text-xs text-zinc-400">Thinking…</span>
        </div>
      </div>
    </div>
  );
}
