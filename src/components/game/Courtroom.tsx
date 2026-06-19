"use client";
// ===== Phase: Courtroom — multi-round split-screen trial (v2) =====
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceVault } from "./EvidenceVault";
import { Portrait } from "./Portrait";
import { CaseIntroOverlay } from "./CaseIntroOverlay";
import { LawlietEntrance } from "./LawlietEntrance";
import { ObjectionModal } from "./ObjectionModal";
import { ConnectionIndicator } from "./ConnectionIndicator";
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
  ArrowRight,
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
  Flame,
  Scale,
  ShieldAlert,
  type LucideIcon,
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
  const lawlietShownRef = useRef(false);

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

  // ----- turn notification toast: fire when it becomes the player's turn -----
  useEffect(() => {
    if (isMyTurn) {
      toast.info("Your turn — file your statement!", { duration: 4000 });
    }
  }, [isMyTurn]);

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
          lawlietShownRef.current = true;
          setShowLawliet(true);
        }
      }
    }
  }, [room?.phase, profile]);

  // Also trigger on mount if already in case_intro (e.g., admin navigates into
  // a courtroom that is mid-briefing). lastPhaseSeen starts as "" so the
  // transition-effect above won't fire — this catches that case.
  useEffect(() => {
    if (!room || !profile) return;
    if (room.phase === "case_intro" && !lawlietShownRef.current) {
      if (profile.character === "lawliet" || profile.isAdmin) {
        lawlietShownRef.current = true;
        setShowLawliet(true);
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
        await update({ gameState: { ...fresh.gameState, eloApplied: true }, closed: true });
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black">
        <div className="relative">
          <Gavel className="h-10 w-10 animate-float-soft text-gold/70" />
          <span
            aria-hidden
            className="absolute -inset-3 -z-10 rounded-full bg-gold/20 blur-xl"
          />
        </div>
        <div className="font-mono-terminal text-sm uppercase tracking-[0.3em] text-gold/70">
          Convening chamber
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-blink bg-gold" />
          <span className="h-1.5 w-1.5 animate-blink bg-gold" style={{ animationDelay: "0.2s" }} />
          <span className="h-1.5 w-1.5 animate-blink bg-gold" style={{ animationDelay: "0.4s" }} />
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
          isHost={isHost}
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
          <div className="relative mt-6 flex flex-col items-center justify-center gap-4 overflow-hidden py-20 text-center">
            {/* Subtle radial backdrop */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(212,175,55,0.1), transparent 60%)",
              }}
            />
            {genLoading ? (
              <>
                <Sparkles className="relative h-10 w-10 animate-pulse text-gold" />
                <p className="relative font-mono-terminal text-sm text-white/65">
                  Generating case from theme <span className="text-gold">"{room.caseTheme}"</span>...
                </p>
                <div className="relative mt-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-blink bg-gold" />
                  <span className="h-1.5 w-1.5 animate-blink bg-gold" style={{ animationDelay: "0.2s" }} />
                  <span className="h-1.5 w-1.5 animate-blink bg-gold" style={{ animationDelay: "0.4s" }} />
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <Gavel className="h-10 w-10 animate-float-soft text-gold" />
                  <span
                    aria-hidden
                    className="absolute -inset-3 -z-10 rounded-full bg-gold/20 blur-xl"
                  />
                </div>
                <p className="relative font-mono-terminal text-sm text-white/65">
                  Case briefing displayed. <span className="text-gold">Awaiting host to open court.</span>
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
            <section className="premium-card sharp flex flex-col gap-4 p-4">
              <TrialHeader room={room} scenario={scenario} myRole={myRole} />
              <TurnTimerBar remaining={remaining} phase={room.phase} judging={judging} totalRounds={room.statementCount} currentRound={room.gameState.currentRound} />

              {/* objection bar */}
              {canObject && (
                <button
                  type="button"
                  onClick={() => setObjectionOpen(true)}
                  className="animate-red-pulse sharp group flex items-center justify-between border border-red-500/60 bg-red-500/[0.07] px-4 py-3 transition hover:bg-red-500/20"
                >
                  <span className="flex items-center gap-2.5 font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-red-400">
                    <Siren className="h-4 w-4 animate-pulse" />
                    Raise Objection
                    <span className="hidden font-mono-terminal text-[9px] font-normal tracking-widest text-white/40 sm:inline">
                      ▸ Counter opposing counsel
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono-terminal text-[10px] uppercase tracking-widest text-red-400/80">
                      {myObjectionsLeft} left
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-red-400 transition-transform group-hover:translate-x-1" />
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

      <footer className="header-gradient-bar mt-auto border-t border-white/10 bg-black px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
          <span className="flex items-center gap-2">
            <span className="h-1 w-1 animate-blink bg-gold" />
            Chamber {room.code} · {room.matchmakingType} · {room.statementCount} stmts/side
          </span>
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
    <header className="header-gradient-bar sticky top-0 z-30 border-b border-white/10 bg-black/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 py-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={onLeave}
            variant="ghost"
            size="sm"
            className="sharp group h-8 border border-white/15 px-2 text-white/60 transition hover:border-red-500/50 hover:text-red-400"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-mono-terminal text-[10px] uppercase tracking-widest">Exit</span>
          </Button>
          <div className="flex items-center gap-2.5 border-l border-white/10 pl-3">
            <div className="relative">
              <Gavel className="h-4 w-4 text-gold" />
              <span
                aria-hidden
                className="absolute -inset-1 -z-10 rounded-full bg-gold/20 blur-sm"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-glow-gold font-mono-terminal text-sm font-bold uppercase tracking-[0.25em] text-white">
                  Chamber {room.code}
                </div>
                <ConnectionIndicator />
              </div>
              <div className="font-mono-terminal text-[8px] uppercase tracking-[0.3em] text-white/40">
                {room.matchmakingType === "ranked" ? "Ranked · AI assist blocked" : "Casual"} · {room.statementCount}×{room.aiDifficulty}
              </div>
            </div>
          </div>
          {judging && (
            <div className="animate-glow-pulse flex items-center gap-1.5 border border-gold/50 bg-gold/5 px-2.5 py-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-gold" />
              <span className="font-mono-terminal text-[9px] uppercase tracking-widest text-gold">
                Vanguard deliberating
              </span>
            </div>
          )}
        </div>
        <Button
          onClick={onShare}
          variant="ghost"
          size="sm"
          className="sharp group h-8 border border-gold/40 px-3 text-gold transition hover:bg-gold hover:text-black hover:shadow-[0_0_18px_-4px_var(--gold)]"
        >
          <Copy className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
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
  const steps: { id: Room["phase"]; label: string; icon: LucideIcon }[] = [
    { id: "lobby", label: "Lobby", icon: Users },
    { id: "case_intro", label: "Briefing", icon: ScrollText },
    { id: "prosecutor_turn", label: "Arguments", icon: Scale },
    { id: "jury_voting", label: "Jury", icon: Users },
    { id: "verdict", label: "Verdict", icon: Gavel },
  ];
  const activeIdx = steps.findIndex((s) =>
    phase === "defendant_turn" ? s.id === "prosecutor_turn" : s.id === phase,
  );
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            <div
              className={cn(
                "sharp flex items-center gap-2 border px-3 py-1.5 font-mono-terminal text-[10px] uppercase tracking-widest transition-all duration-200",
                active &&
                  "animate-glow-pulse border-gold bg-gold/15 text-gold",
                done && "border-white/20 bg-white/[0.03] text-white/45",
                !active && !done && "border-white/10 text-white/25",
              )}
            >
              <span
                className={cn(
                  "font-mono-terminal text-[8px]",
                  active ? "text-gold" : done ? "text-white/50" : "text-white/25",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <Icon
                className={cn(
                  "h-3 w-3",
                  active ? "text-gold" : done ? "text-white/45" : "text-white/25",
                )}
              />
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className="relative h-px w-6 overflow-hidden">
                <div className={cn("absolute inset-0", done ? "bg-gold/40" : "bg-white/10")} />
                {done && (
                  <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-gold/60 to-transparent" style={{ backgroundSize: "200% 100%" }} />
                )}
              </div>
            )}
          </div>
        );
      })}
      {(phase === "prosecutor_turn" || phase === "defendant_turn") && (
        <div className="ml-2 sharp flex items-center gap-1.5 border border-gold/50 bg-gold/5 px-2.5 py-1.5 font-mono-terminal text-[10px] font-bold uppercase tracking-widest text-gold">
          <span className="text-glow-gold">R{currentRound}/{totalRounds}</span>
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
    <div className="flex flex-col gap-3 border-b border-white/10 pb-4">
      <div>
        <div className="flex items-center gap-2 font-mono-terminal text-[9px] uppercase tracking-[0.3em] text-gold">
          <span className="h-1 w-1 animate-blink bg-gold" />
          Case File
          <span className="text-white/30">· {scenario.id ?? "—"}</span>
        </div>
        <h2 className="mt-1.5 font-mono-terminal text-lg font-bold uppercase tracking-[0.05em] text-white sm:text-2xl">
          <span className="text-glow-gold text-gold/40">v.</span>{" "}
          <span className="text-glow-gold">{scenario.title}</span>
        </h2>
        <p className="mt-1.5 font-mono-terminal text-[11px] leading-relaxed text-white/55">
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
        "hud-corners sharp relative flex items-center gap-3 border p-3 transition-all",
        isP
          ? "border-red-500/40 bg-gradient-to-br from-red-500/[0.08] to-transparent"
          : "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] to-transparent",
        isMe && (isP ? "shadow-[0_0_20px_-6px_rgba(224,82,74,0.6)]" : "shadow-[0_0_20px_-6px_rgba(63,185,138,0.6)]"),
      )}
    >
      <div
        className={cn(
          "relative h-14 w-14 shrink-0 border",
          isP ? "border-red-500/40" : "border-emerald-500/40",
        )}
      >
        <Portrait
          archetype={isAI ? "warden" : isP ? "inquisitor" : "advocate"}
          accent={isP ? "crimson" : "jade"}
          size={56}
        />
        {/* Active indicator if it's me */}
        {isMe && (
          <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse-gold rounded-full border border-gold bg-gold" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex items-center gap-1.5 font-mono-terminal text-[9px] font-bold uppercase tracking-[0.25em]",
            isP ? "text-red-400" : "text-emerald-400",
          )}
        >
          {isP ? <ShieldAlert className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
          {isP ? "Prosecution" : "Defense"}
        </div>
        <div className="mt-0.5 truncate font-mono-terminal text-sm font-bold text-white">
          {name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono-terminal text-[8px] uppercase tracking-widest">
          {isAI && (
            <span className="flex items-center gap-0.5 border border-gold/30 bg-gold/5 px-1.5 py-0.5 text-gold">
              <Cpu className="h-2.5 w-2.5" /> AI Counsel
            </span>
          )}
          {isMe && (
            <span className="border border-gold/60 bg-gold/10 px-1.5 py-0.5 text-gold">
              ◂ YOU
            </span>
          )}
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
  const warning = remaining <= 30 && remaining > 15;
  // Gradient shifts: gold → amber → red as time runs out
  const fillColor = phase === "jury_voting" || judging
    ? "linear-gradient(90deg, var(--gold), #f08a24)"
    : danger
      ? "linear-gradient(90deg, #e0524a, #ff6b5d)"
      : warning
        ? "linear-gradient(90deg, #f08a24, #f5b545)"
        : "linear-gradient(90deg, var(--gold), #e8c860)";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            "flex items-center gap-1.5 font-mono-terminal text-[10px] uppercase tracking-widest",
            danger && active ? "text-red-400 animate-pulse" : "text-white/45",
          )}
        >
          {phase === "jury_voting" ? (
            <>
              <Users className="h-3.5 w-3.5 animate-pulse text-gold" />
              <span className="text-gold">Jury deliberating</span>
            </>
          ) : active ? (
            <>
              <span className={cn(danger && "text-red-400")}>R{currentRound}/{totalRounds}</span>
              <span className="text-white/25">·</span>
              <span className={cn("font-bold", danger ? "text-red-400" : warning ? "text-amber-400" : "text-gold")}>
                {remaining}s
              </span>
              {danger && <Flame className="h-3 w-3 text-red-400" />}
            </>
          ) : judging ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-gold" />
              <span className="text-gold">Vanguard deliberating</span>
            </>
          ) : (
            "Idle"
          )}
        </div>
        <div className="font-mono-terminal text-[9px] uppercase tracking-widest text-white/25">
          {active ? "TURN TIMER" : phase === "jury_voting" ? "DELIBERATION" : "—"}
        </div>
      </div>
      {/* Taller, more prominent timer bar */}
      <div className="relative h-3.5 w-full border border-white/15 bg-black/60">
        <div
          className={cn(
            "relative h-full transition-[width] duration-300 ease-linear",
            (phase === "jury_voting" || judging) && "animate-pulse",
          )}
          style={{ width: `${pct}%`, background: fillColor }}
        >
          {/* Inner shimmer overlay for a premium shine */}
          <div
            className="animate-shimmer absolute inset-0 opacity-40"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
              backgroundSize: "200% 100%",
            }}
          />
        </div>
        {/* Tick marks for drama */}
        <div className="pointer-events-none absolute inset-0 flex justify-between px-px">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-full w-px bg-white/5" />
          ))}
        </div>
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
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [statements.length]);

  if (statements.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center gap-3 overflow-hidden border border-dashed border-white/15 py-16 text-center">
        {/* Subtle radial backdrop */}
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
          Waiting for opening statements.
        </p>
        <p className="relative font-mono-terminal text-[9px] uppercase tracking-widest text-white/30">
          The prosecution begins.
        </p>
        <div className="relative mt-1 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-blink bg-gold" />
          <span className="h-1.5 w-1.5 animate-blink bg-gold" style={{ animationDelay: "0.15s" }} />
          <span className="h-1.5 w-1.5 animate-blink bg-gold" style={{ animationDelay: "0.3s" }} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
      {statements.map((s, i) => (
        <StatementBlock key={s.id} statement={s} index={i} myRole={myRole} />
      ))}
      <div ref={bottomRef} />
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
    <motion.div
      initial={{ opacity: 0, x: isP ? -24 : 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "sharp relative border-l-2 p-3.5 transition-all",
        isP
          ? "border-l-red-500/70 bg-gradient-to-r from-red-500/[0.06] to-transparent border-y border-r border-red-500/20"
          : "border-l-emerald-500/70 bg-gradient-to-r from-emerald-500/[0.06] to-transparent border-y border-r border-emerald-500/20",
        hasSustained && "opacity-70",
      )}
    >
      {/* Accent corner */}
      <div
        aria-hidden
        className={cn(
          "absolute -left-px top-0 h-3 w-3 border-l-2 border-t-2",
          isP ? "border-red-500/60" : "border-emerald-500/60",
        )}
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono-terminal text-[9px] font-bold uppercase tracking-[0.25em]",
              isP ? "text-red-400" : "text-emerald-400",
            )}
          >
            {statement.side === "prosecution" ? "Prosecution" : "Defense"}
          </span>
          <span
            className={cn(
              "sharp border px-1.5 py-0.5 font-mono-terminal text-[8px] font-bold uppercase tracking-widest",
              isP
                ? "border-red-500/40 text-red-400/90"
                : "border-emerald-500/40 text-emerald-400/90",
            )}
          >
            R{statement.round}
          </span>
          {statement.authorIsAI && (
            <span className="flex items-center gap-0.5 font-mono-terminal text-[8px] uppercase tracking-widest text-gold">
              <Cpu className="h-2.5 w-2.5" /> AI
            </span>
          )}
          {statement.side === myRole && (
            <span className="font-mono-terminal text-[8px] uppercase tracking-widest text-gold">
              ◂ YOU
            </span>
          )}
        </div>
        {hasSustained && (
          <span className="flex items-center gap-1 font-mono-terminal text-[8px] font-bold uppercase tracking-widest text-amber-400">
            <span className="h-1 w-1 animate-pulse rounded-full bg-amber-400" />
            Struck
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap border-l border-white/10 pl-3 font-mono-terminal text-[12px] leading-relaxed text-white/80">
        {statement.text}
      </p>
      {statement.evidenceIds.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-l border-white/10 pl-3">
          {statement.evidenceIds.map((id, idx) => (
            <span
              key={id}
              className="sharp flex items-center gap-1 border border-gold/40 bg-gradient-to-r from-gold/10 to-transparent px-2 py-0.5 font-mono-terminal text-[8px] font-bold uppercase tracking-widest text-gold"
            >
              <span className="text-gold/60">◆</span>
              Exhibit {String(idx + 1).padStart(2, "0")}
            </span>
          ))}
        </div>
      )}
      {statement.objections.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {statement.objections.map((o) => (
            <div
              key={o.id}
              className={cn(
                "sharp border-l-2 px-3 py-2 font-mono-terminal text-[10px]",
                o.ruling.ruling === "SUSTAINED"
                  ? "border-l-emerald-500 bg-emerald-500/[0.06]"
                  : "border-l-red-500/60 bg-red-500/[0.06]",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Siren className="h-3 w-3 text-white/60" />
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
              <p className="mt-1 text-white/55">{o.ruling.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
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
  const isP = role === "prosecutor";
  const pct = Math.min(100, (value.length / CHAR_LIMIT) * 100);
  return (
    <div className="sharp flex flex-col gap-3 border-t-2 border-white/15 bg-gradient-to-b from-white/[0.02] to-transparent p-4 pt-3.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono-terminal text-[10px] font-bold uppercase tracking-[0.25em]",
              isP ? "text-red-400" : "text-emerald-400",
            )}
          >
            {isP ? "⬢ Prosecution" : "⬢ Defense"}
          </span>
          <span className="text-white/25">·</span>
          <span className="font-mono-terminal text-[10px] uppercase tracking-widest text-gold">
            Statement R{round}/{totalRounds}
          </span>
        </div>
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
              "font-mono-terminal text-[10px] font-bold tabular-nums",
              overLimit
                ? "text-red-400"
                : value.length > CHAR_LIMIT * 0.85
                  ? "text-amber-400"
                  : "text-white/50",
            )}
          >
            {value.length}
            <span className="text-white/30">/{CHAR_LIMIT}</span>
          </span>
        </div>
      </div>

      {/* Prominent char counter bar */}
      <div className="relative h-1 w-full overflow-hidden bg-white/5">
        <div
          className={cn(
            "h-full transition-all duration-150",
            overLimit
              ? "bg-red-500"
              : value.length > CHAR_LIMIT * 0.85
                ? "bg-amber-400"
                : "bg-gold/60",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Compose your argument in plain English. Present evidence from the vault to strengthen your case..."
        className={cn(
          "sharp min-h-[160px] resize-y border bg-black font-mono-terminal text-[13px] leading-relaxed text-white placeholder:text-white/20 focus-visible:border-gold focus-visible:shadow-[0_0_24px_-8px_var(--gold)]",
          isP
            ? "border-red-500/30 focus-visible:border-red-400 focus-visible:shadow-[0_0_24px_-8px_rgba(224,82,74,0.6)]"
            : "border-emerald-500/30 focus-visible:border-emerald-400 focus-visible:shadow-[0_0_24px_-8px_rgba(63,185,138,0.6)]",
        )}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono-terminal text-[9px] uppercase tracking-widest text-white/30">
          Auto-submits at 0s · <span className="text-white/50">Ctrl+Enter</span> to file
        </p>
        <Button
          onClick={onSubmit}
          disabled={disabled}
          className={cn(
            "sharp group flex h-11 items-center gap-2 border px-6 font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] transition-all hover:shadow-[0_0_24px_-6px_var(--gold)]",
            isP
              ? "border-red-500 bg-red-500/15 text-red-300 hover:bg-red-500 hover:text-black hover:shadow-[0_0_24px_-6px_rgba(224,82,74,0.7)]"
              : "border-emerald-500 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_24px_-6px_rgba(63,185,138,0.7)]",
          )}
        >
          <ScrollText className="h-4 w-4 transition-transform group-hover:scale-110" />
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
    <div className="relative flex flex-col items-center justify-center gap-3 overflow-hidden border-t-2 border-white/15 py-12 text-center">
      {room.phase === "jury_voting" ? (
        <>
          <Users className="h-10 w-10 animate-pulse text-gold" />
          <p className="text-glow-gold font-mono-terminal text-sm font-bold uppercase tracking-[0.2em] text-gold">
            The jury of five is deliberating...
          </p>
          <div className="mt-2 h-2 w-48 animate-barber-pole border border-gold/30" />
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-blink bg-gold" />
            <span className="h-2 w-2 animate-blink bg-gold" style={{ animationDelay: "0.2s" }} />
            <span className="h-2 w-2 animate-blink bg-gold" style={{ animationDelay: "0.4s" }} />
          </div>
          <p className="font-mono-terminal text-sm text-white/65">
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
  const isRanked = room.matchmakingType === "ranked";
  const ready = isRanked
    ? !!room.prosecutorId && !!room.defendantId && !room.prosecutorIsAI && !room.defendantIsAI
    : (!!room.prosecutorId || room.prosecutorIsAI) && (!!room.defendantId || room.defendantIsAI);
  const waitingForOpponent = isRanked && !room.defendantId;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr]">
      <section className="premium-card sharp flex flex-col gap-5 p-5 sm:p-6">
        <div className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 font-mono-terminal text-[9px] uppercase tracking-[0.3em] text-gold">
            <span className="h-1 w-1 animate-blink bg-gold" />
            Pre-Trial Lobby
          </div>
          <h2 className="mt-1.5 font-mono-terminal text-xl font-bold uppercase tracking-[0.05em] text-white sm:text-2xl">
            <span className="text-glow-gold">{scenario.title}</span>
          </h2>
          <p className="mt-1.5 font-mono-terminal text-[11px] leading-relaxed text-white/55">
            {scenario.facts}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 font-mono-terminal text-[9px] uppercase tracking-widest text-white/40">
            <span className="sharp border border-white/15 px-2 py-0.5">{room.statementCount} statements/side</span>
            <span className="sharp border border-white/15 px-2 py-0.5">AI: {room.aiDifficulty}</span>
            {room.caseTheme && (
              <span className="sharp border border-gold/40 bg-gold/5 px-2 py-0.5 text-gold">theme: {room.caseTheme}</span>
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
            isRanked={isRanked}
            onTake={() => onTakeRole("prosecution")}
            onToggleAI={() => onToggleAI("prosecution")}
          />
          <RoleSlot
            role="defense"
            name={room.defendantName}
            isAI={room.defendantIsAI}
            isMe={myRole === "defendant"}
            isHost={isHost}
            isRanked={isRanked}
            onTake={() => onTakeRole("defense")}
            onToggleAI={() => onToggleAI("defense")}
          />
        </div>

        {isHost ? (
          <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
            {isRanked ? (
              <div className="sharp flex flex-col gap-2 border border-gold/40 bg-gold/[0.03] p-3">
                <div className="font-mono-terminal text-[9px] uppercase tracking-[0.25em] text-gold">
                  Chamber Code · share with opponent
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-glow-gold font-mono-terminal text-2xl font-black tracking-[0.4em] text-gold">
                    {room.code}
                  </span>
                  <Button
                    onClick={onShare}
                    variant="ghost"
                    size="sm"
                    className="sharp h-8 border border-gold/40 px-3 text-gold hover:bg-gold hover:text-black"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Link
                  </Button>
                </div>
                {waitingForOpponent && (
                  <div className="flex items-center gap-2 font-mono-terminal text-[11px] text-white/60">
                    <span>Waiting for opponent</span>
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-blink rounded-full bg-gold" />
                      <span className="h-1.5 w-1.5 animate-blink rounded-full bg-gold" style={{ animationDelay: "0.2s" }} />
                      <span className="h-1.5 w-1.5 animate-blink rounded-full bg-gold" style={{ animationDelay: "0.4s" }} />
                    </span>
                  </div>
                )}
              </div>
            ) : (
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
            )}
            <Button
              onClick={onStart}
              disabled={!ready}
              className={cn(
                "sharp group flex h-12 items-center gap-2 border border-gold bg-gold font-mono-terminal text-sm font-bold uppercase tracking-[0.3em] text-black transition hover:bg-gold/85 hover:shadow-[0_0_28px_-6px_var(--gold)] disabled:opacity-30 disabled:hover:shadow-none",
                ready && "animate-pulse-gold",
              )}
            >
              <Play className="h-5 w-5 transition-transform group-hover:scale-110" />
              Convene Trial
            </Button>
            {!ready && (
              <p className="text-center font-mono-terminal text-[10px] text-white/30">
                {isRanked
                  ? "Waiting for opponent to join via chamber code."
                  : "A slot is empty — take the role or fill with AI."}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 border-t border-white/10 pt-6">
            {isRanked ? (
              <>
                <div className="text-glow-gold font-mono-terminal text-2xl font-black tracking-[0.4em] text-gold">
                  {room.code}
                </div>
                <p className="font-mono-terminal text-[10px] uppercase tracking-[0.25em] text-white/40">
                  Chamber Code
                </p>
                {waitingForOpponent ? (
                  <div className="flex items-center gap-2 font-mono-terminal text-sm text-white/60">
                    <span>Waiting for opponent</span>
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-blink rounded-full bg-gold" />
                      <span className="h-1.5 w-1.5 animate-blink rounded-full bg-gold" style={{ animationDelay: "0.2s" }} />
                      <span className="h-1.5 w-1.5 animate-blink rounded-full bg-gold" style={{ animationDelay: "0.4s" }} />
                    </span>
                  </div>
                ) : (
                  <p className="font-mono-terminal text-sm text-white/60">
                    Opponent joined — waiting for host to convene the trial...
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="h-2 w-2 animate-blink bg-gold" />
                <p className="font-mono-terminal text-sm text-white/60">
                  Waiting for the host to convene the trial...
                </p>
                <p className="font-mono-terminal text-[10px] uppercase tracking-widest text-white/30">
                  Chamber code: {room.code}
                </p>
              </>
            )}
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
  isRanked,
  onTake,
  onToggleAI,
}: {
  role: "prosecution" | "defense";
  name: string | null;
  isAI: boolean;
  isMe: boolean;
  isHost: boolean;
  isRanked: boolean;
  onTake: () => void;
  onToggleAI: () => void;
}) {
  const isP = role === "prosecution";
  return (
    <div
      className={cn(
        "hud-corners sharp relative flex flex-col gap-2 border p-3 transition-all",
        isP
          ? "border-red-500/40 bg-gradient-to-br from-red-500/[0.07] to-transparent"
          : "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.07] to-transparent",
        isMe && (isP ? "shadow-[0_0_18px_-6px_rgba(224,82,74,0.6)]" : "shadow-[0_0_18px_-6px_rgba(63,185,138,0.6)]"),
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex items-center gap-1.5 font-mono-terminal text-[9px] font-bold uppercase tracking-[0.25em]",
            isP ? "text-red-400" : "text-emerald-400",
          )}
        >
          {isP ? <ShieldAlert className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
          {isP ? "Prosecution" : "Defense"}
        </span>
        {isAI && (
          <span className="flex items-center gap-0.5 border border-gold/30 bg-gold/5 px-1.5 py-0.5 font-mono-terminal text-[8px] uppercase tracking-widest text-gold">
            <Cpu className="h-2.5 w-2.5" /> AI
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 font-mono-terminal text-sm font-bold text-white">
        {name ?? (isRanked ? "Awaiting..." : "Empty slot")}
        {isMe && <span className="text-[9px] uppercase tracking-widest text-gold">◂ YOU</span>}
      </div>
      {isRanked ? (
        <div className="mt-1 font-mono-terminal text-[9px] uppercase tracking-widest text-white/40">
          {isP ? "Auto-assigned (host)" : "Auto-assigned (opponent)"}
        </div>
      ) : isHost ? (
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
      ) : null}
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
  const accentColor = guilty ? "#e0524a" : "#3fb98a";

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn(
          "premium-card sharp relative overflow-hidden p-8 text-center sm:p-10",
          guilty ? "border-red-500/50" : "border-emerald-500/50",
        )}
        style={{
          boxShadow: `0 0 0 1px ${accentColor}55, 0 0 60px -10px ${accentColor}66`,
        }}
      >
        {/* Animated radial glow background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${accentColor}22, transparent 60%)`,
          }}
        />
        {/* Scan line accent */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div
            className="animate-scan-x h-px w-1/2"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center justify-center gap-2 font-mono-terminal text-[10px] uppercase tracking-[0.4em] text-white/45"
        >
          <span className="h-1 w-1 animate-blink bg-gold" />
          Chief Justice Vanguard renders decree
        </motion.div>

        <motion.div
          initial={{ scale: 0.3, opacity: 0, filter: "blur(8px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.7, type: "spring", bounce: 0.35, delay: 0.2 }}
          className={cn(
            "mt-5 font-mono-terminal text-5xl font-black uppercase tracking-[0.15em] sm:text-7xl",
          )}
          style={{
            color: accentColor,
            textShadow: `0 0 24px ${accentColor}aa, 0 0 60px ${accentColor}66`,
          }}
        >
          {v.verdict}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-3 font-mono-terminal text-[11px] uppercase tracking-[0.3em] text-white/40"
        >
          {scenario.title}
        </motion.div>

        {!isSpectator && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className={cn(
              "sharp mt-5 inline-flex items-center gap-2 border px-5 py-2 font-mono-terminal text-xs font-bold uppercase tracking-[0.3em]",
              iWon
                ? "border-gold bg-gold/10 text-gold"
                : "border-white/30 text-white/50",
            )}
          >
            {iWon ? (
              <>
                <span className="text-glow-gold">▲</span> Verdict in your favor
              </>
            ) : (
              <>
                <span>▼</span> Verdict against you
              </>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono-terminal text-[10px] uppercase tracking-widest text-white/45"
        >
          <span className="flex items-center gap-2">
            <Users className="h-3 w-3 text-gold" />
            Jury:
            <span className="text-red-400">{room.gameState.guiltyVotes}</span>
            <span className="text-white/30">/</span>
            <span className="text-emerald-400">{room.gameState.notGuiltyVotes}</span>
          </span>
          <span className="flex items-center gap-2">
            <Scale className="h-3 w-3 text-gold" />
            Decisiveness:
            <span className="text-gold text-glow-gold">{v.decisiveness}/100</span>
          </span>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="premium-card sharp mt-4 flex flex-col gap-5 p-5 sm:p-6"
      >
        <VerdictSection label="Legal Reasoning" icon={ScrollText}>
          {v.reasoning}
        </VerdictSection>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <VerdictSection label="Punishment Decree" icon={Gavel}>
          {v.punishment}
        </VerdictSection>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.3 }}
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <Button
          onClick={onRematch}
          className="sharp h-12 border border-gold bg-gold px-8 font-mono-terminal text-xs font-bold uppercase tracking-[0.3em] text-black transition hover:bg-gold/85 hover:shadow-[0_0_24px_-6px_var(--gold)]"
        >
          <RefreshCw className="h-4 w-4" />
          New Trial
        </Button>
        <Button
          onClick={onLeave}
          variant="ghost"
          className="sharp h-12 border border-white/20 px-8 font-mono-terminal text-xs font-bold uppercase tracking-[0.3em] text-white/70 transition hover:text-white hover:border-white/50"
        >
          Return to Terminal
        </Button>
      </motion.div>
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
    <div className="relative border-l-2 border-gold/50 pl-5">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center border border-gold/40 bg-gold/10">
          <Icon className="h-3.5 w-3.5 text-gold" />
        </div>
        <span className="font-mono-terminal text-[10px] font-bold uppercase tracking-[0.3em] text-gold">
          {label}
        </span>
      </div>
      <p className="whitespace-pre-wrap font-mono-terminal text-[12px] leading-relaxed text-white/75">
        {children}
      </p>
    </div>
  );
}
