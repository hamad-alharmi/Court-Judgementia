"use client";
// ===== Connection Indicator — shows realtime sync state =====
// Simple pulse dot indicating the realtime/polling channel is alive.
// Matches the dark terminal aesthetic (emerald = LIVE).
export function ConnectionIndicator({ active = true }: { active?: boolean }) {
  return (
    <span className="flex items-center gap-1.5" title={active ? "Realtime sync active" : "Reconnecting..."}>
      <span
        className={
          active
            ? "h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
            : "h-1.5 w-1.5 rounded-full bg-red-400"
        }
        style={active ? { boxShadow: "0 0 6px rgba(52,211,153,0.7)" } : undefined}
      />
      <span
        className={
          active
            ? "font-mono-terminal text-[8px] uppercase tracking-widest text-emerald-400/70"
            : "font-mono-terminal text-[8px] uppercase tracking-widest text-red-400/70"
        }
      >
        {active ? "LIVE" : "SYNC..."}
      </span>
    </span>
  );
}
