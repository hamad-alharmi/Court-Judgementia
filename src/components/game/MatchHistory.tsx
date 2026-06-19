"use client";
// ===== Match History — recent case log =====
import { motion } from "framer-motion";
import { Header } from "./AvatarCustomizer";
import { getScenarioById } from "@/lib/data/cases";
import { useAuth } from "@/hooks/use-auth";
import { Gavel, ScrollText, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchHistoryEntry } from "@/lib/types";

function formatTime(at: number): string {
  try {
    const d = new Date(at);
    const now = Date.now();
    const diffMs = now - at;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function caseTitleFor(scenarioId: string): string {
  const sc = getScenarioById(scenarioId);
  return sc?.title ?? `Case ${scenarioId.slice(0, 8)}`;
}

function MatchHistoryRow({
  entry,
  index,
}: {
  entry: MatchHistoryEntry;
  index: number;
}) {
  const guilty = entry.verdict === "GUILTY";
  const positiveElo = entry.eloDelta > 0;
  const negativeElo = entry.eloDelta < 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(0.4, index * 0.04) }}
      className={cn(
        "sharp relative flex items-center gap-3 border-l-2 bg-gradient-to-r p-3 transition-colors hover:border-white/40",
        entry.won
          ? "border-l-gold from-gold/[0.08] to-transparent border-y border-r border-gold/20"
          : "border-l-white/30 from-white/[0.03] to-transparent border-y border-r border-white/10",
      )}
    >
      {/* verdict icon tile */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center border",
          guilty
            ? "border-red-500/40 bg-red-500/10 text-red-400"
            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
        )}
      >
        <Gavel className="h-4 w-4" />
      </div>

      {/* case + verdict */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono-terminal text-xs font-bold text-white">
          {caseTitleFor(entry.scenarioId)}
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono-terminal text-[9px] uppercase tracking-widest">
          <span
            className={cn(
              "sharp border px-1.5 py-0.5 font-bold",
              guilty
                ? "border-red-500/40 text-red-400"
                : "border-emerald-500/40 text-emerald-400",
            )}
          >
            {guilty ? "Guilty" : "Not Guilty"}
          </span>
          <span
            className={cn(
              "font-bold",
              entry.won ? "text-gold" : "text-white/45",
            )}
          >
            {entry.won ? "▲ WON" : "▼ LOST"}
          </span>
          <span className="text-white/30">{formatTime(entry.at)}</span>
        </div>
      </div>

      {/* elo delta */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 font-mono-terminal text-sm font-bold tabular-nums",
          positiveElo
            ? "text-emerald-400"
            : negativeElo
              ? "text-red-400"
              : "text-white/40",
        )}
        title="Elo change"
      >
        {positiveElo ? (
          <TrendingUp className="h-3.5 w-3.5" />
        ) : negativeElo ? (
          <TrendingDown className="h-3.5 w-3.5" />
        ) : null}
        {positiveElo ? "+" : ""}
        {entry.eloDelta}
      </div>
    </motion.div>
  );
}

export function MatchHistory() {
  const { profile } = useAuth();
  if (!profile) return null;
  const history = (profile.matchHistory ?? []).slice().reverse(); // newest first

  return (
    <section className="premium-card sharp flex flex-col gap-5 p-5">
      <Header
        index="03"
        title="Match History"
        subtitle="Recent verdicts on record"
      />

      {history.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center gap-3 overflow-hidden border border-dashed border-white/15 py-12 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(212,175,55,0.08), transparent 60%)",
            }}
          />
          <ScrollText className="relative h-9 w-9 animate-float-soft text-gold/50" />
          <p className="relative font-mono-terminal text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
            No cases tried yet.
          </p>
          <p className="relative font-mono-terminal text-[9px] uppercase tracking-widest text-white/30">
            File your first statement to begin your record.
          </p>
        </div>
      ) : (
        <div
          className="fade-mask-b flex max-h-96 flex-col gap-2 overflow-y-auto pr-1"
          role="log"
          aria-label="Recent match history"
        >
          {history.map((entry, i) => (
            <MatchHistoryRow
              key={`${entry.at}-${entry.scenarioId}-${i}`}
              entry={entry}
              index={i}
            />
          ))}
        </div>
      )}

      <div className="font-mono-terminal text-[9px] uppercase tracking-widest text-white/30">
        Showing last {history.length} of 20 recorded matches
      </div>
    </section>
  );
}
