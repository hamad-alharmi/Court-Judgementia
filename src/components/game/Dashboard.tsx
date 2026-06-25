"use client";
// ===== Phase 3: Main Terminal Dashboard =====
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PixelScales } from "./PixelScales";
import { ProfileStats } from "./ProfileStats";
import { AvatarCustomizer } from "./AvatarCustomizer";
import { Leaderboard } from "./Leaderboard";
import { Matchmaking } from "./Matchmaking";
import { MatchHistory } from "./MatchHistory";
import { Achievements } from "./Achievements";
import { AdSlot } from "./AdSlot";
import { useAuth } from "@/hooks/use-auth";
import { tierInfoForElo } from "@/lib/data/ranks";
import { LogOut, Scale, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared staggered fade-in variants for dashboard sections
const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};
const sectionTransition = (delay: number) => ({
  duration: 0.5,
  delay,
  ease: "easeOut" as const,
});

export function Dashboard({ onEnterRoom }: { onEnterRoom: (id: string) => void }) {
  const { profile, logout } = useAuth();

  return (
    <div className="relative flex min-h-screen flex-col bg-black">
      {/* Ambient scanline / grid overlay — fixed, sits behind everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 4px)",
          maskImage:
            "radial-gradient(ellipse at 50% 30%, black 0%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 30%, black 0%, transparent 80%)",
          opacity: 0.5,
        }}
      />

      {/* ===== HEADER ===== */}
      <header className="header-gradient-bar sticky top-0 z-30 border-b border-white/10 bg-black/85 backdrop-blur">
        {/* Subtle gold sweep accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden"
        >
          <div className="animate-scan-x h-px w-1/3 bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex items-center gap-3.5">
            <div className="relative h-9 w-9 animate-float-soft">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 blur-md"
                style={{
                  background:
                    "radial-gradient(circle, rgba(212,175,55,0.45), transparent 70%)",
                }}
              />
              <PixelScales tilt={false} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-glow-gold text-gold font-mono-terminal text-base font-bold tracking-[0.32em] sm:text-lg">
                  JUDGEMENTIA
                </h1>
                <span className="hidden h-3.5 w-px bg-gold/30 sm:block" />
                <TerminalSquare className="hidden h-3.5 w-3.5 text-gold/60 sm:block" />
              </div>
              <p className="font-mono-terminal text-[8px] uppercase tracking-[0.4em] text-white/30 sm:text-[9px]">
                Command Terminal · v2.4
              </p>
            </div>
          </div>

          {profile && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="font-mono-terminal text-xs font-bold text-white">
                  {profile.username}
                </div>
                <div className="font-mono-terminal text-[9px] uppercase tracking-widest text-gold/80">
                  {profile.elo} Elo · {tierInfoForElo(profile.elo).code}
                </div>
              </div>
              {/* Premium HUD profile chip */}
              <div
                className={cn(
                  "hud-corners sharp relative flex items-center gap-2 border border-gold/45 bg-gradient-to-r from-gold/[0.08] to-transparent px-3 py-1.5",
                  "transition hover:border-gold hover:from-gold/[0.14]",
                )}
              >
                <Scale className="h-3.5 w-3.5 text-gold" />
                <span className="text-glow-gold font-mono-terminal text-[11px] font-bold text-gold">
                  {profile.elo}
                </span>
                <span className="font-mono-terminal text-[9px] uppercase tracking-widest text-gold/60">
                  Elo
                </span>
              </div>
              <Button
                onClick={logout}
                variant="ghost"
                size="icon"
                className="sharp h-9 w-9 border border-white/15 text-white/50 transition hover:border-red-500/50 hover:text-red-400"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-7">
        {/* Matchmaking first (primary entry vector) */}
        <motion.div
          className="mb-7"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={sectionTransition(0.05)}
        >
          <Matchmaking onEnterRoom={onEnterRoom} />
        </motion.div>

        {/* Stats + Avatar | Leaderboard */}
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
          <div className="flex flex-col gap-7 lg:col-span-5">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              transition={sectionTransition(0.15)}
            >
              <ProfileStats />
            </motion.div>
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              transition={sectionTransition(0.25)}
            >
              <AvatarCustomizer />
            </motion.div>
          </div>
          <motion.div
            className="lg:col-span-7"
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            transition={sectionTransition(0.35)}
          >
            <Leaderboard />
          </motion.div>
        </div>

        {/* Ad slot — only shows if user opted into ads */}
        <motion.div
          className="mt-7"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={sectionTransition(0.45)}
        >
          <AdSlot slot="dashboard-bottom" label="Sponsored" />
        </motion.div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="header-gradient-bar relative z-10 mt-auto border-t border-white/10 bg-black px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="font-mono-terminal text-[9px] uppercase tracking-[0.3em] text-white/30">
            JUDGEMENTIA · Legal Trial Protocol
          </div>
          <div className="flex items-center gap-2 font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
            <span className="h-1 w-1 animate-blink bg-gold" />
            Chief Justice Vanguard presiding
          </div>
        </div>
      </footer>
    </div>
  );
}
