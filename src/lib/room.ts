// ===== Judgementia — Room & game-state factories (v2) =====
import type { GameState, Room } from "@/lib/types";
import { TURN_DURATION, OBJECTIONS_PER_SIDE, DEFAULT_STATEMENTS } from "@/lib/types";
import { newId } from "@/lib/api";

export function emptyGameState(): GameState {
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

export interface NewRoomOpts {
  code: string;
  matchmakingType: Room["matchmakingType"];
  scenarioId: string;
  hostId: string;
  prosecutorId?: string | null;
  prosecutorName?: string | null;
  defendantId?: string | null;
  defendantName?: string | null;
  prosecutorIsAI?: boolean;
  defendantIsAI?: boolean;
  statementCount?: number;
  aiDifficulty?: Room["aiDifficulty"];
  caseTheme?: string;
  phase?: Room["phase"];
}

export function newRoom(opts: NewRoomOpts): Room {
  return {
    id: newId(),
    code: opts.code.toUpperCase(),
    phase: opts.phase ?? "lobby",
    matchmakingType: opts.matchmakingType,
    scenarioId: opts.scenarioId,
    hostId: opts.hostId,
    // For AI roles, the player id is null — the *_is_ai flag carries the signal.
    // (Supabase profiles.id is uuid; non-uuid strings would violate the constraint.)
    prosecutorId: opts.prosecutorIsAI ? null : (opts.prosecutorId ?? opts.hostId),
    prosecutorName: opts.prosecutorName ?? null,
    defendantId: opts.defendantIsAI ? null : (opts.defendantId ?? null),
    defendantName: opts.defendantName ?? null,
    prosecutorIsAI: opts.prosecutorIsAI ?? false,
    defendantIsAI: opts.defendantIsAI ?? false,
    statementCount: opts.statementCount ?? DEFAULT_STATEMENTS,
    aiDifficulty: opts.aiDifficulty ?? "medium",
    caseTheme: opts.caseTheme ?? "",
    gameState: emptyGameState(),
    createdAt: new Date().toISOString(),
    closed: false,
  };
}

/** Given the current statements + statementCount, determine whose turn is next. */
export function nextPhaseAfterStatement(
  statements: { side: "prosecutor" | "defense"; round: number }[],
  statementCount: number,
): "prosecutor_turn" | "defendant_turn" | "jury_voting" {
  // find the last statement
  const last = statements[statements.length - 1];
  if (!last) return "prosecutor_turn";
  if (last.side === "prosecutor") {
    // defense speaks same round
    return "defendant_turn";
  }
  // last was defense → round complete. next round or jury?
  const completedRounds = last.round;
  if (completedRounds >= statementCount) return "jury_voting";
  return "prosecutor_turn";
}

export function currentRoundFromStatements(
  statements: { side: "prosecutor" | "defense"; round: number }[],
): number {
  if (statements.length === 0) return 1;
  const last = statements[statements.length - 1];
  if (last.side === "defense") return last.round + 1;
  return last.round;
}
