"use client";
// ===== Achievements — unlocked badges panel =====
import { motion } from "framer-motion";
import { Header } from "./AvatarCustomizer";
import { ACHIEVEMENTS } from "@/lib/data/achievements";
import { useAuth } from "@/hooks/use-auth";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function Achievements() {
  const { profile } = useAuth();
  if (!profile) return null;

  const unlockedCount = ACHIEVEMENTS.filter((a) => a.check(profile)).length;

  return (
    <section className="premium-card sharp flex flex-col gap-5 p-5">
      <Header
        index="04"
        title="Achievements"
        subtitle={`${unlockedCount} / ${ACHIEVEMENTS.length} unlocked`}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {ACHIEVEMENTS.map((a, i) => {
          const unlocked = a.check(profile);
          const Icon = a.icon;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: Math.min(0.4, i * 0.04) }}
              title={unlocked ? a.description : "Locked — " + a.description}
              className={cn(
                "hud-corners sharp group relative flex flex-col items-center gap-2 overflow-hidden border p-3 text-center transition-all",
                unlocked
                  ? "border-gold/50 bg-gradient-to-br from-gold/[0.12] to-transparent"
                  : "border-white/10 bg-white/[0.02] opacity-50 grayscale",
              )}
            >
              {/* glow for unlocked */}
              {unlocked && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-50"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 35%, rgba(212,175,55,0.18), transparent 65%)",
                  }}
                />
              )}
              <div
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center border",
                  unlocked
                    ? "animate-glow-pulse border-gold/60 bg-gold/15 text-gold"
                    : "border-white/15 bg-white/5 text-white/30",
                )}
              >
                {unlocked ? (
                  <Icon className="h-5 w-5" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </div>
              <div className="relative">
                <div
                  className={cn(
                    "font-mono-terminal text-[10px] font-bold uppercase tracking-[0.4em]",
                    unlocked ? "text-gold" : "text-white/45",
                  )}
                >
                  {a.name}
                </div>
                <p className="mt-1 font-mono-terminal text-[8px] uppercase leading-tight tracking-wider text-white/40">
                  {a.description}
                </p>
              </div>
              {unlocked && (
                <span className="relative font-mono-terminal text-[8px] font-bold uppercase tracking-widest text-gold">
                  ★ Unlocked
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
