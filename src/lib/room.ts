// ===== Judgementia — Room & game-state factories =====
import type { GameState, Room } from "@/lib/types";
import { TURN_DURATION } from "@/lib/types";
import { newId } from "@/lib/api";

export function emptyGameState(): GameState {
  return {
    prosecutorText: "",
    prosecutorEvidence: [],
    defendantText: "",
    defendantEvidence: [],
    prosecutorDraft: "",
    defendantDraft: "",
    turnTimerRemaining: TURN_DURATION,
    guiltyVotes: 0,
    notGuiltyVotes: 0,
    juryVotes: [],
    verdict: null,
    turnStartedAt: null,
    eloApplied: false,
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
    prosecutorId: opts.prosecutorId ?? opts.hostId,
    prosecutorName: opts.prosecutorName ?? null,
    defendantId: opts.defendantId ?? null,
    defendantName: opts.defendantName ?? null,
    prosecutorIsAI: opts.prosecutorIsAI ?? false,
    defendantIsAI: opts.defendantIsAI ?? false,
    gameState: emptyGameState(),
    createdAt: new Date().toISOString(),
    closed: false,
  };
}
