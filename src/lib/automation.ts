// ===== Judgementia — Automation Handlers =====
// Generates AI lawyer arguments and simulates a 5-person jury vote split
// based on the logical weight of the submitted text arguments.
import type { CaseScenario, EvidenceItem, JuryVote, PlayerRole } from "@/lib/types";
import { JURY_SIZE } from "@/lib/types";
import { heuristicVerdict } from "@/lib/judge";

const PROSECUTOR_OPENERS = [
  "The record before this chamber establishes culpability beyond any reasonable threshold.",
  "Counsel, the technical ledger does not lie, and it indicts the defendant.",
  "Every vector of evidence converges on a single, inescapable conclusion of guilt.",
  "The prosecution presents an unbroken chain of causation leading directly to the accused.",
];

const DEFENSE_OPENERS = [
  "The prosecution's narrative is a scaffold built on uncorroborated assumption.",
  "Reasonable doubt is not a technicality here — it is the entire record.",
  "Counsel asks you to convict on correlation; the law demands causation, which is absent.",
  "The defense will demonstrate that the chain of custody collapses under scrutiny.",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Generate a structured, high-quality argument for an AI lawyer.
 * References the case facts and the strongest available evidence.
 */
export function generateAIArgument(
  role: PlayerRole,
  scenario: CaseScenario,
  evidence: EvidenceItem[],
  ranked: boolean,
): string {
  const isProsecution = role === "prosecutor";
  const seed = hashStr(scenario.id + role);
  const opener = isProsecution
    ? pick(PROSECUTOR_OPENERS, seed)
    : pick(DEFENSE_OPENERS, seed);

  // pick evidence favoring this side, else ambiguous
  const favored = evidence.filter((e) =>
    isProsecution
      ? e.side === "prosecution" || e.side === "ambiguous"
      : e.side === "defense" || e.side === "ambiguous",
  );
  const primary = favored[0] || evidence[0];

  const lines: string[] = [opener, ""];

  lines.push(
    isProsecution
      ? `The facts are uncontested: ${scenario.facts.toLowerCase()} This is not an accident; it is a documented breach of protocol executed with intent.`
      : `Let us begin with the facts, because the prosecution has overstated them: ${scenario.facts.toLowerCase()} Notice the word "intentionally" — that is an assertion, not a proven element, and the burden remains unmet.`,
  );

  if (primary) {
    lines.push("");
    lines.push(
      isProsecution
        ? `Consider Exhibit "${primary.title}" (${primary.assetType}). ${primary.description} This record places the defendant's credential at the locus of the breach with temporal precision that admits no innocent explanation.`
        : `Now examine Exhibit "${primary.title}". ${primary.description} Far from proving culpability, this demonstrates either institutional failure or, at minimum, an environment where the defendant's actions were consistent with authorized procedure. The prosecution cannot exclude this interpretation.`,
    );
  }

  // second evidence point if present
  const secondary = favored[1] && favored[1] !== primary ? favored[1] : null;
  if (secondary) {
    lines.push("");
    lines.push(
      isProsecution
        ? `The court must also weigh Exhibit "${secondary.title}". ${secondary.description} The convergence of these independent signals eliminates the hypothesis of coincidence.`
        : `Furthermore, Exhibit "${secondary.title}" compounds the doubt. ${secondary.description} If the system itself was already compromised or misconfigured, attribution to my client is scientifically unsound.`,
    );
  }

  lines.push("");
  if (ranked) {
    lines.push(
      isProsecution
        ? "Under ranked scrutiny the standard sharpens, not softens: every protocol violation, every anomalous access window, points one direction. The motion to convict must carry."
        : "Ranked scrutiny cuts both ways. The prosecution's case, examined with maximum rigor, reveals gaps, not proof. Where certainty is demanded and certainty is absent, acquittal follows.",
    );
  } else {
    lines.push(
      isProsecution
        ? "Therefore, on the totality of the technical record, the prosecution moves for a verdict of GUILTY."
        : "Therefore, the defense moves this chamber to return a verdict of NOT GUILTY.",
    );
  }

  return lines.join("\n");
}

/**
 * Simulate a realistic 5-person jury vote split from the logical weight
 * of the submitted arguments.
 */
export function simulateJuryVotes(
  prosecutorText: string,
  defendantText: string,
  prosecutorEvidenceCount: number,
  defendantEvidenceCount: number,
  decisiveness: number,
): { guilty: number; notGuilty: number; votes: JuryVote[] } {
  const v = heuristicVerdict({
    prosecutorText,
    defendantText,
    prosecutorEvidenceCount,
    defendantEvidenceCount,
  });
  // base conviction probability from heuristic prosecutor ratio
  const pScore = scoreFor(prosecutorText, prosecutorEvidenceCount);
  const dScore = scoreFor(defendantText, defendantEvidenceCount);
  const total = pScore + dScore || 1;
  let pProb = pScore / total;

  // nudge toward the judge's decisiveness direction
  if (v.verdict === "GUILTY") pProb += (decisiveness / 100) * 0.15;
  else pProb -= (decisiveness / 100) * 0.15;
  pProb = Math.max(0.05, Math.min(0.95, pProb));

  const votes: JuryVote[] = [];
  let guilty = 0;
  const names = ["Juror A", "Juror B", "Juror C", "Juror D", "Juror E"];
  for (let i = 0; i < JURY_SIZE; i++) {
    // add slight per-juror variance
    const variance = (hashStr(names[i] + prosecutorText.length) % 20) / 100 - 0.1;
    const convict = Math.random() < pProb + variance;
    if (convict) guilty++;
    votes.push({
      voterId: "juror-" + (i + 1),
      voterName: names[i],
      vote: convict ? "guilty" : "not_guilty",
    });
  }
  return { guilty, notGuilty: JURY_SIZE - guilty, votes };
}

function scoreFor(text: string, evCount: number): number {
  const t = text.trim();
  if (!t) return 0;
  let s = Math.min(t.length, 1000) * 0.03;
  if (/\btherefore\b/i.test(t)) s += 6;
  if (/\bexhibit\b/i.test(t)) s += 8;
  s += evCount * 12;
  return s;
}
