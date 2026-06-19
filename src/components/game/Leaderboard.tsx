"use client";
// ===== Global Leaderboard Terminal =====
import { Header } from "./AvatarCustomizer";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useAuth } from "@/hooks/use-auth";
import { tierInfoForElo } from "@/lib/data/ranks";
import { cn } from "@/lib/utils";

const RANK_MEDAL = ["#d4af37", "#c0c0c0", "#cd7f32"];

export function Leaderboard() {
  const { rows, loading } = useLeaderboard(50);
  const { profile } = useAuth();

  return (
    <section className="panel sharp flex flex-col gap-4 p-5">
      <Header
        index="03"
        title="Global Leaderboard Terminal"
        subtitle="Top 50 · ranked by Elo"
      />

      <div className="grid grid-cols-[40px_1fr_70px_70px_60px] gap-2 border-b border-white/10 pb-2 font-mono-terminal text-[9px] uppercase tracking-[0.15em] text-white/40 sm:grid-cols-[48px_1fr_120px_80px_70px]">
        <span>#</span>
        <span>Attorney</span>
        <span className="hidden sm:inline">Tier</span>
        <span className="sm:hidden">Tier</span>
        <span className="text-right">Elo</span>
        <span className="text-right">Wins</span>
      </div>

      <div className="max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse border border-white/5 bg-white/[0.02]"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center font-mono-terminal text-xs text-white/30">
            No attorneys on the docket yet.
          </div>
        ) : (
          <div className="space-y-0.5">
            {rows.map((p, i) => {
              const tier = tierInfoForElo(p.elo);
              const isMe = profile?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "grid grid-cols-[40px_1fr_70px_70px_60px] items-center gap-2 border px-2 py-1.5 font-mono-terminal text-xs transition sm:grid-cols-[48px_1fr_120px_80px_70px]",
                    isMe
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "border-transparent hover:border-white/15 hover:bg-white/[0.03] text-white/80",
                  )}
                >
                  <span className="flex items-center justify-center">
                    {i < 3 ? (
                      <span
                        className="flex h-5 w-5 items-center justify-center text-[10px] font-bold text-black"
                        style={{ background: RANK_MEDAL[i] }}
                      >
                        {i + 1}
                      </span>
                    ) : (
                      <span className="text-white/40">{i + 1}</span>
                    )}
                  </span>
                  <span className="truncate font-bold">
                    {p.username}
                    {isMe && (
                      <span className="ml-2 text-[8px] uppercase tracking-widest text-gold">
                        ◂ YOU
                      </span>
                    )}
                  </span>
                  <span className="text-white/50">
                    <span className="sm:hidden">{tier.code}</span>
                    <span className="hidden sm:inline">{tier.label}</span>
                  </span>
                  <span className="text-right font-bold text-gold">{p.elo}</span>
                  <span className="text-right text-white/60">{p.wins}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
