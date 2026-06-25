"use client";
// ===== Matchmaking Core (v2: setup options + settings + admin) =====
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateRoomModal } from "./CreateRoomModal";
import { SettingsModal } from "./SettingsModal";
import { AdminPanel } from "./AdminPanel";
import { useAuth } from "@/hooks/use-auth";
import { useSound } from "@/hooks/use-sound";
import { rooms, DATA_MODE } from "@/lib/api";
import { generateChamberCode, normalizeCode, isValidChamberCode } from "@/lib/codec";
import { randomScenarioId } from "@/lib/data/cases";
import { newRoom } from "@/lib/room";
import { toast } from "sonner";
import {
  Eye,
  Gavel,
  LogIn,
  Plus,
  Swords,
  Cpu,
  ArrowRight,
  Settings,
  Shield,
  TerminalSquare,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RANKED_STATEMENT_COUNT } from "@/lib/types";
import type { Room, RoomPhase } from "@/lib/types";

// Ongoing trial phase labels for the spectate list.
const PHASE_LABEL: Record<RoomPhase, string> = {
  lobby: "Lobby",
  case_intro: "Briefing",
  prosecutor_turn: "Prosecution",
  defendant_turn: "Defense",
  jury_voting: "Jury",
  verdict: "Verdict",
};

export function Matchmaking({ onEnterRoom }: { onEnterRoom: (id: string) => void }) {
  const { profile } = useAuth();
  const sounds = useSound();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lobbies, setLobbies] = useState<Room[]>([]);
  const [ongoing, setOngoing] = useState<Room[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  async function refreshLobbies() {
    try {
      const [lobbs, ong] = await Promise.all([
        rooms.listRecentLobbies(),
        rooms.listOngoingTrials(),
      ]);
      setLobbies(lobbs);
      setOngoing(ong);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshLobbies();
    const iv = setInterval(refreshLobbies, 5000);
    return () => clearInterval(iv);
  }, []);

  async function joinCustom() {
    if (!profile) return;
    const code = normalizeCode(joinCode);
    if (!isValidChamberCode(code)) {
      toast.error("Enter a valid 4-letter chamber code.");
      return;
    }
    setBusy("join");
    try {
      const room = await rooms.getByCode(code);
      if (!room) {
        toast.error(`No active chamber found for ${code}.`);
        return;
      }
      if (room.phase !== "lobby" && room.phase !== "case_intro") {
        // allow re-entry if already a participant
        if (room.prosecutorId === profile.id || room.defendantId === profile.id) {
          onEnterRoom(room.id);
          return;
        }
        toast.error("That trial is already in session.");
        return;
      }
      if (room.closed) {
        toast.error("That chamber has been adjourned.");
        return;
      }
      if (room.prosecutorId === profile.id || room.defendantId === profile.id) {
        onEnterRoom(room.id);
        return;
      }
      // take first open slot
      if (!room.prosecutorId || room.prosecutorIsAI) {
        await rooms.update(room.id, {
          prosecutorId: profile.id,
          prosecutorName: profile.username,
          prosecutorIsAI: false,
        });
      } else if (!room.defendantId || room.defendantIsAI) {
        await rooms.update(room.id, {
          defendantId: profile.id,
          defendantName: profile.username,
          defendantIsAI: false,
        });
      } else {
        toast.error("That chamber is already full.");
        return;
      }
      toast.success(`Joined chamber ${room.code}.`);
      onEnterRoom(room.id);
    } catch {
      toast.error("Failed to join chamber.");
    } finally {
      setBusy(null);
    }
  }

  async function rankedQueue() {
    if (!profile) return;
    setBusy("ranked");
    try {
      // Poll for an open ranked room (5 attempts over 5s)
      let open: Room | null = null;
      for (let i = 0; i < 5; i++) {
        open = await rooms.findOpenRankedRoom();
        if (open && open.prosecutorId !== profile.id) break;
        open = null;
        if (i < 4) await new Promise((r) => setTimeout(r, 1000));
      }
      if (open) {
        await rooms.update(open.id, {
          defendantId: profile.id,
          defendantName: profile.username,
          defendantIsAI: false,
        });
        toast.success(`Matched into ranked chamber ${open.code}.`);
        onEnterRoom(open.id);
      } else {
        const code = generateChamberCode();
        const room = newRoom({
          code,
          matchmakingType: "ranked",
          scenarioId: randomScenarioId(),
          hostId: profile.id,
          prosecutorId: profile.id,
          prosecutorName: profile.username,
          statementCount: RANKED_STATEMENT_COUNT,
          aiDifficulty: "hard",
          caseTheme: "murder mystery",
          phase: "lobby",
        });
        await rooms.create(room);
        toast.info("Ranked queue entered. Awaiting opponent...");
        onEnterRoom(room.id);
      }
    } catch {
      toast.error("Ranked queue failed.");
    } finally {
      setBusy(null);
    }
  }

  async function practiceVsAI() {
    if (!profile) return;
    setBusy("practice");
    try {
      const code = generateChamberCode();
      const room = newRoom({
        code,
        matchmakingType: "casual",
        scenarioId: randomScenarioId(),
        hostId: profile.id,
        prosecutorId: profile.id,
        prosecutorName: profile.username,
        defendantId: null,
        defendantName: "AI Defense",
        defendantIsAI: true,
        statementCount: 4,
        aiDifficulty: "medium",
        caseTheme: "murder mystery",
        phase: "lobby",
      });
      await rooms.create(room);
      toast.success("Practice chamber ready.");
      onEnterRoom(room.id);
    } catch {
      toast.error("Failed to start practice.");
    } finally {
      setBusy(null);
    }
  }

  const actions = [
    {
      id: "create",
      icon: Plus,
      title: "Create Custom Chamber",
      desc: "Configure statements, AI roles, difficulty, and case theme.",
      onClick: () => {
        sounds.click();
        setCreateOpen(true);
      },
      tone: "gold" as const,
      tag: "HOST",
    },
    {
      id: "join",
      icon: LogIn,
      title: "Join Custom Chamber",
      desc: "Punch in an active code to enter a pending trial.",
      onClick: () => {
        sounds.click();
        joinCustom();
      },
      tone: "white" as const,
      tag: "CODE",
    },
    {
      id: "ranked",
      icon: Swords,
      title: "Ranked Matchmaking",
      desc: `Skill-based competitive queue. ${RANKED_STATEMENT_COUNT} statements, AI assist blocked.`,
      onClick: () => {
        sounds.click();
        rankedQueue();
      },
      tone: "crimson" as const,
      tag: "ELO",
    },
    {
      id: "practice",
      icon: Cpu,
      title: "Practice vs AI",
      desc: "Solo drill against AI defense counsel. No Elo risk.",
      onClick: () => {
        sounds.click();
        practiceVsAI();
      },
      tone: "white" as const,
      tag: "SOLO",
    },
  ];

  return (
    <section className="premium-card sharp flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-baseline gap-3">
          <TerminalSquare className="h-4 w-4 text-gold" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-terminal text-[10px] text-gold">04</span>
              <h2 className="font-mono-terminal text-sm font-bold uppercase tracking-[0.25em] text-white">
                Matchmaking Core
              </h2>
            </div>
            <p className="font-mono-terminal text-[10px] uppercase tracking-widest text-white/35">
              Select your entry vector
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile?.isAdmin && (
            <Button
              onClick={() => setAdminOpen(true)}
              variant="ghost"
              size="icon"
              className="sharp h-9 w-9 border border-gold/50 text-gold transition hover:bg-gold hover:text-black"
              title="Admin panel"
            >
              <Shield className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={() => setSettingsOpen(true)}
            variant="ghost"
            size="icon"
            className="sharp h-9 w-9 border border-white/20 text-white/60 transition hover:text-white hover:border-white/50"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.id}
              type="button"
              onClick={a.onClick}
              disabled={busy !== null}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 + i * 0.06 }}
              className={cn(
                "group relative flex h-[148px] flex-col justify-between overflow-hidden border p-4 text-left transition-all duration-200 disabled:opacity-40",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/[0.05] before:to-transparent before:opacity-0 before:transition-opacity before:content-[''] hover:before:opacity-100",
                a.tone === "gold" &&
                  "border-gold/40 hover:border-gold hover:shadow-[0_0_28px_-6px_var(--gold)] hover:-translate-y-0.5",
                a.tone === "white" &&
                  "border-white/15 hover:border-white/60 hover:shadow-[0_0_24px_-8px_rgba(255,255,255,0.5)] hover:-translate-y-0.5",
                a.tone === "crimson" &&
                  "border-red-500/40 hover:border-red-500 hover:shadow-[0_0_28px_-6px_rgba(224,82,74,0.7)] hover:-translate-y-0.5",
                busy === a.id && "opacity-100",
              )}
              style={{
                background:
                  a.tone === "gold"
                    ? "linear-gradient(180deg, rgba(212,175,55,0.06), transparent 60%), #0a0a0a"
                    : a.tone === "crimson"
                      ? "linear-gradient(180deg, rgba(224,82,74,0.06), transparent 60%), #0a0a0a"
                      : "linear-gradient(180deg, rgba(255,255,255,0.04), transparent 60%), #0a0a0a",
              }}
            >
              {/* Top tag badge */}
              <div className="relative z-10 flex items-center justify-between">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center border transition-colors",
                    a.tone === "gold" && "border-gold/40 bg-gold/10 text-gold group-hover:border-gold group-hover:bg-gold/20",
                    a.tone === "white" && "border-white/20 bg-white/5 text-white/80 group-hover:border-white/50 group-hover:bg-white/10",
                    a.tone === "crimson" && "border-red-500/40 bg-red-500/10 text-red-400 group-hover:border-red-500 group-hover:bg-red-500/20",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "font-mono-terminal text-[8px] font-bold uppercase tracking-[0.25em] px-1.5 py-0.5 border",
                    a.tone === "gold" && "border-gold/30 text-gold/70",
                    a.tone === "white" && "border-white/15 text-white/40",
                    a.tone === "crimson" && "border-red-500/30 text-red-400/80",
                  )}
                >
                  {a.tag}
                </span>
              </div>
              <div className="relative z-10">
                <div
                  className={cn(
                    "font-mono-terminal text-xs font-bold uppercase tracking-[0.4em] text-white transition-colors",
                    a.tone === "gold" && "group-hover:text-gold",
                    a.tone === "crimson" && "group-hover:text-red-400",
                  )}
                >
                  {a.title}
                </div>
                <p className="mt-1.5 font-mono-terminal text-[10px] leading-relaxed text-white/40">
                  {a.desc}
                </p>
              </div>
              {/* Bottom arrow accent on hover */}
              <div className="relative z-10 flex items-center justify-end">
                <ArrowRight
                  className={cn(
                    "h-3.5 w-3.5 -translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100",
                    a.tone === "gold" && "text-gold",
                    a.tone === "white" && "text-white/60",
                    a.tone === "crimson" && "text-red-400",
                  )}
                />
              </div>
              {/* Busy overlay */}
              {busy === a.id && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-blink bg-gold" />
                    <span className="font-mono-terminal text-[10px] uppercase tracking-[0.3em] text-gold">
                      Connecting
                    </span>
                  </div>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Dramatic join code terminal entry */}
      <div
        className="premium-card sharp relative flex flex-col gap-3 overflow-hidden p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(212,175,55,0.04), transparent 50%), #0a0a0a",
        }}
      >
        {/* Decorative scan line */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-scan-x absolute top-1/2 h-px w-1/3 -translate-y-1/2 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-2 text-center">
          <KeyRound className="h-5 w-5 text-gold" />
          <label className="font-mono-terminal text-[10px] uppercase tracking-[0.35em] text-gold/80">
            Enter Chamber Code
          </label>
          <p className="font-mono-terminal text-[9px] uppercase tracking-widest text-white/30">
            Authenticate into an active trial in progress
          </p>
        </div>
        <div className="relative z-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              onKeyDown={(e) => {
                if (e.key === "Enter") joinCustom();
              }}
              placeholder="ABCD"
              className="sharp h-14 border-2 border-white/15 bg-black text-center font-mono-terminal text-3xl font-black tracking-[0.6em] text-gold placeholder:text-white/15 focus-visible:border-gold focus-visible:shadow-[0_0_24px_-6px_var(--gold)] sm:text-4xl"
            />
          </div>
          <Button
            onClick={() => {
              sounds.click();
              joinCustom();
            }}
            disabled={busy !== null || joinCode.length < 4}
            className="sharp h-14 border border-gold bg-gold px-8 font-mono-terminal text-xs font-bold uppercase tracking-[0.3em] text-black transition hover:bg-gold/85 hover:shadow-[0_0_24px_-4px_var(--gold)] disabled:opacity-30"
          >
            <LogIn className="h-4 w-4" />
            Enter
          </Button>
        </div>
        <p className="relative z-10 text-center font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
          ▸ Press <span className="text-gold/70">ENTER</span> to file
        </p>
      </div>

      {/* Recent open lobbies */}
      {lobbies.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Gavel className="h-3.5 w-3.5 text-gold" />
            <span className="font-mono-terminal text-[10px] uppercase tracking-[0.3em] text-white/50">
              Open Chambers
            </span>
            <span className="font-mono-terminal text-[9px] text-white/30">
              ({lobbies.length} active)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lobbies.slice(0, 9).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={async () => {
                  if (!profile) return;
                  sounds.click();
                  setBusy("join");
                  try {
                    if (
                      r.prosecutorId !== profile.id &&
                      r.defendantId !== profile.id
                    ) {
                      if (!r.prosecutorId || r.prosecutorIsAI) {
                        await rooms.update(r.id, {
                          prosecutorId: profile.id,
                          prosecutorName: profile.username,
                          prosecutorIsAI: false,
                        });
                      } else if (!r.defendantId || r.defendantIsAI) {
                        await rooms.update(r.id, {
                          defendantId: profile.id,
                          defendantName: profile.username,
                          defendantIsAI: false,
                        });
                      }
                    }
                    onEnterRoom(r.id);
                  } finally {
                    setBusy(null);
                  }
                }}
                className={cn(
                  "group sharp flex items-center justify-between gap-3 border bg-gradient-to-r from-white/[0.03] to-transparent px-4 py-2.5 transition-all",
                  r.matchmakingType === "ranked"
                    ? "border-red-500/30 hover:border-red-500 hover:shadow-[0_0_18px_-6px_rgba(224,82,74,0.6)]"
                    : "border-white/15 hover:border-gold hover:shadow-[0_0_18px_-6px_var(--gold)]",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-glow-gold font-mono-terminal text-base font-black tracking-[0.35em] text-gold">
                    {r.code}
                  </span>
                  <span
                    className={cn(
                      "sharp border px-1.5 py-0.5 font-mono-terminal text-[8px] font-bold uppercase tracking-widest",
                      r.matchmakingType === "ranked"
                        ? "border-red-500/40 text-red-400"
                        : "border-white/15 text-white/50",
                    )}
                  >
                    {r.matchmakingType === "ranked" ? "RANKED" : "CASUAL"}
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-white/30 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-gold" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Spectate ongoing trials */}
      {ongoing.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-gold" />
            <span className="font-mono-terminal text-[10px] uppercase tracking-[0.3em] text-white/50">
              Spectate Live Trials
            </span>
            <span className="font-mono-terminal text-[9px] text-white/30">
              ({ongoing.length} in session)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ongoing.slice(0, 9).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  if (!profile) return;
                  sounds.click();
                  onEnterRoom(r.id);
                }}
                className="group sharp flex items-center justify-between gap-3 border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.04] to-transparent px-4 py-2.5 transition-all hover:border-emerald-500 hover:shadow-[0_0_18px_-6px_rgba(63,185,138,0.5)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-glow-gold font-mono-terminal text-base font-black tracking-[0.35em] text-gold">
                    {r.code}
                  </span>
                  <span className="sharp border border-emerald-500/40 bg-emerald-500/5 px-1.5 py-0.5 font-mono-terminal text-[8px] font-bold uppercase tracking-widest text-emerald-400">
                    {PHASE_LABEL[r.phase] ?? "Live"}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono-terminal text-[9px] uppercase tracking-widest text-white/40">
                  <span className="hidden truncate sm:inline">
                    {r.prosecutorName ?? "—"} v. {r.defendantName ?? "—"}
                  </span>
                  <Eye className="h-3.5 w-3.5 -translate-x-1 text-white/40 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-emerald-400" />
                </div>
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono-terminal text-[9px] uppercase tracking-widest text-white/25">
            Spectators observe without taking a counsel slot.
          </p>
        </div>
      )}

      <p className="font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
        Data layer:{" "}
        <span
          className={cn(
            DATA_MODE === "supabase" ? "text-emerald-400" : "text-amber-400",
          )}
        >
          {DATA_MODE === "supabase" ? "SUPABASE LIVE" : "LOCAL MOCK"}
        </span>
      </p>

      <CreateRoomModal open={createOpen} onOpenChange={setCreateOpen} onCreated={onEnterRoom} />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      {profile?.isAdmin && (
        <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} />
      )}
    </section>
  );
}
