"use client";
// ===== Global Leaderboard Terminal =====
import { motion } from "framer-motion";
import { Header } from "./AvatarCustomizer";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useAuth } from "@/hooks/use-auth";
import { tierInfoForElo, RANK_TIERS } from "@/lib/data/ranks";
import { cn } from "@/lib/utils";
import { Crown, Medal, Award } from "lucide-react";
import type { RankTierInfo } from "@/lib/data/ranks";

const RANK_MEDAL = ["#d4af37", "#c0c0c0", "#cd7f32"];
const RANK_MEDAL_LABEL = ["GOLD", "SILVER", "BRONZE"];

// Tier color coding for badges
function tierColor(tier: RankTierInfo): { fg: string; bg: string; border: string } {
  const code = tier.code;
  if (code === "CJ")
    return { fg: "#d4af37", bg: "rgba(212,175,55,0.12)", border: "rgba(212,175,55,0.6)" };
  if (code === "MG")
    return { fg: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.5)" };
  if (code === "SC")
    return { fg: "#3fb98a", bg: "rgba(63,185,138,0.12)", border: "rgba(63,185,138,0.5)" };
  if (code === "PT")
    return { fg: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.5)" };
  return { fg: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.4)" };
}

export function Leaderboard() {
  const { rows, loading } = useLeaderboard(50);
  const { profile } = useAuth();

  return (
    <section className="premium-card sharp flex flex-col gap-4 p-5">
      <Header
        index="03"
        title="Global Leaderboard Terminal"
        subtitle="Top 50 · ranked by Elo"
      />

      {/* Column header */}
      <div className="grid grid-cols-[44px_1fr_90px_60px_55px] gap-2 border-b border-white/10 pb-2 font-mono-terminal text-[9px] uppercase tracking-[0.18em] text-white/40 sm:grid-cols-[52px_1fr_140px_80px_70px]">
        <span>Rank</span>
        <span>Attorney</span>
        <span className="hidden sm:inline">Tier</span>
        <span className="sm:hidden">Tier</span>
        <span className="text-right">Elo</span>
        <span className="text-right">Wins</span>
      </div>

      <div className="fade-mask-b max-h-[420px] overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse border border-white/5 bg-white/[0.02]"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Crown className="h-8 w-8 text-gold/40" />
            <p className="font-mono-terminal text-xs text-white/30">
              No attorneys on the docket yet.
            </p>
            <p className="font-mono-terminal text-[9px] uppercase tracking-widest text-white/20">
              Be the first to take the bench.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {rows.map((p, i) => {
              const tier = tierInfoForElo(p.elo);
              const isMe = profile?.id === p.id;
              const tc = tierColor(tier);
              const isTop3 = i < 3;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
                  className={cn(
                    "group grid grid-cols-[44px_1fr_90px_60px_55px] items-center gap-2 border px-2.5 py-2 font-mono-terminal text-xs transition-all sm:grid-cols-[52px_1fr_140px_80px_70px]",
                    isMe
                      ? "animate-glow-pulse border-gold/70 bg-gold/[0.08] text-gold"
                      : isTop3
                        ? "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
                        : "border-transparent hover:border-white/15 hover:bg-white/[0.03] text-white/80",
                  )}
                >
                  <span className="flex items-center justify-center">
                    {isTop3 ? (
                      <span
                        className="animate-pop-in flex h-7 w-7 items-center justify-center font-mono-terminal text-[10px] font-black text-black"
                        style={{
                          background: RANK_MEDAL[i],
                          boxShadow: `0 0 12px -2px ${RANK_MEDAL[i]}`,
                        }}
                      >
                        {i + 1}
                      </span>
                    ) : (
                      <span className="font-mono-terminal text-[10px] text-white/35">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 truncate font-bold">
                    {isTop3 && i === 0 && <Crown className="h-3 w-3 shrink-0 text-gold" />}
                    {isTop3 && i === 1 && <Medal className="h-3 w-3 shrink-0 text-white/70" />}
                    {isTop3 && i === 2 && <Award className="h-3 w-3 shrink-0 text-amber-600" />}
                    <span className={cn("truncate", isMe ? "text-gold text-glow-gold" : "text-white")}>
                      {p.username}
                    </span>
                    {isMe && (
                      <span className="ml-1 shrink-0 border border-gold/60 bg-gold/10 px-1 py-0 text-[8px] uppercase tracking-widest text-gold">
                        YOU
                      </span>
                    )}
                  </span>
                  <span>
                    <span
                      className="sharp inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono-terminal text-[8px] font-bold uppercase tracking-widest"
                      style={{ color: tc.fg, borderColor: tc.border, background: tc.bg }}
                    >
                      <span className="h-1 w-1" style={{ background: tc.fg }} />
                      <span className="sm:hidden">{tier.code}</span>
                      <span className="hidden sm:inline">{tier.label}</span>
                    </span>
                  </span>
                  <span className={cn("text-right font-bold tabular-nums", isMe ? "text-gold" : "text-gold/90")}>
                    {p.elo}
                  </span>
                  <span className="text-right tabular-nums text-white/60">{p.wins}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tier legend */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="font-mono-terminal text-[8px] uppercase tracking-widest text-white/30">
          Tiers:
        </span>
        {RANK_TIERS.map((t) => {
          const tc = tierColor(t);
          return (
            <span
              key={t.code}
              className="flex items-center gap-1 font-mono-terminal text-[8px] uppercase tracking-widest"
              style={{ color: tc.fg }}
            >
              <span className="h-1 w-1" style={{ background: tc.fg }} />
              {t.code}
            </span>
          );
        })}
      </div>
    </section>
  );
}
