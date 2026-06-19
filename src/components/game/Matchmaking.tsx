"use client";
// ===== Matchmaking Core (v2: setup options + settings + admin) =====
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "./AvatarCustomizer";
import { CreateRoomModal } from "./CreateRoomModal";
import { SettingsModal } from "./SettingsModal";
import { AdminPanel } from "./AdminPanel";
import { useAuth } from "@/hooks/use-auth";
import { rooms, DATA_MODE } from "@/lib/api";
import { generateChamberCode, normalizeCode, isValidChamberCode } from "@/lib/codec";
import { randomScenarioId } from "@/lib/data/cases";
import { newRoom } from "@/lib/room";
import { toast } from "sonner";
import {
  Gavel,
  LogIn,
  Plus,
  Swords,
  Cpu,
  ArrowRight,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RANKED_STATEMENT_COUNT } from "@/lib/types";
import type { Room } from "@/lib/types";

export function Matchmaking({ onEnterRoom }: { onEnterRoom: (id: string) => void }) {
  const { profile } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lobbies, setLobbies] = useState<Room[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  async function refreshLobbies() {
    try {
      setLobbies(await rooms.listRecentLobbies());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshLobbies();
    const iv = setInterval(refreshLobbies, 5000);
    return () => clearInterval(iv);
  }, []);

  async function quickCreate() {
    if (!profile) return;
    setBusy("create");
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
        caseTheme: "cyber",
        phase: "lobby",
      });
      await rooms.create(room);
      toast.success(`Chamber ${room.code} provisioned.`);
      onEnterRoom(room.id);
    } catch {
      toast.error("Failed to provision chamber.");
    } finally {
      setBusy(null);
    }
  }

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
      const open = await rooms.findOpenRankedRoom();
      if (open && open.prosecutorId !== profile.id) {
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
          caseTheme: "cyber",
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
        caseTheme: "cyber",
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
      onClick: () => setCreateOpen(true),
      tone: "gold" as const,
    },
    {
      id: "join",
      icon: LogIn,
      title: "Join Custom Chamber",
      desc: "Punch in an active code to enter a pending trial.",
      onClick: joinCustom,
      tone: "white" as const,
    },
    {
      id: "ranked",
      icon: Swords,
      title: "Ranked Matchmaking Queue",
      desc: `Skill-based competitive queue. ${RANKED_STATEMENT_COUNT} statements, AI assist blocked.`,
      onClick: rankedQueue,
      tone: "crimson" as const,
    },
    {
      id: "practice",
      icon: Cpu,
      title: "Practice vs AI",
      desc: "Solo drill against AI defense counsel. No Elo risk.",
      onClick: practiceVsAI,
      tone: "white" as const,
    },
  ];

  return (
    <section className="panel sharp flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <Header
          index="04"
          title="Matchmaking Core"
          subtitle="Select your entry vector"
        />
        <div className="flex items-center gap-2">
          {profile?.isAdmin && (
            <Button
              onClick={() => setAdminOpen(true)}
              variant="ghost"
              size="icon"
              className="sharp h-9 w-9 border border-gold/50 text-gold hover:bg-gold hover:text-black"
              title="Admin panel"
            >
              <Shield className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={() => setSettingsOpen(true)}
            variant="ghost"
            size="icon"
            className="sharp h-9 w-9 border border-white/20 text-white/60 hover:text-white"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              onClick={a.onClick}
              disabled={busy !== null}
              className={cn(
                "group panel-2 sharp flex flex-col gap-3 p-4 text-left transition disabled:opacity-40",
                a.tone === "gold" && "border-gold/40 hover:border-gold hover:bg-gold/5",
                a.tone === "white" && "hover:border-white/50 hover:bg-white/[0.04]",
                a.tone === "crimson" && "border-red-500/30 hover:border-red-500/70 hover:bg-red-500/5",
              )}
            >
              <div className="flex items-center justify-between">
                <Icon
                  className={cn(
                    "h-6 w-6",
                    a.tone === "gold" && "text-gold",
                    a.tone === "white" && "text-white/70",
                    a.tone === "crimson" && "text-red-400",
                  )}
                />
                {busy === a.id && (
                  <span className="font-mono-terminal text-[9px] uppercase tracking-widest text-gold animate-pulse">
                    ...
                  </span>
                )}
              </div>
              <div>
                <div className="font-mono-terminal text-xs font-bold uppercase tracking-[0.15em] text-white">
                  {a.title}
                </div>
                <p className="mt-1 font-mono-terminal text-[10px] leading-relaxed text-white/40">
                  {a.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* join code input row */}
      <div className="panel-2 sharp flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block font-mono-terminal text-[10px] uppercase tracking-[0.25em] text-white/50">
            Chamber Code
          </label>
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") joinCustom();
            }}
            placeholder="ABCD"
            className="sharp border-white/20 bg-black font-mono-terminal text-2xl font-bold tracking-[0.5em] text-gold placeholder:text-white/15 focus-visible:border-gold"
          />
        </div>
        <Button
          onClick={joinCustom}
          disabled={busy !== null}
          className="sharp h-11 border border-white/30 bg-transparent font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-white hover:bg-white hover:text-black"
        >
          Enter Chamber
        </Button>
      </div>

      {/* recent open lobbies */}
      {lobbies.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Gavel className="h-3 w-3 text-gold" />
            <span className="font-mono-terminal text-[10px] uppercase tracking-[0.25em] text-white/40">
              Open Chambers
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lobbies.slice(0, 8).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={async () => {
                  if (!profile) return;
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
                className="sharp flex items-center gap-2 border border-white/15 px-3 py-1.5 font-mono-terminal text-[10px] text-white/60 transition hover:border-gold hover:text-gold"
              >
                <span className="font-bold tracking-[0.3em]">{r.code}</span>
                <span className="text-white/30">
                  {r.matchmakingType === "ranked" ? "RANKED" : "CASUAL"}
                </span>
                <ArrowRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
        Data layer:{" "}
        <span className={DATA_MODE === "supabase" ? "text-emerald-400" : "text-amber-400"}>
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
