// ===== Judgementia — Elo Resolution Engine =====
import { tierForElo } from "@/lib/data/ranks";

/**
 * Standard Elo expected score formula.
 */
export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

export interface EloAdjustment {
  delta: number;
  newElo: number;
  oldRank: string;
  newRank: string;
  rankChanged: boolean;
  promoted: boolean;
  demoted: boolean;
}

/**
 * Compute Elo delta scaled by the decisiveness of the verdict.
 * @param won did this player win (securing their side's outcome)?
 * @param playerElo current elo
 * @param opponentElo opponent elo
 * @param decisiveness 0-100 verdict decisiveness from the AI judge
 * @param kBase base K-factor
 */
export function resolveElo(
  won: boolean,
  playerElo: number,
  opponentElo: number,
  decisiveness: number,
  kBase = 32,
): EloAdjustment {
  const expected = expectedScore(playerElo, opponentElo);
  const actual = won ? 1 : 0;

  // Scale K-factor by decisiveness: blowouts move more rating.
  const d = Math.max(0, Math.min(100, decisiveness)) / 100; // 0..1
  const k = Math.round(kBase * (0.6 + d * 0.9)); // ~0.6x..1.5x

  const delta = Math.round(k * (actual - expected));
  // Guard against negative elo floors.
  const newElo = Math.max(0, playerElo + delta);

  const oldRank = tierForElo(playerElo);
  const newRank = tierForElo(newElo);

  return {
    delta,
    newElo,
    oldRank,
    newRank,
    rankChanged: oldRank !== newRank,
    promoted: RANK_ORDER.indexOf(newRank) > RANK_ORDER.indexOf(oldRank),
    demoted: RANK_ORDER.indexOf(newRank) < RANK_ORDER.indexOf(oldRank),
  };
}

const RANK_ORDER = [
  "Junior Associate",
  "Partner",
  "Senior Counsel",
  "Magistrate",
  "Chief Justice Elite",
] as const;

/** Did the prosecutor "win" the case? Guilty verdict => prosecutor win. */
export function didProsecutorWin(verdict: "GUILTY" | "NOT GUILTY"): boolean {
  return verdict === "GUILTY";
}
