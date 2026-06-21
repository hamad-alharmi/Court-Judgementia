"use client";
// ===== Profile Stats Terminal =====
import { motion } from "framer-motion";
import { Header } from "./AvatarCustomizer";
import { Achievements } from "./Achievements";
import { MatchHistory } from "./MatchHistory";
import { tierInfoForElo, progressToNextTier, RANK_TIERS } from "@/lib/data/ranks";
import { useAuth } from "@/hooks/use-auth";
import { Scale, Gavel, Trophy, Target, ShieldCheck, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const STAT_ICONS: Record<string, LucideIcon> = {
  "Elo Rating": Scale,
  "Rank Tier": Gavel,
  "Cases Tried": Target,
  Convictions: ShieldCheck,
  Acquittals: Trophy,
  "Win Rate": Percent,
};

export function ProfileStats() {
  const { profile } = useAuth();
  if (!profile) return null;

  const tier = tierInfoForElo(profile.elo);
  const prog = progressToNextTier(profile.elo);
  const winRate =
    profile.casesTried > 0
      ? Math.round((profile.wins / profile.casesTried) * 100)
      : 0;

  const stats = [
    { label: "Elo Rating", value: profile.elo.toLocaleString(), accent: true },
    { label: "Rank Tier", value: tier.label, accent: true },
    { label: "Cases Tried", value: profile.casesTried.toString() },
    { label: "Convictions", value: profile.convictions.toString() },
    { label: "Acquittals", value: profile.acquittals.toString() },
    { label: "Win Rate", value: `${winRate}%` },
  ];

  // Judge favorability tier
  const fav = profile.judgeFavorability;
  const favColor = fav >= 66 ? "var(--gold)" : fav >= 33 ? "#f08a24" : "#e0524a";
  const favLabel = fav >= 80 ? "REVERED" : fav >= 60 ? "ESTEEMED" : fav >= 40 ? "NEUTRAL" : fav >= 20 ? "DISAPPROVED" : "REVILED";

  return (
    <div className="flex flex-col gap-5">
      <section className="premium-card sharp flex flex-col gap-5 p-5">
        <Header
          index="01"
          title="Profile Stats Terminal"
          subtitle="Live litigation metrics"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((s, i) => {
            const Icon = STAT_ICONS[s.label] ?? Target;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={cn(
                  "hud-corners sharp relative flex flex-col gap-1.5 overflow-hidden border p-3 transition-colors hover:border-white/30",
                  s.accent
                    ? "border-gold/40 bg-gradient-to-br from-gold/[0.08] to-transparent"
                    : "border-white/12 bg-gradient-to-br from-white/[0.03] to-transparent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-terminal text-[9px] uppercase tracking-[0.04em] text-white/45">
                    {s.label}
                  </span>
                  <Icon
                    className={cn("h-3 w-3", s.accent ? "text-gold" : "text-white/40")}
                  />
                </div>
                <span
                  className={cn(
                    "font-mono-terminal text-xl font-black tabular-nums",
                    s.accent ? "text-gold text-glow-gold" : "text-white",
                  )}
                >
                  {s.value}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* rank progress — more prominent */}
        <div className="hud-corners sharp relative overflow-hidden border border-gold/30 bg-gradient-to-br from-gold/[0.05] to-transparent p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 animate-blink bg-gold" />
              <span className="font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/55">
                Rank Progress
              </span>
            </div>
            {prog.next ? (
              <span className="font-mono-terminal text-[10px] text-white/40">
                <span className="text-gold">{prog.remaining}</span> Elo to{" "}
                <span className="text-gold">{prog.next.label}</span>
              </span>
            ) : (
              <span className="text-glow-gold font-mono-terminal text-[10px] font-bold uppercase tracking-widest text-gold">
                ★ APEX TIER REACHED ★
              </span>
            )}
          </div>
          <div className="relative h-3 w-full border border-white/15 bg-black/60">
            <div
              className="relative h-full transition-[width] duration-500"
              style={{
                width: `${prog.pct}%`,
                background: "linear-gradient(90deg, var(--gold), #e8c860)",
              }}
            >
              <div
                className="animate-shimmer absolute inset-0 opacity-40"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                  backgroundSize: "200% 100%",
                }}
              />
            </div>
            {/* Tick marks */}
            <div className="pointer-events-none absolute inset-0 flex justify-between px-px">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="h-full w-px bg-white/5" />
              ))}
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono-terminal text-[9px] text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="text-gold">▸</span>
              {tier.code} · {tier.label}
            </span>
            <span className="tracking-widest">{RANK_TIERS.map((t) => t.code).join(" → ")}</span>
          </div>
        </div>

        {/* judge favorability meter — better visual treatment */}
        <div className="hud-corners sharp relative overflow-hidden border border-white/15 bg-gradient-to-br from-white/[0.03] to-transparent p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel className="h-3.5 w-3.5 text-gold" />
              <span className="font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/55">
                Chief Justice Vanguard — Favorability
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="font-mono-terminal text-[8px] font-bold uppercase tracking-widest"
                style={{ color: favColor }}
              >
                {favLabel}
              </span>
              <span
                className="font-mono-terminal text-base font-black tabular-nums"
                style={{ color: favColor, textShadow: `0 0 12px ${favColor}66` }}
              >
                {profile.judgeFavorability}%
              </span>
            </div>
          </div>
          <div className="relative h-3 w-full border border-white/15 bg-black/60">
            <div
              className="relative h-full transition-[width] duration-700"
              style={{
                width: `${profile.judgeFavorability}%`,
                background: `linear-gradient(90deg, ${favColor}, ${favColor}cc)`,
              }}
            >
              <div
                className="animate-shimmer absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  backgroundSize: "200% 100%",
                }}
              />
            </div>
            {/* Threshold ticks */}
            <div className="pointer-events-none absolute inset-0 flex">
              <span className="h-full w-1/3 border-r border-white/15" />
              <span className="h-full w-1/3 border-r border-white/15" />
              <span className="h-full w-1/3" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono-terminal text-[8px] uppercase tracking-widest text-white/30">
            <span>0 — Reviled</span>
            <span>50 — Neutral</span>
            <span>100 — Revered</span>
          </div>
        </div>
      </section>

      <Achievements />
      <MatchHistory />
    </div>
  );
}
