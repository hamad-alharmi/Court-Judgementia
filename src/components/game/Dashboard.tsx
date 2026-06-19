"use client";
// ===== Phase 3: Main Terminal Dashboard =====
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PixelScales } from "./PixelScales";
import { ProfileStats } from "./ProfileStats";
import { AvatarCustomizer } from "./AvatarCustomizer";
import { Leaderboard } from "./Leaderboard";
import { Matchmaking } from "./Matchmaking";
import { useAuth } from "@/hooks/use-auth";
import { tierInfoForElo } from "@/lib/data/ranks";
import { LogOut, Scale } from "lucide-react";

// Shared staggered fade-in variants for dashboard sections
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};
const sectionTransition = (delay: number) => ({
  duration: 0.4,
  delay,
  ease: "easeOut" as const,
});

export function Dashboard({ onEnterRoom }: { onEnterRoom: (id: string) => void }) {
  const { profile, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8">
              <PixelScales tilt={false} />
            </div>
            <div>
              <h1 className="text-glow-gold text-gold font-mono-terminal text-base font-bold tracking-[0.3em] sm:text-lg">
                JUDGEMENTIA
              </h1>
              <p className="font-mono-terminal text-[8px] uppercase tracking-[0.3em] text-white/30 sm:text-[9px]">
                Command Terminal
              </p>
            </div>
          </div>

          {profile && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="font-mono-terminal text-xs font-bold text-white">
                  {profile.username}
                </div>
                <div className="font-mono-terminal text-[9px] uppercase tracking-widest text-gold">
                  {profile.elo} Elo · {tierInfoForElo(profile.elo).code}
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-none border border-gold/40 bg-gold/5 px-2.5 py-1">
                <Scale className="h-3.5 w-3.5 text-gold" />
                <span className="font-mono-terminal text-[10px] font-bold text-gold">
                  {profile.elo}
                </span>
              </div>
              <Button
                onClick={logout}
                variant="ghost"
                size="icon"
                className="sharp h-9 w-9 border border-white/15 text-white/50 hover:text-white"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {/* Matchmaking first (primary entry vector) */}
        <motion.div
          className="mb-6"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={sectionTransition(0.05)}
        >
          <Matchmaking onEnterRoom={onEnterRoom} />
        </motion.div>

        {/* Stats + Avatar | Leaderboard */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-5">
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
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t border-white/10 bg-black px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="font-mono-terminal text-[9px] uppercase tracking-[0.25em] text-white/30">
            JUDGEMENTIA · Cyber Legal Trial Protocol
          </div>
          <div className="font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
            Chief Justice Vanguard presiding
          </div>
        </div>
      </footer>
    </div>
  );
}
