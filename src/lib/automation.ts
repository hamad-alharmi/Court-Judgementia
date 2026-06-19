// ===== Judgementia — Automation Handlers (v2) =====
// Multi-round AI arguments + difficulty-scaled jury + objection heuristics.
import type {
  AIDifficulty,
  CaseScenario,
  EvidenceItem,
  JuryVote,
  Objection,
  ObjectionRuling,
  PlayerRole,
  Statement,
} from "@/lib/types";
import { JURY_SIZE } from "@/lib/types";
import { heuristicVerdict } from "@/lib/judge";

const PROSECUTOR_OPENERS = [
  "The record establishes culpability beyond any reasonable doubt.",
  "The evidence does not lie, and it points straight at the defendant.",
  "Every piece of evidence converges on one conclusion: guilt.",
  "The prosecution presents an unbroken chain leading to the accused.",
];

const DEFENSE_OPENERS = [
  "The prosecution's case is built on assumption, not proof.",
  "Reasonable doubt is the entire record here.",
  "You're asked to convict on correlation. The law demands causation.",
  "The defense will show the chain of evidence collapses under scrutiny.",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Generate a structured argument for a specific round. */
export function generateAIArgument(
  role: PlayerRole,
  scenario: CaseScenario,
  evidence: EvidenceItem[],
  ranked: boolean,
  difficulty: AIDifficulty,
  round: number,
  totalRounds: number,
  priorStatements: Statement[],
): string {
  const isProsecution = role === "prosecutor";
  const seed = hashStr(scenario.id + role + round);
  const opener = isProsecution
    ? pick(PROSECUTOR_OPENERS, seed)
    : pick(DEFENSE_OPENERS, seed);

  const favored = evidence.filter((e) =>
    isProsecution
      ? e.side === "prosecution" || e.side === "ambiguous"
      : e.side === "defense" || e.side === "ambiguous",
  );
  // rotate evidence by round so AI uses different exhibits each round
  const offset = (round - 1) % Math.max(1, favored.length);
  const primary = favored[offset] || evidence[offset % evidence.length];
  const secondary = favored[(offset + 1) % Math.max(1, favored.length)];
  const showSecondary = totalRounds >= 2 && round >= 2 && secondary && secondary !== primary;

  const lines: string[] = [opener, ""];

  // Round-aware content
  if (round === 1) {
    lines.push(
      isProsecution
        ? `Here are the facts: ${scenario.facts.toLowerCase()} This was not an accident. It was a deliberate breach.`
        : `Let's start with the facts, because the prosecution has overstated them: ${scenario.facts.toLowerCase()} Notice the word "accused". That is a claim, not a proven fact.`,
    );
  } else {
    // reference the opponent's prior statement
    const oppSide = isProsecution ? "defense" : "prosecution";
    const oppLast = [...priorStatements].reverse().find((s) => s.side === oppSide);
    if (oppLast) {
      const snippet = oppLast.text.slice(0, 120).replace(/\s+/g, " ").trim();
      lines.push(
        isProsecution
          ? `The defense claimed: "${snippet}..." — but that does not explain away the technical record.`
          : `The prosecution argued: "${snippet}..." — yet the burden of proof remains unmet.`,
      );
    } else {
      lines.push(isProsecution ? "Building on my opening:" : "To continue my defense:");
    }
  }

  if (primary) {
    lines.push("");
    lines.push(
      isProsecution
        ? `Look at "${primary.title}". ${primary.description} This places the defendant squarely at the scene of the breach.`
        : `Now examine "${primary.title}". ${primary.description} This shows the system itself was already broken — you cannot pin this on my client.`,
    );
  }

  if (showSecondary && secondary) {
    lines.push("");
    lines.push(
      isProsecution
        ? `Also consider "${secondary.title}". ${secondary.description} These two signals together rule out coincidence.`
        : `Furthermore, "${secondary.title}". ${secondary.description} If the system was already misconfigured, attribution to my client is unsound.`,
    );
  }

  lines.push("");
  // Difficulty-scaled closing
  if (difficulty === "hard") {
    lines.push(
      isProsecution
        ? `Every protocol violation, every anomalous access, points one direction. The motion to convict must carry${
            round === totalRounds ? ". GUILTY." : "."
          }`
        : `Examined with maximum rigor, the prosecution's case reveals gaps, not proof. Where certainty is demanded and certainty is absent${
            round === totalRounds ? ", acquittal follows. NOT GUILTY." : ", doubt remains."
          }`,
    );
  } else if (difficulty === "easy") {
    lines.push(
      isProsecution
        ? `So the defendant is guilty. ${round === totalRounds ? "GUILTY." : ""}`
        : `So my client is innocent. ${round === totalRounds ? "NOT GUILTY." : ""}`,
    );
  } else {
    lines.push(
      isProsecution
        ? `On the whole record, the prosecution moves for ${round === totalRounds ? "a verdict of GUILTY." : "conviction."}`
        : `The defense moves for ${round === totalRounds ? "a verdict of NOT GUILTY." : "acquittal."}`,
    );
  }

  return lines.join("\n");
}

/** Should the AI raise an objection? Difficulty-based heuristic. */
export function maybeAIObjection(
  aiSide: PlayerRole,
  difficulty: AIDifficulty,
  statements: Statement[],
  objectionsLeft: number,
): { targetIndex: number; grounds: string } | null {
  if (objectionsLeft <= 0) return null;
  const chance = difficulty === "hard" ? 0.4 : difficulty === "medium" ? 0.2 : 0.05;
  if (Math.random() > chance) return null;
  // target the most recent opposing statement
  const oppSide = aiSide === "prosecution" ? "defense" : "prosecution";
  const oppStmts = statements
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.side === oppSide);
  if (oppStmts.length === 0) return null;
  const last = oppStmts[oppStmts.length - 1];
  const groundsPool = [
    "The statement relies on speculation, not evidence.",
    "Counsel is introducing hearsay with no foundation.",
    "This argument contradicts counsel's own earlier statement.",
    "The point is irrelevant to the charges at hand.",
    "Counsel assumes facts not in evidence.",
  ];
  return {
    targetIndex: last.i,
    grounds: groundsPool[Math.floor(Math.random() * groundsPool.length)],
  };
}

/** Heuristic objection ruling when no AI backend is available. */
export function heuristicObjection(grounds: string): ObjectionRuling {
  const g = grounds.toLowerCase();
  const sustained = /hearsay|speculat|contradict|irrelevant|improper|assume|no evidence|fallacy|not in evidence/.test(g);
  return {
    ruling: sustained ? "SUSTAINED" : "OVERRULED",
    reasoning: sustained
      ? "The objection identifies a genuine procedural flaw. Sustained — the statement is given reduced weight."
      : "The objection does not identify a clear procedural violation. Overruled.",
  };
}

/** Simulate a 5-person jury vote split, difficulty-scaled. */
export function simulateJuryVotes(
  statements: Statement[],
  decisiveness: number,
  difficulty: AIDifficulty,
): { guilty: number; notGuilty: number; votes: JuryVote[] } {
  const v = heuristicVerdict({ statements });
  const pScore = scoreSide(statements, "prosecution");
  const dScore = scoreSide(statements, "defense");
  const total = pScore + dScore || 1;
  let pProb = pScore / total;
  if (v.verdict === "GUILTY") pProb += (decisiveness / 100) * 0.15;
  else pProb -= (decisiveness / 100) * 0.15;
  // difficulty nudges toward the AI's side if AI is involved — kept simple
  if (difficulty === "hard") pProb += 0.0;
  pProb = Math.max(0.05, Math.min(0.95, pProb));

  const votes: JuryVote[] = [];
  let guilty = 0;
  const names = ["Juror A", "Juror B", "Juror C", "Juror D", "Juror E"];
  for (let i = 0; i < JURY_SIZE; i++) {
    const variance = (hashStr(names[i] + statements.length) % 20) / 100 - 0.1;
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

function scoreSide(statements: Statement[], side: PlayerRole): number {
  let score = 0;
  for (const s of statements.filter((x) => x.side === side)) {
    score += Math.min(s.text.length, 1000) * 0.03;
    if (/\btherefore\b/i.test(s.text)) score += 6;
    if (/\bexhibit\b/i.test(s.text)) score += 8;
    score += s.evidenceIds.length * 12;
    // sustained objections against this statement reduce its score
    score -= s.objections.filter((o) => o.ruling.ruling === "SUSTAINED").length * 10;
  }
  return Math.max(0, score);
}

/** Build an Objection object (without ruling — ruling comes from the judge). */
export function buildObjection(
  objectorId: string,
  objectorName: string,
  objectorSide: PlayerRole,
  targetIndex: number,
  grounds: string,
): Objection {
  return {
    id: "obj-" + Math.random().toString(36).slice(2, 10),
    objectorId,
    objectorName,
    objectorSide,
    targetIndex,
    grounds,
    ruling: { ruling: "OVERRULED", reasoning: "Pending." },
    at: Date.now(),
  };
}
