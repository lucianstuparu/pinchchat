/**
 * One tap to change a draft (Lucian 2026-11-04: "iterate on the response, like ask to make it a bit longer, more formal
 * or informal, or concise"). The words go to the agent with the draft; anything else can be said in the box.
 */
const CHANGES = ['Shorter', 'Longer', 'More formal', 'Less formal'];

export function Refine({ onChange, disabled }: { onChange: (change: string) => void; disabled?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {CHANGES.map(c => (
        <button key={c} type="button" disabled={disabled} onClick={() => onChange(c)}
          className="press h-10 rounded-full bg-pc-surface px-3.5 text-[15px] font-medium disabled:opacity-50">{c}</button>
      ))}
    </div>
  );
}
