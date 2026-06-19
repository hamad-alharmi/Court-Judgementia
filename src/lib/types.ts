// ===== Judgementia — Core Type System (v2: multi-round + objections + setup) =====

export type RankTier =
  | "Junior Associate"
  | "Partner"
  | "Senior Counsel"
  | "Magistrate"
  | "Chief Justice Elite";

export type MatchmakingType = "casual" | "ranked";

export type RoomPhase =
  | "lobby"
  | "case_intro"
  | "prosecutor_turn"
  | "defendant_turn"
  | "jury_voting"
  | "verdict";

export type PlayerRole = "prosecutor" | "defendant" | "spectator";

export type EvidenceSide = "prosecution" | "defense" | "ambiguous";

export type AIDifficulty = "easy" | "medium" | "hard";

export type AIRole = "prosecution" | "defense";

export type UITheme = "gold" | "crimson" | "jade" | "violet" | "cyan";

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
  /** custom theme tag (e.g. "cyber", "murder", "joke") — empty for presets */
  theme?: string;
  /** true when AI-generated on the spot */
  generated?: boolean;
}

export interface AvatarConfig {
  archetype: string;
  accent: string;
  motto: string;
}

export interface JudgeVerdict {
  verdict: "GUILTY" | "NOT GUILTY";
  reasoning: string;
  punishment: string;
  /** 0-100 decisiveness score, drives Elo swing */
  decisiveness: number;
}

export interface ObjectionRuling {
  ruling: "SUSTAINED" | "OVERRULED";
  reasoning: string;
}

export interface Objection {
  id: string;
  objectorId: string;
  objectorName: string;
  objectorSide: PlayerRole;
  /** which statement this objection targets (index into statements[]) */
  targetIndex: number;
  grounds: string;
  ruling: ObjectionRuling;
  at: number;
}

export interface Statement {
  id: string;
  round: number; // 1-indexed
  side: PlayerRole;
  text: string;
  evidenceIds: string[];
  /** live draft sync (only for the in-progress current statement) */
  draft?: string;
  objections: Objection[];
  at: number;
  authorIsAI?: boolean;
}

export interface JuryVote {
  voterId: string;
  voterName: string;
  vote: "guilty" | "not_guilty";
}

export interface GameState {
  /** chronological list of all filed statements (across all rounds) */
  statements: Statement[];
  /** remaining objections per side: { prosecution: n, defense: n } */
  objectionsLeft: { prosecution: number; defense: number };
  /** current round (1-indexed). increments after both sides have spoken. */
  currentRound: number;
  turnTimerRemaining: number; // seconds
  turnStartedAt: number | null;
  guiltyVotes: number;
  notGuiltyVotes: number;
  juryVotes: JuryVote[];
  verdict: JudgeVerdict | null;
  /** guards against double Elo application across clients */
  eloApplied?: boolean;
  /** active objection being evaluated (transient) */
  pendingObjection?: Objection | null;
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
  /** room setup config */
  statementCount: number; // per side
  aiDifficulty: AIDifficulty;
  caseTheme: string; // free-text theme for AI case generation
  gameState: GameState;
  createdAt: string;
  closed?: boolean;
}

export interface MatchHistoryEntry {
  scenarioId: string;
  verdict: string;
  won: boolean;
  eloDelta: number;
  at: number;
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
  /** admin flag — grants admin panel + Lawliet character */
  isAdmin?: boolean;
  /** equipped character theme (admin can equip "lawliet") */
  character?: string;
  /** last 20 match outcomes (most recent last) */
  matchHistory?: MatchHistoryEntry[];
  createdAt: string;
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
export const DEFAULT_STATEMENTS = 4; // ranked default per side
export const OBJECTIONS_PER_SIDE = 2;
export const RANKED_STATEMENT_COUNT = 4;

export const STATEMENT_OPTIONS = [1, 2, 3, 4, 6, 8] as const;
export const AI_DIFFICULTIES: AIDifficulty[] = ["easy", "medium", "hard"];

export const CASE_THEME_PRESETS = [
  "cyber",
  "corporate fraud",
  "murder mystery",
  "heist",
  "supply chain",
  "joke",
  "cold case",
  "conspiracy",
] as const;
