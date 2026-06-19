// ===== Judgementia — Core Type System =====

export type RankTier =
  | "Junior Associate"
  | "Partner"
  | "Senior Counsel"
  | "Magistrate"
  | "Chief Justice Elite";

export type MatchmakingType = "casual" | "ranked";

export type RoomPhase =
  | "lobby"
  | "prosecutor_turn"
  | "defendant_turn"
  | "jury_voting"
  | "verdict";

export type PlayerRole = "prosecutor" | "defendant" | "spectator";

export type EvidenceSide = "prosecution" | "defense" | "ambiguous";

export interface EvidenceItem {
  id: string;
  title: string;
  description: string;
  assetType: string;
  side: EvidenceSide;
}

export interface CaseScenario {
  id: string;
  title: string;
  facts: string;
  evidence: EvidenceItem[];
}

export interface AvatarConfig {
  /** silhouette archetype id */
  archetype: string;
  /** primary accent color token */
  accent: string;
  /** legal motto shown under avatar */
  motto: string;
}

export interface Profile {
  id: string;
  username: string;
  avatar: AvatarConfig;
  elo: number;
  rank: RankTier;
  casesTried: number;
  convictions: number;
  acquittals: number;
  judgeFavorability: number; // 0-100
  wins: number;
  losses: number;
  createdAt: string;
}

export interface JudgeVerdict {
  verdict: "GUILTY" | "NOT GUILTY";
  reasoning: string;
  punishment: string;
  /** 0-100 decisiveness score, drives Elo swing */
  decisiveness: number;
}

export interface JuryVote {
  voterId: string;
  voterName: string;
  vote: "guilty" | "not_guilty";
}

export interface GameState {
  prosecutorText: string;
  prosecutorEvidence: string[]; // injected evidence exhibit ids
  defendantText: string;
  defendantEvidence: string[];
  /** live-typing drafts (synced, debounced) */
  prosecutorDraft: string;
  defendantDraft: string;
  turnTimerRemaining: number; // seconds
  guiltyVotes: number;
  notGuiltyVotes: number;
  juryVotes: JuryVote[];
  verdict: JudgeVerdict | null;
  /** epoch ms when current turn started */
  turnStartedAt: number | null;
  /** guards against double Elo application across clients */
  eloApplied?: boolean;
}

export interface Room {
  id: string;
  code: string; // 4-letter join code
  phase: RoomPhase;
  matchmakingType: MatchmakingType;
  scenarioId: string;
  hostId: string;
  prosecutorId: string | null;
  defendantId: string | null;
  prosecutorName: string | null;
  defendantName: string | null;
  prosecutorIsAI: boolean;
  defendantIsAI: boolean;
  gameState: GameState;
  createdAt: string;
  /** ranked queue ready flag */
  closed?: boolean;
}

export type AppPhase =
  | "loading"
  | "auth"
  | "gavel-transition"
  | "dashboard"
  | "courtroom";

export const TURN_DURATION = 90; // seconds
export const CHAR_LIMIT = 1000;
export const JURY_SIZE = 5;
