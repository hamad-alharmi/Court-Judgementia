"use client";
// ===== Phase: Courtroom — split-screen trial =====
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceVault } from "./EvidenceVault";
import { Portrait } from "./Portrait";
import { useGameRoom } from "@/hooks/use-game-room";
import { useAuth } from "@/hooks/use-auth";
import { profiles } from "@/lib/api";
import { getScenarioById, CASE_SCENARIOS } from "@/lib/data/cases";
import { tierForElo } from "@/lib/data/ranks";
import { resolveElo, didProsecutorWin } from "@/lib/elo";
import { generateAIArgument, simulateJuryVotes } from "@/lib/automation";
import { TURN_DURATION, CHAR_LIMIT } from "@/lib/types";
import type { EvidenceItem, GameState, Room } from "@/lib/types";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Cpu,
  Gavel,
  Play,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Courtroom({
  roomId,
  onLeave,
  onRematch,
}: {
  roomId: string;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const { room, loading, update } = useGameRoom(roomId);
  const { profile, applyResult, refresh } = useAuth();

  const [text, setText] = useState("");
  const [presentedIds, setPresentedIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [judging, setJudging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<Set<string>>(new Set());
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenario = room ? getScenarioById(room.scenarioId) : undefined;

  const isHost = !!room && !!profile && room.hostId === profile.id;
  const myRole: "prosecutor" | "defendant" | "spectator" = useMemo(() => {
    if (!room || !profile) return "spectator";
    if (room.prosecutorId === profile.id) return "prosecutor";
    if (room.defendantId === profile.id) return "defendant";
    return "spectator";
  }, [room, profile]);

  const isMyTurn =
    !!room &&
    ((room.phase === "prosecutor_turn" && myRole === "prosecutor") ||
      (room.phase === "defendant_turn" && myRole === "defendant"));

  const currentTurnIsAI =
    !!room &&
    ((room.phase === "prosecutor_turn" && room.prosecutorIsAI) ||
      (room.phase === "defendant_turn" && room.defendantIsAI));

  const remaining = room?.gameState.turnStartedAt
    ? Math.max(0, TURN_DURATION - Math.floor((now - room.gameState.turnStartedAt) / 1000))
    : TURN_DURATION;

  // ----- timer tick during active turns -----
  useEffect(() => {
    if (!room) return;
    if (room.phase !== "prosecutor_turn" && room.phase !== "defendant_turn") return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [room?.phase, room]);

  // ----- when my turn begins, load my draft + presented evidence -----
  useEffect(() => {
    if (!room || !isMyTurn) return;
    const draft =
      myRole === "prosecutor"
        ? room.gameState.prosecutorDraft
        : room.gameState.defendantDraft;
    const evs =
      myRole === "prosecutor"
        ? room.gameState.prosecutorEvidence
        : room.gameState.defendantEvidence;
    setText(draft || "");
    setPresentedIds(evs || []);
    doneRef.current.delete(`submit-${room.phase}`);
  }, [room?.phase, isMyTurn]);

  // ----- debounced live draft sync (only when it's my turn) -----
  useEffect(() => {
    if (!isMyTurn || !room) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(async () => {
      const key = myRole === "prosecutor" ? "prosecutorDraft" : "defendantDraft";
      const fresh = await profiles_getRoom(roomId);
      if (!fresh) return;
      await update({
        gameState: { ...fresh.gameState, [key]: text } as GameState,
      });
    }, 1200);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [text, isMyTurn]);

  // ----- auto-submit on timeout (only the active human owner) -----
  useEffect(() => {
    if (!isMyTurn || !room) return;
    if (remaining > 0) return;
    const key = `submit-${room.phase}`;
    if (doneRef.current.has(key)) return;
    handleSubmit(text);
  }, [remaining, isMyTurn, room]);

  // ----- AI turn auto-action (host owns) -----
  useEffect(() => {
    if (!isHost || !room || !scenario) return;
    if (!currentTurnIsAI) return;
    const key = `ai-${room.phase}`;
    if (doneRef.current.has(key)) return;
    const timer = setTimeout(() => {
      runAITurn();
    }, 7000);
    return () => clearTimeout(timer);
  }, [room?.phase, isHost, currentTurnIsAI, room]);

  // ----- jury simulation (host owns) -----
  useEffect(() => {
    if (!isHost || !room) return;
    if (room.phase !== "jury_voting") return;
    if (room.gameState.juryVotes.length > 0) return;
    if (doneRef.current.has("jury")) return;
    const timer = setTimeout(() => runJury(), 2800);
    return () => clearTimeout(timer);
  }, [room?.phase, isHost, room]);

  // ----- verdict + elo (host owns) -----
  useEffect(() => {
    if (!isHost || !room) return;
    if (room.phase !== "verdict") return;
    if (room.gameState.verdict) return;
    if (room.gameState.eloApplied) return;
    if (doneRef.current.has("verdict")) return;
    runJudge();
  }, [room?.phase, isHost, room]);

  // ===== actions =====
  const handleSubmit = useCallback(
    async (finalText: string) => {
      if (!room) return;
      const key = `submit-${room.phase}`;
      if (doneRef.current.has(key)) return;
      doneRef.current.add(key);
      const isP = room.phase === "prosecutor_turn";
      const gs = room.gameState;
      const nextGs: GameState = {
        ...gs,
        ...(isP
          ? {
              prosecutorText: finalText,
              prosecutorEvidence: [...presentedIds],
              prosecutorDraft: "",
            }
          : {
              defendantText: finalText,
              defendantEvidence: [...presentedIds],
              defendantDraft: "",
            }),
        turnStartedAt: isP ? Date.now() : null,
        turnTimerRemaining: isP ? TURN_DURATION : 0,
      };
      await update({
        gameState: nextGs,
        phase: isP ? "defendant_turn" : "jury_voting",
      });
      setText("");
      toast.success(isP ? "Prosecution argument filed." : "Defense argument filed.");
    },
    [room, presentedIds, update],
  );

  async function runAITurn() {
    if (!room || !scenario) return;
    const key = `ai-${room.phase}`;
    if (doneRef.current.has(key)) return;
    doneRef.current.add(key);
    const isP = room.phase === "prosecutor_turn";
    const role = isP ? "prosecutor" : "defendant";
    const argText = generateAIArgument(role, scenario, scenario.evidence, room.matchmakingType === "ranked");
    // AI favors evidence on its side
    const favored = scenario.evidence.filter((e) =>
      isP ? e.side !== "defense" : e.side !== "prosecution",
    );
    const aiEvs = (favored.slice(0, 2).map((e) => e.id));
    const gs = room.gameState;
    const nextGs: GameState = {
      ...gs,
      ...(isP
        ? {
            prosecutorText: argText,
            prosecutorEvidence: aiEvs,
            prosecutorDraft: "",
          }
        : {
            defendantText: argText,
            defendantEvidence: aiEvs,
            defendantDraft: "",
          }),
      turnStartedAt: isP ? Date.now() : null,
      turnTimerRemaining: isP ? TURN_DURATION : 0,
    };
    await update({
      gameState: nextGs,
      phase: isP ? "defendant_turn" : "jury_voting",
    });
    toast.info(`${isP ? "Prosecution" : "Defense"} AI counsel has filed.`);
  }

  async function runJury() {
    if (!room) return;
    if (doneRef.current.has("jury")) return;
    doneRef.current.add("jury");
    const gs = room.gameState;
    const { guilty, notGuilty, votes } = simulateJuryVotes(
      gs.prosecutorText,
      gs.defendantText,
      gs.prosecutorEvidence.length,
      gs.defendantEvidence.length,
    );
    await update({
      gameState: { ...gs, guiltyVotes: guilty, notGuiltyVotes: notGuilty, juryVotes: votes },
      phase: "verdict",
    });
  }

  async function runJudge() {
    if (!room || !scenario || !profile) return;
    if (doneRef.current.has("verdict")) return;
    doneRef.current.add("verdict");
    setJudging(true);
    try {
      const gs = room.gameState;
      const pEv = scenario.evidence.filter((e) => gs.prosecutorEvidence.includes(e.id));
      const dEv = scenario.evidence.filter((e) => gs.defendantEvidence.includes(e.id));

      const pProfile = room.prosecutorId && !room.prosecutorIsAI ? await profiles.get(room.prosecutorId) : null;
      const dProfile = room.defendantId && !room.defendantIsAI ? await profiles.get(room.defendantId) : null;
      const pElo = pProfile?.elo ?? 1000;
      const dElo = dProfile?.elo ?? 1000;

      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          prosecutorText: gs.prosecutorText,
          defendantText: gs.defendantText,
          prosecutorEvidence: pEv,
          defendantEvidence: dEv,
          ranked: room.matchmakingType === "ranked",
          juryVotes: { guilty: gs.guiltyVotes, notGuilty: gs.notGuiltyVotes },
          prosecutorElo: pElo,
          defendantElo: dElo,
        }),
      });
      if (!res.ok) throw new Error("judge-failed");
      const data = await res.json();
      const verdict = data.verdict;
      const eloAdj = data.eloAdjustments;

      // store verdict
      await update({
        gameState: { ...gs, verdict },
      });

      // apply elo + stats to both human profiles
      const prosecutWon = didProsecutorWin(verdict.verdict);
      if (pProfile) {
        const adj = eloAdj.prosecutor;
        const won = prosecutWon;
        await profiles.update(pProfile.id, {
          elo: adj.newElo,
          rank: tierForElo(adj.newElo),
          casesTried: pProfile.casesTried + 1,
          convictions: pProfile.convictions + (won ? 1 : 0),
          acquittals: pProfile.acquittals + (won ? 0 : 0),
          wins: pProfile.wins + (won ? 1 : 0),
          losses: pProfile.losses + (won ? 0 : 1),
          judgeFavorability: clamp(
            pProfile.judgeFavorability + (won ? Math.round(verdict.decisiveness / 18) : -Math.round(verdict.decisiveness / 22)),
            0,
            100,
          ),
        });
        if (pProfile.id === profile.id) await applyResult({});
      }
      if (dProfile) {
        const adj = eloAdj.defendant;
        const won = !prosecutWon;
        await profiles.update(dProfile.id, {
          elo: adj.newElo,
          rank: tierForElo(adj.newElo),
          casesTried: dProfile.casesTried + 1,
          acquittals: dProfile.acquittals + (won ? 1 : 0),
          convictions: dProfile.convictions,
          wins: dProfile.wins + (won ? 1 : 0),
          losses: dProfile.losses + (won ? 0 : 1),
          judgeFavorability: clamp(
            dProfile.judgeFavorability + (won ? Math.round(verdict.decisiveness / 18) : -Math.round(verdict.decisiveness / 22)),
            0,
            100,
          ),
        });
        if (dProfile.id === profile.id) await applyResult({});
      }
      // mark elo applied
      const fresh = await profiles_getRoom(roomId);
      if (fresh) {
        await update({ gameState: { ...fresh.gameState, eloApplied: true } });
      }
      await refresh();
    } catch (e) {
      console.error("judge failed", e);
      toast.error("Chief Justice Vanguard failed to render a decree.");
    } finally {
      setJudging(false);
    }
  }

  // ===== evidence injection =====
  function presentEvidence(e: EvidenceItem) {
    const exhibit = `\n\n— [EXHIBIT: "${e.title}" | ${e.assetType}] —\n${e.description}\n`;
    const ta = textareaRef.current;
    if (!ta) {
      setText((t) => (t + exhibit).slice(0, CHAR_LIMIT + 600));
    } else {
      const start = ta.selectionStart ?? text.length;
      const end = ta.selectionEnd ?? text.length;
      const next = (text.slice(0, start) + exhibit + text.slice(end)).slice(0, CHAR_LIMIT + 600);
      setText(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + exhibit.length;
        ta.setSelectionRange(pos, pos);
      });
    }
    setPresentedIds((prev) => (prev.includes(e.id) ? prev : [...prev, e.id]));
    toast.success(`Exhibit "${e.title}" injected at cursor.`);
  }

  // ===== lobby host controls =====
  async function hostToggleOpponentAI() {
    if (!room || !isHost) return;
    const ai = !room.defendantIsAI;
    await update({
      defendantId: ai ? "ai-defendant" : null,
      defendantName: ai ? "Counsel-7 (AI)" : null,
      defendantIsAI: ai,
    });
  }
  async function hostCycleScenario() {
    if (!room || !isHost) return;
    const idx = CASE_SCENARIOS.findIndex((c) => c.id === room.scenarioId);
    const next = CASE_SCENARIOS[(idx + 1) % CASE_SCENARIOS.length];
    await update({ scenarioId: next.id });
  }
  async function hostStartTrial() {
    if (!room || !isHost) return;
    if (!room.defendantId) {
      toast.error("Defendant slot is empty.");
      return;
    }
    doneRef.current.clear();
    await update({
      phase: "prosecutor_turn",
      gameState: { ...room.gameState, turnStartedAt: Date.now(), turnTimerRemaining: TURN_DURATION },
    });
    toast.success("Trial in session.");
  }

  function shareChamber() {
    if (!room) return;
    const url = `${window.location.origin}/?chamber=${room.code}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Chamber link copied to clipboard."),
      () => toast.error("Clipboard unavailable. Code: " + room.code),
    );
  }

  // ===== render =====
  if (loading || !room || !scenario || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="font-mono-terminal text-sm text-white/40 animate-pulse">
          Convening chamber...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <CourtHeader
        room={room}
        onLeave={onLeave}
        onShare={shareChamber}
        judging={judging}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-4">
        <PhaseTracker phase={room.phase} />

        {room.phase === "lobby" ? (
          <LobbyView
            room={room}
            scenario={scenario}
            isHost={isHost}
            myRole={myRole}
            onToggleAI={hostToggleOpponentAI}
            onCycleScenario={hostCycleScenario}
            onStart={hostStartTrial}
            onShare={shareChamber}
          />
        ) : room.phase === "verdict" && room.gameState.verdict ? (
          <VerdictView
            room={room}
            scenario={scenario}
            myRole={myRole}
            onLeave={onLeave}
            onRematch={onRematch}
          />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr]">
            {/* LEFT 65% — active courtroom */}
            <section className="panel sharp flex flex-col gap-4 p-4">
              <TrialHeader room={room} scenario={scenario} myRole={myRole} />
              <TurnTimerBar remaining={remaining} phase={room.phase} judging={judging} />

              <ArgumentDisplay
                room={room}
                scenario={scenario}
                myRole={myRole}
                isMyTurn={isMyTurn}
                text={text}
              />

              {isMyTurn ? (
                <ArgumentInput
                  textareaRef={textareaRef}
                  value={text}
                  onChange={(v) => setText(v.slice(0, CHAR_LIMIT + 600))}
                  onSubmit={() => handleSubmit(text)}
                  disabled={judging}
                  role={myRole}
                />
              ) : (
                <WaitingPanel
                  room={room}
                  myRole={myRole}
                  currentTurnIsAI={currentTurnIsAI}
                />
              )}
            </section>

            {/* RIGHT 35% — evidence vault */}
            <EvidenceVault
              evidence={scenario.evidence}
              canPresent={isMyTurn}
              presentedIds={
                room.phase === "prosecutor_turn"
                  ? room.gameState.prosecutorEvidence
                  : room.phase === "defendant_turn"
                    ? [...room.gameState.prosecutorEvidence, ...presentedIds]
                    : [
                        ...room.gameState.prosecutorEvidence,
                        ...room.gameState.defendantEvidence,
                      ]
              }
              onPresent={presentEvidence}
            />
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-white/10 bg-black px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
          <span>Chamber {room.code} · {room.matchmakingType}</span>
          <span>Chief Justice Vanguard presiding</span>
        </div>
      </footer>
    </div>
  );
}

// helper to fetch fresh room inside effects without stale closure
async function profiles_getRoom(id: string): Promise<Room | null> {
  const { rooms } = await import("@/lib/api");
  return rooms.get(id);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ============ SUB COMPONENTS ============

function CourtHeader({
  room,
  onLeave,
  onShare,
  judging,
}: {
  room: Room;
  onLeave: () => void;
  onShare: () => void;
  judging: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Button
            onClick={onLeave}
            variant="ghost"
            size="sm"
            className="sharp h-8 border border-white/15 px-2 text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="font-mono-terminal text-[10px] uppercase tracking-widest">Exit</span>
          </Button>
          <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            <Gavel className="h-4 w-4 text-gold" />
            <div>
              <div className="font-mono-terminal text-xs font-bold uppercase tracking-[0.2em] text-white">
                Chamber {room.code}
              </div>
              <div className="font-mono-terminal text-[8px] uppercase tracking-[0.25em] text-white/35">
                {room.matchmakingType === "ranked" ? "Ranked · Elo at stake" : "Casual"}
              </div>
            </div>
          </div>
          {judging && (
            <div className="flex items-center gap-1.5 border border-gold/40 bg-gold/5 px-2 py-1">
              <RefreshCw className="h-3 w-3 animate-spin text-gold" />
              <span className="font-mono-terminal text-[9px] uppercase tracking-widest text-gold">
                Vanguard deliberating...
              </span>
            </div>
          )}
        </div>
        <Button
          onClick={onShare}
          variant="ghost"
          size="sm"
          className="sharp h-8 border border-gold/40 px-3 text-gold hover:bg-gold hover:text-black"
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="font-mono-terminal text-[10px] uppercase tracking-widest">Share</span>
        </Button>
      </div>
    </header>
  );
}

function PhaseTracker({ phase }: { phase: Room["phase"] }) {
  const steps: { id: Room["phase"]; label: string }[] = [
    { id: "lobby", label: "Lobby" },
    { id: "prosecutor_turn", label: "Prosecution" },
    { id: "defendant_turn", label: "Defense" },
    { id: "jury_voting", label: "Jury" },
    { id: "verdict", label: "Verdict" },
  ];
  const activeIdx = steps.findIndex((s) => s.id === phase);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.id} className="flex items-center gap-1">
            <div
              className={cn(
                "sharp flex items-center gap-1.5 border px-2.5 py-1 font-mono-terminal text-[9px] uppercase tracking-widest transition",
                active && "border-gold bg-gold/15 text-gold glow-gold",
                done && "border-white/20 text-white/40",
                !active && !done && "border-white/10 text-white/25",
              )}
            >
              <span className="text-[8px]">{String(i + 1).padStart(2, "0")}</span>
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px w-4", done ? "bg-white/30" : "bg-white/10")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrialHeader({
  room,
  scenario,
  myRole,
}: {
  room: Room;
  scenario: ReturnType<typeof getScenarioById>;
  myRole: string;
}) {
  if (!scenario) return null;
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 pb-3">
      <div>
        <div className="font-mono-terminal text-[9px] uppercase tracking-[0.25em] text-gold">
          Case File
        </div>
        <h2 className="font-mono-terminal text-base font-bold text-white sm:text-lg">
          {scenario.title}
        </h2>
        <p className="mt-1 font-mono-terminal text-[11px] leading-relaxed text-white/50">
          {scenario.facts}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CounselCard
          role="prosecution"
          name={room.prosecutorName ?? "—"}
          isAI={room.prosecutorIsAI}
          isMe={myRole === "prosecutor"}
        />
        <CounselCard
          role="defense"
          name={room.defendantName ?? "Awaiting..."}
          isAI={room.defendantIsAI}
          isMe={myRole === "defendant"}
        />
      </div>
    </div>
  );
}

function CounselCard({
  role,
  name,
  isAI,
  isMe,
}: {
  role: "prosecution" | "defense";
  name: string;
  isAI: boolean;
  isMe: boolean;
}) {
  const isP = role === "prosecution";
  return (
    <div
      className={cn(
        "sharp flex items-center gap-3 border p-3",
        isP ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="h-12 w-12 shrink-0 border border-white/15">
        <Portrait
          archetype={isAI ? "warden" : isP ? "inquisitor" : "advocate"}
          accent={isP ? "crimson" : "jade"}
          size={48}
        />
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            "font-mono-terminal text-[9px] uppercase tracking-[0.2em]",
            isP ? "text-red-400" : "text-emerald-400",
          )}
        >
          {isP ? "Prosecution" : "Defense"}
        </div>
        <div className="truncate font-mono-terminal text-xs font-bold text-white">
          {name}
        </div>
        <div className="flex items-center gap-1.5 font-mono-terminal text-[8px] uppercase tracking-widest text-white/35">
          {isAI && (
            <span className="flex items-center gap-0.5 text-gold">
              <Cpu className="h-2.5 w-2.5" /> AI
            </span>
          )}
          {isMe && <span className="text-gold">◂ YOU</span>}
        </div>
      </div>
    </div>
  );
}

function TurnTimerBar({
  remaining,
  phase,
  judging,
}: {
  remaining: number;
  phase: Room["phase"];
  judging: boolean;
}) {
  const active = phase === "prosecutor_turn" || phase === "defendant_turn";
  const pct = active ? (remaining / TURN_DURATION) * 100 : phase === "jury_voting" ? 100 : 0;
  const danger = remaining <= 15;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 font-mono-terminal text-[10px] uppercase tracking-widest text-white/40">
        <Timer className={cn("h-3.5 w-3.5", danger && active && "text-red-400 animate-pulse")} />
        {phase === "jury_voting"
          ? "Jury Deliberating"
          : phase === "verdict"
            ? judging
              ? "Vanguard Deliberating"
              : "Decree"
            : active
              ? `${remaining}s remaining`
              : "Idle"}
      </div>
      <div className="relative h-2 flex-1 border border-white/10 bg-white/5">
        <div
          className={cn(
            "h-full transition-[width] duration-300",
            phase === "jury_voting" || judging
              ? "bg-gold animate-pulse"
              : danger
                ? "bg-red-500"
                : "bg-gold",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ArgumentDisplay({
  room,
  myRole,
  isMyTurn,
  text,
}: {
  room: Room;
  scenario: ReturnType<typeof getScenarioById>;
  myRole: string;
  isMyTurn: boolean;
  text: string;
}) {
  const gs = room.gameState;
  return (
    <div className="flex flex-col gap-3">
      {/* Prosecution speech */}
      <SpeechBlock
        role="prosecution"
        name={room.prosecutorName ?? "Prosecution"}
        text={gs.prosecutorText}
        draft={gs.prosecutorDraft}
        isMine={myRole === "prosecutor"}
        showDraft={room.phase === "prosecutor_turn" && myRole !== "prosecutor"}
      />
      {/* Defense speech */}
      <SpeechBlock
        role="defense"
        name={room.defendantName ?? "Defense"}
        text={gs.defendantText}
        draft={gs.defendantDraft}
        isMine={myRole === "defendant"}
        showDraft={
          room.phase === "defendant_turn" && myRole !== "defendant" && !room.defendantIsAI
        }
      />
      {/* my live text preview */}
      {isMyTurn && text.trim() && (
        <div className="border border-dashed border-gold/30 bg-gold/5 p-2 font-mono-terminal text-[10px] text-gold/60">
          <span className="uppercase tracking-widest">Composing: </span>
          <span className="line-clamp-1">{text.slice(0, 120)}</span>
        </div>
      )}
    </div>
  );
}

function SpeechBlock({
  role,
  name,
  text,
  draft,
  isMine,
  showDraft,
}: {
  role: "prosecution" | "defense";
  name: string;
  text: string;
  draft: string;
  isMine: boolean;
  showDraft: boolean;
}) {
  const isP = role === "prosecution";
  const hasText = text.trim().length > 0;
  return (
    <div
      className={cn(
        "sharp border p-3",
        isP ? "border-red-500/25 bg-red-500/[0.03]" : "border-emerald-500/25 bg-emerald-500/[0.03]",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={cn(
            "font-mono-terminal text-[9px] font-bold uppercase tracking-[0.2em]",
            isP ? "text-red-400" : "text-emerald-400",
          )}
        >
          {name} {isMine && <span className="text-gold">◂ YOU</span>}
        </span>
        {hasText ? (
          <ShieldAlert className={cn("h-3 w-3", isP ? "text-red-400" : "text-emerald-400")} />
        ) : null}
      </div>
      {hasText ? (
        <p className="whitespace-pre-wrap font-mono-terminal text-[12px] leading-relaxed text-white/75">
          {text}
        </p>
      ) : showDraft && draft.trim() ? (
        <div>
          <p className="whitespace-pre-wrap font-mono-terminal text-[12px] leading-relaxed text-white/30 italic">
            {draft}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 font-mono-terminal text-[8px] uppercase tracking-widest text-white/30 animate-pulse">
            <span className="h-1.5 w-1.5 bg-white/40 animate-blink" /> composing
          </span>
        </div>
      ) : (
        <p className="font-mono-terminal text-[11px] italic text-white/25">
          {isP ? "Awaiting opening statement..." : "Awaiting defense response..."}
        </p>
      )}
    </div>
  );
}

function ArgumentInput({
  textareaRef,
  value,
  onChange,
  onSubmit,
  disabled,
  role,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  role: string;
}) {
  const overLimit = value.length > CHAR_LIMIT;
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
      <div className="flex items-center justify-between">
        <span className="font-mono-terminal text-[10px] uppercase tracking-[0.2em] text-gold">
          {role === "prosecutor" ? "Prosecution Argument" : "Defense Argument"}
        </span>
        <span
          className={cn(
            "font-mono-terminal text-[10px]",
            overLimit ? "text-red-400" : value.length > CHAR_LIMIT * 0.85 ? "text-amber-400" : "text-white/40",
          )}
        >
          {value.length}/{CHAR_LIMIT} chars
        </span>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Compose your argument in pristine English. Present evidence from the vault to strengthen your case..."
        className="sharp min-h-[160px] resize-y border-white/20 bg-black font-mono-terminal text-[13px] leading-relaxed text-white placeholder:text-white/20 focus-visible:border-gold"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono-terminal text-[9px] text-white/30">
          Auto-submits when the timer hits zero. Use [Present Evidence] to inject exhibits at your cursor.
        </p>
        <Button
          onClick={onSubmit}
          disabled={disabled}
          className="sharp h-10 border border-gold bg-gold px-6 font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-black hover:bg-gold/85"
        >
          <ScrollText className="h-4 w-4" />
          File Argument
        </Button>
      </div>
    </div>
  );
}

function WaitingPanel({
  room,
  myRole,
  currentTurnIsAI,
}: {
  room: Room;
  myRole: string;
  currentTurnIsAI: boolean;
}) {
  const activeRole =
    room.phase === "prosecutor_turn" ? "Prosecution" : room.phase === "defendant_turn" ? "Defense" : "";
  return (
    <div className="flex flex-col items-center justify-center gap-3 border-t border-white/10 py-10 text-center">
      {room.phase === "jury_voting" ? (
        <>
          <Users className="h-8 w-8 text-gold animate-pulse" />
          <p className="font-mono-terminal text-sm text-white/60">
            The jury of five is deliberating...
          </p>
        </>
      ) : (
        <>
          <div className="h-2 w-2 animate-blink bg-gold" />
          <p className="font-mono-terminal text-sm text-white/60">
            {currentTurnIsAI
              ? `${activeRole} AI counsel is preparing...`
              : `Awaiting ${activeRole}'s argument...`}
          </p>
          <p className="font-mono-terminal text-[10px] uppercase tracking-widest text-white/30">
            {myRole === "spectator" ? "Spectator mode" : "Your turn is next"}
          </p>
        </>
      )}
    </div>
  );
}

// ============ LOBBY ============
function LobbyView({
  room,
  scenario,
  isHost,
  myRole,
  onToggleAI,
  onCycleScenario,
  onStart,
  onShare,
}: {
  room: Room;
  scenario: NonNullable<ReturnType<typeof getScenarioById>>;
  isHost: boolean;
  myRole: string;
  onToggleAI: () => void;
  onCycleScenario: () => void;
  onStart: () => void;
  onShare: () => void;
}) {
  const ready = !!room.defendantId;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr]">
      <section className="panel sharp flex flex-col gap-5 p-5">
        <div className="border-b border-white/10 pb-3">
          <div className="font-mono-terminal text-[9px] uppercase tracking-[0.25em] text-gold">
            Pre-Trial Lobby
          </div>
          <h2 className="font-mono-terminal text-lg font-bold text-white">{scenario.title}</h2>
          <p className="mt-1 font-mono-terminal text-[11px] leading-relaxed text-white/50">
            {scenario.facts}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CounselCard
            role="prosecution"
            name={room.prosecutorName ?? "—"}
            isAI={room.prosecutorIsAI}
            isMe={myRole === "prosecutor"}
          />
          <CounselCard
            role="defense"
            name={room.defendantName ?? "Awaiting opponent"}
            isAI={room.defendantIsAI}
            isMe={myRole === "defendant"}
          />
        </div>

        {isHost ? (
          <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={onCycleScenario}
                variant="ghost"
                size="sm"
                className="sharp h-9 border border-white/20 text-white/70 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Cycle Case File
              </Button>
              <Button
                onClick={onToggleAI}
                variant="ghost"
                size="sm"
                className={cn(
                  "sharp h-9 border",
                  room.defendantIsAI
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-white/20 text-white/70 hover:text-white",
                )}
              >
                <Cpu className="h-3.5 w-3.5" />
                {room.defendantIsAI ? "AI Defense: ON" : "Fill with AI Defense"}
              </Button>
            </div>
            <Button
              onClick={onStart}
              disabled={!ready}
              className="sharp h-12 border border-gold bg-gold font-mono-terminal text-sm font-bold uppercase tracking-[0.3em] text-black hover:bg-gold/85 disabled:opacity-30"
            >
              <Play className="h-5 w-5" />
              Convene Trial
            </Button>
            {!ready && (
              <p className="text-center font-mono-terminal text-[10px] text-white/30">
                Defendant slot empty — fill with AI or share the chamber code.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 border-t border-white/10 pt-6">
            <div className="h-2 w-2 animate-blink bg-gold" />
            <p className="font-mono-terminal text-sm text-white/60">
              Waiting for the host to convene the trial...
            </p>
            <p className="font-mono-terminal text-[10px] uppercase tracking-widest text-white/30">
              Chamber code: {room.code}
            </p>
          </div>
        )}
      </section>

      <EvidenceVault
        evidence={scenario.evidence}
        canPresent={false}
        presentedIds={[]}
        onPresent={() => {}}
      />
    </div>
  );
}

// ============ VERDICT ============
function VerdictView({
  room,
  scenario,
  myRole,
  onLeave,
  onRematch,
}: {
  room: Room;
  scenario: NonNullable<ReturnType<typeof getScenarioById>>;
  myRole: string;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const v = room.gameState.verdict!;
  const guilty = v.verdict === "GUILTY";
  const iWon =
    (myRole === "prosecutor" && guilty) || (myRole === "defendant" && !guilty);
  const isSpectator = myRole === "spectator";

  return (
    <div className="mt-4 mx-auto w-full max-w-3xl">
      <div
        className={cn(
          "panel sharp glow-gold flex flex-col items-center gap-4 p-8 text-center",
          guilty ? "border-red-500/50" : "border-emerald-500/50",
        )}
      >
        <div className="font-mono-terminal text-[10px] uppercase tracking-[0.4em] text-white/40">
          Chief Justice Vanguard renders decree
        </div>
        <div
          className={cn(
            "text-glow-gold font-mono-terminal text-4xl font-black uppercase tracking-[0.2em] sm:text-6xl",
            guilty ? "text-red-400" : "text-emerald-400",
          )}
          style={!guilty ? { color: "#3fb98a", textShadow: "0 0 20px rgba(63,185,138,0.5)" } : {}}
        >
          {v.verdict}
        </div>

        {!isSpectator && (
          <div
            className={cn(
              "sharp border px-4 py-1.5 font-mono-terminal text-xs font-bold uppercase tracking-[0.25em]",
              iWon
                ? "border-gold bg-gold/10 text-gold"
                : "border-white/30 text-white/50",
            )}
          >
            {iWon ? "▲ Verdict in your favor" : "▼ Verdict against you"}
          </div>
        )}

        <div className="flex items-center gap-6 font-mono-terminal text-[10px] uppercase tracking-widest text-white/40">
          <span>
            Jury:{" "}
            <span className="text-red-400">{room.gameState.guiltyVotes}</span> /{" "}
            <span className="text-emerald-400">{room.gameState.notGuiltyVotes}</span>
          </span>
          <span>
            Decisiveness: <span className="text-gold">{v.decisiveness}/100</span>
          </span>
        </div>
      </div>

      <div className="panel sharp mt-4 flex flex-col gap-4 p-5">
        <VerdictSection label="Legal Reasoning" icon={ScrollText}>
          {v.reasoning}
        </VerdictSection>
        <VerdictSection label="Punishment Decree" icon={Gavel}>
          {v.punishment}
        </VerdictSection>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          onClick={onRematch}
          className="sharp h-11 border border-gold bg-gold px-8 font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-black hover:bg-gold/85"
        >
          <RefreshCw className="h-4 w-4" />
          New Trial
        </Button>
        <Button
          onClick={onLeave}
          variant="ghost"
          className="sharp h-11 border border-white/20 px-8 font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-white/70 hover:text-white"
        >
          Return to Terminal
        </Button>
      </div>
    </div>
  );
}

function VerdictSection({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-gold/40 pl-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-gold" />
        <span className="font-mono-terminal text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
          {label}
        </span>
      </div>
      <p className="whitespace-pre-wrap font-mono-terminal text-[12px] leading-relaxed text-white/70">
        {children}
      </p>
    </div>
  );
}
