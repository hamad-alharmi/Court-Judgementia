// ===== Judgementia — Rank Tier System =====
import type { RankTier } from "@/lib/types";

export interface RankTierInfo {
  tier: RankTier;
  minElo: number;
  label: string;
  /** short code shown in leaderboards */
  code: string;
  blurb: string;
}

export const RANK_TIERS: RankTierInfo[] = [
  {
    tier: "Junior Associate",
    minElo: 0,
    label: "Junior Associate",
    code: "JA",
    blurb: "Fresh to the bar. Procedural fundamentals only.",
  },
  {
    tier: "Partner",
    minElo: 1200,
    label: "Partner",
    code: "PT",
    blurb: "Seasoned litigator with case mileage.",
  },
  {
    tier: "Senior Counsel",
    minElo: 1500,
    label: "Senior Counsel",
    code: "SC",
    blurb: "Elite rhetoric. Rarely flinches under cross.",
  },
  {
    tier: "Magistrate",
    minElo: 1800,
    label: "Magistrate",
    code: "MG",
    blurb: "Commands the chamber. Calculated precision.",
  },
  {
    tier: "Chief Justice Elite",
    minElo: 2100,
    label: "Chief Justice Elite",
    code: "CJ",
    blurb: "Apex of the bench. Verdicts bend to their logic.",
  },
];

export function tierForElo(elo: number): RankTier {
  let result: RankTier = "Junior Associate";
  for (const t of RANK_TIERS) {
    if (elo >= t.minElo) result = t.tier;
  }
  return result;
}

export function tierInfoForElo(elo: number): RankTierInfo {
  let result = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (elo >= t.minElo) result = t;
  }
  return result;
}

export function nextTierInfo(elo: number): RankTierInfo | null {
  const current = tierInfoForElo(elo);
  const idx = RANK_TIERS.findIndex((t) => t.tier === current.tier);
  if (idx < 0 || idx >= RANK_TIERS.length - 1) return null;
  return RANK_TIERS[idx + 1];
}

export function progressToNextTier(
  elo: number,
): { pct: number; remaining: number; next: RankTierInfo | null } {
  const current = tierInfoForElo(elo);
  const next = nextTierInfo(elo);
  if (!next) return { pct: 100, remaining: 0, next: null };
  const span = next.minElo - current.minElo;
  const progressed = elo - current.minElo;
  return {
    pct: Math.max(0, Math.min(100, Math.round((progressed / span) * 100))),
    remaining: Math.max(0, next.minElo - elo),
    next,
  };
}
