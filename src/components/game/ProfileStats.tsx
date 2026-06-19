"use client";
// ===== Profile Stats Terminal =====
import { Header } from "./AvatarCustomizer";
import { tierInfoForElo, progressToNextTier } from "@/lib/data/ranks";
import { useAuth } from "@/hooks/use-auth";

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
    { label: "Cases Tried", value: profile.casesTried },
    { label: "Convictions", value: profile.convictions },
    { label: "Acquittals", value: profile.acquittals },
    { label: "Win Rate", value: `${winRate}%` },
  ];

  return (
    <section className="panel sharp flex flex-col gap-5 p-5">
      <Header
        index="01"
        title="Profile Stats Terminal"
        subtitle="Live litigation metrics"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="panel-2 sharp flex flex-col gap-1 p-3"
          >
            <span className="font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/40">
              {s.label}
            </span>
            <span
              className={
                "font-mono-terminal text-lg font-bold " +
                (s.accent ? "text-gold text-glow-gold" : "text-white")
              }
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* rank progress */}
      <div className="panel-2 sharp p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono-terminal text-[10px] uppercase tracking-[0.2em] text-white/50">
            Rank Progress
          </span>
          {prog.next ? (
            <span className="font-mono-terminal text-[10px] text-white/40">
              {prog.remaining} Elo to{" "}
              <span className="text-gold">{prog.next.label}</span>
            </span>
          ) : (
            <span className="font-mono-terminal text-[10px] text-gold">
              APEX TIER REACHED
            </span>
          )}
        </div>
        <div className="h-2 w-full border border-white/10 bg-white/5">
          <div
            className="h-full bg-gold transition-[width] duration-500"
            style={{ width: `${prog.pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between font-mono-terminal text-[9px] text-white/30">
          <span>{tier.code} · {tier.label}</span>
          <span>JS → PT → SC → MG → CJ</span>
        </div>
      </div>

      {/* judge favorability */}
      <div className="panel-2 sharp p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono-terminal text-[10px] uppercase tracking-[0.2em] text-white/50">
            Chief Justice Vanguard — Favorability
          </span>
          <span className="font-mono-terminal text-sm font-bold text-gold">
            {profile.judgeFavorability}%
          </span>
        </div>
        <div className="h-2 w-full border border-white/10 bg-white/5">
          <div
            className="h-full transition-[width] duration-500"
            style={{
              width: `${profile.judgeFavorability}%`,
              background:
                profile.judgeFavorability >= 66
                  ? "var(--gold)"
                  : profile.judgeFavorability >= 33
                    ? "#f08a24"
                    : "#e0524a",
            }}
          />
        </div>
      </div>
    </section>
  );
}
