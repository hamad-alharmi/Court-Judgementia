"use client";
// ===== Phase: Courtroom — multi-round split-screen trial (v2) =====
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceVault } from "./EvidenceVault";
import { Portrait } from "./Portrait";
import { CaseIntroOverlay } from "./CaseIntroOverlay";
import { LawlietEntrance } from "./LawlietEntrance";
import { ObjectionModal } from "./ObjectionModal";
import { useGameRoom } from "@/hooks/use-game-room";
import { useAuth } from "@/hooks/use-auth";
import { profiles, rooms } from "@/lib/api";
import { getScenarioById, CASE_SCENARIOS } from "@/lib/data/cases";
import { tierForElo } from "@/lib/data/ranks";
import { resolveElo, didProsecutorWin } from "@/lib/elo";
import {
  buildObjection as buildObjectionObj,
  generateAIArgument,
  heuristicObjection,
  maybeAIObjection,
  simulateJuryVotes,
} from "@/lib/automation";
import {
  TURN_DURATION,
  CHAR_LIMIT,
  OBJECTIONS_PER_SIDE,
  RANKED_STATEMENT_COUNT,
} from "@/lib/types";
import type {
  CaseScenario,
  EvidenceItem,
  GameState,
  Objection,
  Room,
  Statement,
} from "@/lib/types";
import { nextPhaseAfterStatement } from "@/lib/room";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Cpu,
  Gavel,
  Loader2,
  Play,
  RefreshCw,
  Siren,
  Users,
  Volume2,
  ScrollText,
  Sparkles,
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
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showLawliet, setShowLawliet] = useState(false);
  const [generatedScenario, setGeneratedScenario] = useState<CaseScenario | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<Set<string>>(new Set());
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPhaseSeen = useRef<string>("");

  // merge generated scenario with room's scenarioId
  const scenario = useMemo(() => {
    if (generatedScenario) return generatedScenario;
    return room ? getScenarioById(room.scenarioId) : undefined;
  }, [room, generatedScenario]);

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

  // ----- detect phase transition into case_intro → show Lawliet if admin -----
  useEffect(() => {
    if (!room) return;
    if (room.phase !== lastPhaseSeen.current) {
      const prev = lastPhaseSeen.current;
      lastPhaseSeen.current = room.phase;
      // entering case_intro from lobby
      if (room.phase === "case_intro" && prev === "lobby") {
        if (profile?.character === "lawliet" || profile?.isAdmin) {
          setShowLawliet(true);
        }
      }
    }
  }, [room?.phase, profile]);

  // ----- show case intro when phase is case_intro -----
  useEffect(() => {
    if (room?.phase === "case_intro" && scenario) {
      setShowIntro(true);
    } else {
      setShowIntro(false);
    }
  }, [room?.phase, scenario]);

  // ----- timer tick during active turns -----
  useEffect(() => {
    if (!room) return;
    if (room.phase !== "prosecutor_turn" && room.phase !== "defendant_turn") return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [room?.phase, room]);

  // ----- load my draft + presented evidence when my turn begins -----
  useEffect(() => {
    if (!room || !isMyTurn) return;
    const key = `turn-${room.phase}-${room.gameState.currentRound}`;
    if (doneRef.current.has(`${key}-loaded`)) return;
    doneRef.current.add(`${key}-loaded`);
    // load draft from current pending statement if any
    setText("");
    setPresentedIds([]);
  }, [room?.phase, room?.gameState?.currentRound, isMyTurn]);

  // ----- debounced live draft sync (only when it's my turn) -----
  useEffect(() => {
    if (!isMyTurn || !room) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(async () => {
      const fresh = await rooms.get(roomId);
      if (!fresh) return;
      const stmts = fresh.gameState.statements;
      // attach draft to the last in-progress statement (the current one)
      // store on gameState pendingDraft
      await update({
        gameState: { ...fresh.gameState, ...({ pendingDraft: text } as Partial<GameState>) } as GameState,
      });
    }, 1200);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [text, isMyTurn]);

  // ----- auto-submit on timeout -----
  useEffect(() => {
    if (!isMyTurn || !room) return;
    if (remaining > 0) return;
    const key = `submit-${room.phase}-${room.gameState.currentRound}`;
    if (doneRef.current.has(key)) return;
    handleSubmit(text);
  }, [remaining, isMyTurn, room]);

  // ----- AI turn auto-action (host owns) -----
  useEffect(() => {
    if (!isHost || !room || !scenario) return;
    if (!currentTurnIsAI) return;
    const key = `ai-${room.phase}-${room.gameState.currentRound}`;
    if (doneRef.current.has(key)) return;
    const timer = setTimeout(() => runAITurn(), 6000);
    return () => clearTimeout(timer);
  }, [room?.phase, room?.gameState?.currentRound, isHost, currentTurnIsAI, room]);

  // ----- AI objection (host owns): opposing AI may object after a human statement -----
  useEffect(() => {
    if (!isHost || !room) return;
    const gs = room.gameState;
    if (gs.statements.length === 0) return;
    const last = gs.statements[gs.statements.length - 1];
    // only object right after a human opponent's statement, during the AI's own turn
    const aiSide: "prosecutor" | "defense" | null =
      room.phase === "prosecutor_turn" && room.prosecutorIsAI
        ? "prosecutor"
        : room.phase === "defendant_turn" && room.defendantIsAI
          ? "defense"
          : null;
    if (!aiSide) return;
    if (last.side === aiSide) return; // don't object to own side
    if (last.authorIsAI) return; // don't object to AI statements
    const objKey = `aiobj-${last.id}`;
    if (doneRef.current.has(objKey)) return;
    const left = gs.objectionsLeft[aiSide];
    const maybe = maybeAIObjection(aiSide, room.aiDifficulty, gs.statements, left);
    if (!maybe) {
      doneRef.current.add(objKey);
      return;
    }
    doneRef.current.add(objKey);
    const timer = setTimeout(() => runObjection(aiSide, "AI Counsel", maybe.targetIndex, maybe.grounds, true), 3500);
    return () => clearTimeout(timer);
  }, [room?.gameState?.statements?.length, room?.phase, isHost, room]);

  // ----- jury simulation (host owns) -----
  useEffect(() => {
    if (!isHost || !room) return;
    if (room.phase !== "jury_voting") return;
    if (room.gameState.juryVotes.length > 0) return;
    if (doneRef.current.has("jury")) return;
    const timer = setTimeout(() => runJury(), 2500);
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

  // ===== AI CASE GENERATION (host owns, on trial start) =====
  async function generateCase(): Promise<CaseScenario | null> {
    if (!room) return null;
    setGenLoading(true);
    try {
      const theme = room.caseTheme || "cyber";
      const res = await fetch("/api/generate-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      if (!res.ok) throw new Error("gen-failed");
      const data = await res.json();
      const sc = data.scenario as CaseScenario;
      setGeneratedScenario(sc);
      // persist scenarioId so the other client fetches the same scenario
      await update({ scenarioId: sc.id });
      return sc;
    } catch (e) {
      console.error("case gen failed", e);
      toast.error("AI case generation failed — using preset.");
      return null;
    } finally {
      setGenLoading(false);
    }
  }

  // Since AI-generated cases aren't stored in CASE_SCENARIOS, both clients need
  // the scenario data. The host generates + stores scenarioId; the non-host
  // client fetches the generated case via the same API using a deterministic
  // seed. For simplicity, we store the full scenario in the room via a
  // side-channel: we use the scenarioId as a key and both clients call the API.
  // To keep this robust without a cases table, the non-host client regenerates
  // from the same theme. (Gemini is non-deterministic, so we instead fall back
  // to the preset scenarioId if it matches.)
  useEffect(() => {
    if (!room || !scenario) return;
    if (generatedScenario) return;
    // if the room's scenarioId isn't a preset and we're not the host, try to
    // fetch a generated case from the theme
    const isPreset = CASE_SCENARIOS.some((c) => c.id === room.scenarioId);
    if (!isPreset && !isHost && room.caseTheme) {
      // non-host: generate from same theme (best-effort; may differ from host's)
      generateCase();
    }
  }, [room?.scenarioId, room?.caseTheme, isHost]);

  // ===== actions =====
  const handleSubmit = useCallback(
    async (finalText: string) => {
      if (!room || !scenario) return;
      const key = `submit-${room.phase}-${room.gameState.currentRound}`;
      if (doneRef.current.has(key)) return;
      doneRef.current.add(key);
      const side = room.phase === "prosecutor_turn" ? "prosecutor" : "defense";
      const stmt: Statement = {
        id: "stmt-" + Math.random().toString(36).slice(2, 10),
        round: room.gameState.currentRound,
        side,
        text: finalText.trim() || "[No argument submitted.]",
        evidenceIds: [...presentedIds],
        objections: [],
        at: Date.now(),
        authorIsAI: false,
      };
      const nextStatements = [...room.gameState.statements, stmt];
      const nextPhase = nextPhaseAfterStatement(
        nextStatements.map((s) => ({ side: s.side, round: s.round })),
        room.statementCount,
      );
      const nextRound =
        nextPhase === "prosecutor_turn" && side === "defense"
          ? room.gameState.currentRound + 1
          : room.gameState.currentRound;
      const nextGs: GameState = {
        ...room.gameState,
        statements: nextStatements,
        currentRound: nextRound,
        turnStartedAt: nextPhase === "jury_voting" ? null : Date.now(),
        turnTimerRemaining: nextPhase === "jury_voting" ? 0 : TURN_DURATION,
      };
      await update({
        gameState: nextGs,
        phase: nextPhase,
      });
      setText("");
      setPresentedIds([]);
      toast.success(
        side === "prosecution"
          ? `Prosecution statement (R${stmt.round}) filed.`
          : `Defense statement (R${stmt.round}) filed.`,
      );
      // Lawliet TTS: read out the admin's own statement only
      if (profile?.character === "lawliet" || profile?.isAdmin) {
        speakStatement(finalText);
      }
    },
    [room, scenario, presentedIds, update, profile],
  );

  async function runAITurn() {
    if (!room || !scenario) return;
    const key = `ai-${room.phase}-${room.gameState.currentRound}`;
    if (doneRef.current.has(key)) return;
    doneRef.current.add(key);
    const side = room.phase === "prosecutor_turn" ? "prosecutor" : "defense";
    const argText = generateAIArgument(
      side,
      scenario,
      scenario.evidence,
      room.matchmakingType === "ranked",
      room.aiDifficulty,
      room.gameState.currentRound,
      room.statementCount,
      room.gameState.statements,
    );
    const favored = scenario.evidence.filter((e) =>
      side === "prosecution" ? e.side !== "defense" : e.side !== "prosecution",
    );
    const offset = (room.gameState.currentRound - 1) % Math.max(1, favored.length);
    const aiEvs = [favored[offset]?.id, favored[(offset + 1) % Math.max(1, favored.length)]?.id].filter(
      Boolean,
    ) as string[];
    const stmt: Statement = {
      id: "stmt-ai-" + Math.random().toString(36).slice(2, 10),
      round: room.gameState.currentRound,
      side,
      text: argText,
      evidenceIds: aiEvs,
      objections: [],
      at: Date.now(),
      authorIsAI: true,
    };
    const nextStatements = [...room.gameState.statements, stmt];
    const nextPhase = nextPhaseAfterStatement(
      nextStatements.map((s) => ({ side: s.side, round: s.round })),
      room.statementCount,
    );
    const nextRound =
      nextPhase === "prosecutor_turn" && side === "defense"
        ? room.gameState.currentRound + 1
        : room.gameState.currentRound;
    await update({
      gameState: {
        ...room.gameState,
        statements: nextStatements,
        currentRound: nextRound,
        turnStartedAt: nextPhase === "jury_voting" ? null : Date.now(),
        turnTimerRemaining: nextPhase === "jury_voting" ? 0 : TURN_DURATION,
      },
      phase: nextPhase,
    });
    toast.info(`${side === "prosecution" ? "Prosecution" : "Defense"} AI filed (R${stmt.round}).`);
  }

  async function runObjection(
    objectorSide: "prosecutor" | "defense",
    objectorName: string,
    targetIndex: number,
    grounds: string,
    isAI: boolean,
  ) {
    if (!room || !scenario) return;
    const left = room.gameState.objectionsLeft[objectorSide];
    if (left <= 0) {
      toast.error("No objections remaining.");
      return;
    }
    // call judge
    setJudging(true);
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "objection",
          scenario,
          statements: room.gameState.statements,
          allEvidence: scenario.evidence,
          objectorSide,
          targetIndex,
          grounds,
        }),
      });
      if (!res.ok) throw new Error("objection-failed");
      const data = await res.json();
      const ruling = data.ruling;
      // build objection object
      const obj: Objection = {
        id: "obj-" + Math.random().toString(36).slice(2, 10),
        objectorId: isAI ? "ai" : profile!.id,
        objectorName,
        objectorSide,
        targetIndex,
        grounds,
        ruling,
        at: Date.now(),
      };
      // attach to the targeted statement
      const fresh = await rooms.get(roomId);
      if (!fresh) return;
      const stmts = fresh.gameState.statements.map((s, i) =>
        i === targetIndex ? { ...s, objections: [...s.objections, obj] } : s,
      );
      await update({
        gameState: {
          ...fresh.gameState,
          statements: stmts,
          objectionsLeft: {
            ...fresh.gameState.objectionsLeft,
            [objectorSide]: left - 1,
          },
        },
      });
      toast(
        ruling.ruling === "SUSTAINED"
          ? `OBJECTION SUSTAINED — ${ruling.reasoning.slice(0, 80)}`
          : `OBJECTION OVERRULED — ${ruling.reasoning.slice(0, 80)}`,
        {
          description: ruling.reasoning,
          style: { borderColor: ruling.ruling === "SUSTAINED" ? "#3fb98a" : "#e0524a" },
        },
      );
    } catch (e) {
      console.error(e);
      // heuristic fallback
      const ruling = heuristicObjection(grounds);
      toast(`OBJECTION ${ruling.ruling} (heuristic)`);
    } finally {
      setJudging(false);
    }
  }

  async function runJury() {
    if (!room) return;
    if (doneRef.current.has("jury")) return;
    doneRef.current.add("jury");
    const gs = room.gameState;
    const { guilty, notGuilty, votes } = simulateJuryVotes(
      gs.statements,
      60,
      room.aiDifficulty,
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
      const pProfile = room.prosecutorId && !room.prosecutorIsAI ? await profiles.get(room.prosecutorId) : null;
      const dProfile = room.defendantId && !room.defendantIsAI ? await profiles.get(room.defendantId) : null;
      const pElo = pProfile?.elo ?? 1000;
      const dElo = dProfile?.elo ?? 1000;

      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verdict",
          scenario,
          statements: gs.statements,
          allEvidence: scenario.evidence,
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

      await update({ gameState: { ...gs, verdict } });

      const prosecutWon = didProsecutorWin(verdict.verdict);
      if (pProfile) {
        const adj = eloAdj.prosecutor;
        const won = prosecutWon;
        await profiles.update(pProfile.id, {
          elo: adj.newElo,
          rank: tierForElo(adj.newElo),
          casesTried: pProfile.casesTried + 1,
          convictions: pProfile.convictions + (won ? 1 : 0),
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
      const fresh = await rooms.get(roomId);
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

  // ===== TTS (Lawliet reads his own statement) =====
  async function speakStatement(statementText: string) {
    if (!statementText.trim()) return;
    setTtsPlaying(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: statementText.slice(0, 1000) }),
      });
      if (!res.ok) throw new Error("tts-failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      console.error("TTS failed", e);
    } finally {
      setTtsPlaying(false);
    }
  }

  // ===== lobby host controls =====
  async function hostToggleAIRole(role: "prosecution" | "defense") {
    if (!room || !isHost) return;
    if (role === "prosecution") {
      const ai = !room.prosecutorIsAI;
      await update({
        prosecutorId: ai ? null : profile?.id ?? null,
        prosecutorName: ai ? "AI Prosecution" : profile?.username ?? null,
        prosecutorIsAI: ai,
      });
    } else {
      const ai = !room.defendantIsAI;
      await update({
        defendantId: ai ? null : null,
        defendantName: ai ? "AI Defense" : null,
        defendantIsAI: ai,
      });
    }
  }

  async function hostTakeRole(role: "prosecution" | "defense") {
    if (!room || !isHost || !profile) return;
    if (role === "prosecution") {
      await update({
        prosecutorId: profile.id,
        prosecutorName: profile.username,
        prosecutorIsAI: false,
      });
    } else {
      await update({
        defendantId: profile.id,
        defendantName: profile.username,
        defendantIsAI: false,
      });
    }
  }

  async function hostCycleScenario() {
    if (!room || !isHost) return;
    const idx = CASE_SCENARIOS.findIndex((c) => c.id === room.scenarioId);
    const next = CASE_SCENARIOS[(idx + 1) % CASE_SCENARIOS.length];
    setGeneratedScenario(null);
    await update({ scenarioId: next.id, caseTheme: next.theme || "" });
  }

  async function hostStartTrial() {
    if (!room || !isHost || !profile) return;
    if (!room.defendantId && !room.defendantIsAI) {
      toast.error("Defendant slot is empty.");
      return;
    }
    if (!room.prosecutorId && !room.prosecutorIsAI) {
      toast.error("Prosecutor slot is empty.");
      return;
    }
    doneRef.current.clear();
    let sc = scenario;
    if (!sc) {
      sc = await generateCase();
    }
    // go to case_intro first (shows briefing + Lawliet entrance for admin)
    await update({
      phase: "case_intro",
    });
  }

  function beginTrialFromIntro() {
    setShowIntro(false);
    if (isHost) {
      update({
        phase: "prosecutor_turn",
        gameState: {
          ...(room?.gameState ?? emptyGs()),
          turnStartedAt: Date.now(),
          turnTimerRemaining: TURN_DURATION,
          currentRound: 1,
        },
      });
    }
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

  const myObjectionsLeft =
    myRole === "prosecutor" || myRole === "defendant"
      ? room.gameState.objectionsLeft[myRole]
      : 0;
  const canObject =
    (myRole === "prosecutor" || myRole === "defense") &&
    !isMyTurn &&
    room.gameState.statements.length > 0 &&
    myObjectionsLeft > 0 &&
    room.phase !== "jury_voting" &&
    room.phase !== "verdict" &&
    room.phase !== "case_intro";
  // target the most recent opposing statement
  const lastOpposingIdx = (() => {
    for (let i = room.gameState.statements.length - 1; i >= 0; i--) {
      if (room.gameState.statements[i].side !== myRole) return i;
    }
    return -1;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {showLawliet && <LawlietEntrance onDone={() => setShowLawliet(false)} />}
      {showIntro && (
        <CaseIntroOverlay
          scenario={scenario}
          statementCount={room.statementCount}
          onBegin={beginTrialFromIntro}
        />
      )}

      <CourtHeader room={room} onLeave={onLeave} onShare={shareChamber} judging={judging} />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-4">
        <PhaseTracker phase={room.phase} currentRound={room.gameState.currentRound} totalRounds={room.statementCount} />

        {room.phase === "lobby" ? (
          <LobbyView
            room={room}
            scenario={scenario}
            isHost={isHost}
            myRole={myRole}
            onToggleAI={hostToggleAIRole}
            onTakeRole={hostTakeRole}
            onCycleScenario={hostCycleScenario}
            onGenerateCase={() => generateCase()}
            genLoading={genLoading}
            onStart={hostStartTrial}
            onShare={shareChamber}
          />
        ) : room.phase === "case_intro" ? (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 py-16 text-center">
            {genLoading ? (
              <>
                <Sparkles className="h-8 w-8 animate-pulse text-gold" />
                <p className="font-mono-terminal text-sm text-white/60">
                  Generating case from theme "{room.caseTheme}"...
                </p>
              </>
            ) : (
              <>
                <Gavel className="h-8 w-8 text-gold" />
                <p className="font-mono-terminal text-sm text-white/60">
                  Case briefing displayed. Awaiting host to open court.
                </p>
              </>
            )}
          </div>
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
              <TurnTimerBar remaining={remaining} phase={room.phase} judging={judging} totalRounds={room.statementCount} currentRound={room.gameState.currentRound} />

              {/* objection bar */}
              {canObject && (
                <button
                  type="button"
                  onClick={() => setObjectionOpen(true)}
                  className="sharp flex items-center justify-between border border-red-500/50 bg-red-500/5 px-4 py-2.5 transition hover:bg-red-500/15"
                >
                  <span className="flex items-center gap-2 font-mono-terminal text-xs font-bold uppercase tracking-[0.2em] text-red-400">
                    <Siren className="h-4 w-4" />
                    Raise Objection
                  </span>
                  <span className="font-mono-terminal text-[10px] text-white/40">
                    {myObjectionsLeft} left
                  </span>
                </button>
              )}

              <StatementTimeline statements={room.gameState.statements} myRole={myRole} />

              {isMyTurn ? (
                <ArgumentInput
                  textareaRef={textareaRef}
                  value={text}
                  onChange={(v) => setText(v.slice(0, CHAR_LIMIT + 600))}
                  onSubmit={() => handleSubmit(text)}
                  disabled={judging}
                  role={myRole}
                  round={room.gameState.currentRound}
                  totalRounds={room.statementCount}
                  onSpeak={
                    profile.character === "lawliet" || profile.isAdmin
                      ? () => speakStatement(text)
                      : undefined
                  }
                  ttsPlaying={ttsPlaying}
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
              presentedIds={presentedAllIds(room.gameState.statements, presentedIds, room.phase)}
              onPresent={presentEvidence}
            />
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-white/10 bg-black px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
          <span>Chamber {room.code} · {room.matchmakingType} · {room.statementCount} stmts/side</span>
          <span>Chief Justice Vanguard presiding</span>
        </div>
      </footer>

      <ObjectionModal
        open={objectionOpen}
        onOpenChange={setObjectionOpen}
        remaining={myObjectionsLeft}
        onSubmit={(grounds) => runObjection(myRole, profile.username, lastOpposingIdx, grounds, false)}
      />
    </div>
  );
}

function emptyGs(): GameState {
  return {
    statements: [],
    objectionsLeft: { prosecution: OBJECTIONS_PER_SIDE, defense: OBJECTIONS_PER_SIDE },
    currentRound: 1,
    turnTimerRemaining: TURN_DURATION,
    turnStartedAt: null,
    guiltyVotes: 0,
    notGuiltyVotes: 0,
    juryVotes: [],
    verdict: null,
    eloApplied: false,
    pendingObjection: null,
  };
}

function presentedAllIds(statements: Statement[], local: string[], phase: Room["phase"]): string[] {
  const all = new Set<string>();
  for (const s of statements) s.evidenceIds.forEach((id) => all.add(id));
  if (phase === "prosecutor_turn" || phase === "defendant_turn") local.forEach((id) => all.add(id));
  return Array.from(all);
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
                {room.matchmakingType === "ranked" ? "Ranked · AI assist blocked" : "Casual"} · {room.statementCount}×{room.aiDifficulty}
              </div>
            </div>
          </div>
          {judging && (
            <div className="flex items-center gap-1.5 border border-gold/40 bg-gold/5 px-2 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-gold" />
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

function PhaseTracker({
  phase,
  currentRound,
  totalRounds,
}: {
  phase: Room["phase"];
  currentRound: number;
  totalRounds: number;
}) {
  const steps: { id: Room["phase"]; label: string }[] = [
    { id: "lobby", label: "Lobby" },
    { id: "case_intro", label: "Briefing" },
    { id: "prosecutor_turn", label: "Arguments" },
    { id: "jury_voting", label: "Jury" },
    { id: "verdict", label: "Verdict" },
  ];
  const activeIdx = steps.findIndex((s) =>
    phase === "defendant_turn" ? s.id === "prosecutor_turn" : s.id === phase,
  );
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
      {(phase === "prosecutor_turn" || phase === "defendant_turn") && (
        <div className="ml-2 sharp border border-gold/40 px-2 py-1 font-mono-terminal text-[9px] uppercase tracking-widest text-gold">
          Round {currentRound}/{totalRounds}
        </div>
      )}
    </div>
  );
}

function TrialHeader({
  room,
  scenario,
  myRole,
}: {
  room: Room;
  scenario: CaseScenario;
  myRole: string;
}) {
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
  totalRounds,
  currentRound,
}: {
  remaining: number;
  phase: Room["phase"];
  judging: boolean;
  totalRounds: number;
  currentRound: number;
}) {
  const active = phase === "prosecutor_turn" || phase === "defendant_turn";
  const pct = active ? (remaining / TURN_DURATION) * 100 : phase === "jury_voting" ? 100 : 0;
  const danger = remaining <= 15;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 font-mono-terminal text-[10px] uppercase tracking-widest text-white/40">
        {phase === "jury_voting" ? (
          <>
            <Users className="h-3.5 w-3.5 text-gold animate-pulse" />
            Jury deliberating
          </>
        ) : active ? (
          <>
            <span className={cn(danger && "text-red-400 animate-pulse")}>
              R{currentRound}/{totalRounds}
            </span>
            <span>·</span>
            <span className={cn(danger && "text-red-400")}>{remaining}s</span>
          </>
        ) : judging ? (
          "Vanguard deliberating"
        ) : (
          "Idle"
        )}
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

function StatementTimeline({
  statements,
  myRole,
}: {
  statements: Statement[];
  myRole: string;
}) {
  if (statements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-white/10 py-10 text-center">
        <ScrollText className="h-6 w-6 text-white/20" />
        <p className="font-mono-terminal text-[11px] text-white/30">
          No statements filed yet. The prosecution opens.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
      {statements.map((s, i) => (
        <StatementBlock key={s.id} statement={s} index={i} myRole={myRole} />
      ))}
    </div>
  );
}

function StatementBlock({
  statement,
  index,
  myRole,
}: {
  statement: Statement;
  index: number;
  myRole: string;
}) {
  const isP = statement.side === "prosecution";
  const hasSustained = statement.objections.some((o) => o.ruling.ruling === "SUSTAINED");
  return (
    <div
      className={cn(
        "sharp border p-3",
        isP ? "border-red-500/25 bg-red-500/[0.03]" : "border-emerald-500/25 bg-emerald-500/[0.03]",
        hasSustained && "opacity-60",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-mono-terminal text-[9px] font-bold uppercase tracking-[0.2em]",
            isP ? "text-red-400" : "text-emerald-400",
          )}
        >
          {statement.side === "prosecution" ? "Prosecution" : "Defense"} — R{statement.round}
          {statement.authorIsAI && (
            <span className="ml-1.5 text-gold">[AI]</span>
          )}
          {statement.side === myRole && <span className="ml-1.5 text-gold">◂ YOU</span>}
        </span>
        {hasSustained && (
          <span className="font-mono-terminal text-[8px] uppercase tracking-widest text-amber-400">
            ◂ Struck
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap font-mono-terminal text-[12px] leading-relaxed text-white/75">
        {statement.text}
      </p>
      {statement.evidenceIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {statement.evidenceIds.map((id) => (
            <span
              key={id}
              className="sharp border border-gold/30 bg-gold/5 px-1.5 py-0.5 font-mono-terminal text-[8px] uppercase tracking-widest text-gold/70"
            >
              ◆ Exhibit
            </span>
          ))}
        </div>
      )}
      {statement.objections.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {statement.objections.map((o) => (
            <div
              key={o.id}
              className={cn(
                "sharp border-l-2 px-2 py-1.5 font-mono-terminal text-[10px]",
                o.ruling.ruling === "SUSTAINED"
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-red-500/50 bg-red-500/5",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Siren className="h-3 w-3 text-white/50" />
                <span
                  className={cn(
                    "font-bold uppercase tracking-widest",
                    o.ruling.ruling === "SUSTAINED" ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {o.ruling.ruling}
                </span>
                <span className="text-white/30">— by {o.objectorName}</span>
              </div>
              <p className="mt-0.5 text-white/50">{o.ruling.reasoning}</p>
            </div>
          ))}
        </div>
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
  round,
  totalRounds,
  onSpeak,
  ttsPlaying,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  role: string;
  round: number;
  totalRounds: number;
  onSpeak?: () => void;
  ttsPlaying: boolean;
}) {
  const overLimit = value.length > CHAR_LIMIT;
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
      <div className="flex items-center justify-between">
        <span className="font-mono-terminal text-[10px] uppercase tracking-[0.2em] text-gold">
          {role === "prosecutor" ? "Prosecution" : "Defense"} — Statement R{round}/{totalRounds}
        </span>
        <div className="flex items-center gap-3">
          {onSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              disabled={ttsPlaying || !value.trim()}
              className="flex items-center gap-1 font-mono-terminal text-[10px] text-gold/70 transition hover:text-gold disabled:opacity-30"
              title="Read aloud (Lawliet voice)"
            >
              {ttsPlaying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
              Read
            </button>
          )}
          <span
            className={cn(
              "font-mono-terminal text-[10px]",
              overLimit ? "text-red-400" : value.length > CHAR_LIMIT * 0.85 ? "text-amber-400" : "text-white/40",
            )}
          >
            {value.length}/{CHAR_LIMIT}
          </span>
        </div>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Compose your argument in plain English. Present evidence from the vault to strengthen your case..."
        className="sharp min-h-[140px] resize-y border-white/20 bg-black font-mono-terminal text-[13px] leading-relaxed text-white placeholder:text-white/20 focus-visible:border-gold"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono-terminal text-[9px] text-white/30">
          Auto-submits at 0s. Use [Present Evidence] to inject exhibits at your cursor.
        </p>
        <Button
          onClick={onSubmit}
          disabled={disabled}
          className="sharp h-10 border border-gold bg-gold px-6 font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-black hover:bg-gold/85"
        >
          <ScrollText className="h-4 w-4" />
          File Statement
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
          <Users className="h-8 w-8 animate-pulse text-gold" />
          <p className="font-mono-terminal text-sm text-white/60">
            The jury of five is deliberating...
          </p>
        </>
      ) : (
        <>
          <div className="h-2 w-2 animate-blink bg-gold" />
          <p className="font-mono-terminal text-sm text-white/60">
            {currentTurnIsAI
              ? `${activeRole} AI counsel is preparing (R${room.gameState.currentRound})...`
              : `Awaiting ${activeRole}'s statement (R${room.gameState.currentRound})...`}
          </p>
          <p className="font-mono-terminal text-[10px] uppercase tracking-widest text-white/30">
            {myRole === "spectator" ? "Spectator mode" : "Your turn is next — prepare your objection"}
          </p>
        </>
      )}
    </div>
  );
}

// ============ LOBBY (v2: role selection) ============
function LobbyView({
  room,
  scenario,
  isHost,
  myRole,
  onToggleAI,
  onTakeRole,
  onCycleScenario,
  onGenerateCase,
  genLoading,
  onStart,
  onShare,
}: {
  room: Room;
  scenario: CaseScenario;
  isHost: boolean;
  myRole: string;
  onToggleAI: (role: "prosecution" | "defense") => void;
  onTakeRole: (role: "prosecution" | "defense") => void;
  onCycleScenario: () => void;
  onGenerateCase: () => void;
  genLoading: boolean;
  onStart: () => void;
  onShare: () => void;
}) {
  const ready = (!!room.prosecutorId || room.prosecutorIsAI) && (!!room.defendantId || room.defendantIsAI);
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
          <div className="mt-2 flex flex-wrap gap-2 font-mono-terminal text-[9px] uppercase tracking-widest text-white/40">
            <span className="sharp border border-white/15 px-2 py-0.5">{room.statementCount} statements/side</span>
            <span className="sharp border border-white/15 px-2 py-0.5">AI: {room.aiDifficulty}</span>
            {room.caseTheme && (
              <span className="sharp border border-gold/30 px-2 py-0.5 text-gold">theme: {room.caseTheme}</span>
            )}
          </div>
        </div>

        {/* role selection */}
        <div className="grid grid-cols-2 gap-3">
          <RoleSlot
            role="prosecution"
            name={room.prosecutorName}
            isAI={room.prosecutorIsAI}
            isMe={myRole === "prosecution"}
            isHost={isHost}
            onTake={() => onTakeRole("prosecution")}
            onToggleAI={() => onToggleAI("prosecution")}
          />
          <RoleSlot
            role="defense"
            name={room.defendantName}
            isAI={room.defendantIsAI}
            isMe={myRole === "defendant"}
            isHost={isHost}
            onTake={() => onTakeRole("defense")}
            onToggleAI={() => onToggleAI("defense")}
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
                Preset Case
              </Button>
              <Button
                onClick={onGenerateCase}
                disabled={genLoading}
                variant="ghost"
                size="sm"
                className="sharp h-9 border border-gold/40 text-gold hover:bg-gold hover:text-black"
              >
                {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate AI Case
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
                A slot is empty — take the role or fill with AI.
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

function RoleSlot({
  role,
  name,
  isAI,
  isMe,
  isHost,
  onTake,
  onToggleAI,
}: {
  role: "prosecution" | "defense";
  name: string | null;
  isAI: boolean;
  isMe: boolean;
  isHost: boolean;
  onTake: () => void;
  onToggleAI: () => void;
}) {
  const isP = role === "prosecution";
  return (
    <div
      className={cn(
        "sharp flex flex-col gap-2 border p-3",
        isP ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-mono-terminal text-[9px] font-bold uppercase tracking-[0.2em]",
            isP ? "text-red-400" : "text-emerald-400",
          )}
        >
          {isP ? "Prosecution" : "Defense"}
        </span>
        {isAI && (
          <span className="flex items-center gap-0.5 font-mono-terminal text-[8px] uppercase tracking-widest text-gold">
            <Cpu className="h-2.5 w-2.5" /> AI
          </span>
        )}
      </div>
      <div className="font-mono-terminal text-xs font-bold text-white">
        {name ?? "Empty slot"}
        {isMe && <span className="ml-1.5 text-gold">◂ YOU</span>}
      </div>
      {isHost && (
        <div className="mt-1 flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={onTake}
            disabled={isMe}
            className="sharp h-7 flex-1 border border-white/20 px-2 text-[9px] uppercase tracking-widest text-white/70 hover:text-white disabled:opacity-30"
          >
            Take Role
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleAI}
            className={cn(
              "sharp h-7 border px-2 text-[9px] uppercase tracking-widest",
              isAI
                ? "border-gold bg-gold/10 text-gold"
                : "border-white/20 text-white/50 hover:text-white",
            )}
          >
            {isAI ? "AI On" : "Fill AI"}
          </Button>
        </div>
      )}
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
  scenario: CaseScenario;
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
