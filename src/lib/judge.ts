// ===== Chief Justice Vanguard — verdict + objection evaluation =====
import type {
  CaseScenario,
  EvidenceItem,
  JudgeVerdict,
  ObjectionRuling,
  Statement,
} from "@/lib/types";

export const JUDGE_NAME = "Chief Justice Vanguard";

export const JUDGE_SYSTEM_PROMPT = `You are ${JUDGE_NAME}, the presiding AI judge of the Judgementia legal protocol.
You are cold, highly analytical, and strictly professional. You value structural legal logic, technical protocol, and systemic evidence correlation above all else.
Review the evidence, isolate core flaws in the arguments, and deliver an intellectually brutal legal decree.

OUTPUT RULES (NON-NEGOTIABLE):
- Respond with a single JSON object and NOTHING else. No markdown, no prose outside the JSON.
- The JSON must contain exactly these four keys:
  {
    "verdict": "GUILTY" | "NOT GUILTY",
    "reasoning": string,            // intense, detailed legal reasoning. cite the evidence and expose flaws.
    "punishment": string,           // an absurdly serious, high-stakes punishment.
    "decisiveness": number          // integer 0-100. how decisive/clear-cut the verdict is.
  }
- "GUILTY" means the prosecution proved the defendant's culpability beyond reasonable doubt.
- "NOT GUILTY" means the defense created sufficient reasonable doubt.
- "decisiveness" must be high (80-100) for blowout cases, mid (50-79) for clear-but-contested, low (20-49) for razor-thin splits.
- Write in clear modern English, not Shakespearean. Short, punchy, professional sentences.`;

export const OBJECTION_SYSTEM_PROMPT = `You are ${JUDGE_NAME}, presiding over a Judgementia trial.
A lawyer has raised an objection. You must rule on it immediately.
Consider the full case history and the grounds stated for the objection.

OUTPUT RULES (NON-NEGOTIABLE):
- Respond with a single JSON object, nothing else.
- Keys: { "ruling": "SUSTAINED" | "OVERRULED", "reasoning": string }
- "SUSTAINED" means the objection is valid — the targeted statement has a real legal/ logical flaw (hearsay, speculation, contradiction, irrelevant, improper).
- "OVERRULED" means the objection lacks merit — the statement is admissible.
- Keep reasoning to 1-3 clear sentences. Modern English, not Shakespearean.`;

export interface VerdictInput {
  scenario: CaseScenario;
  statements: Statement[];
  allEvidence: EvidenceItem[];
  ranked: boolean;
  juryVotes?: { guilty: number; notGuilty: number };
}

export function buildVerdictUserPrompt(input: VerdictInput): string {
  const { scenario, statements, ranked } = input;
  const pEv = input.allEvidence.filter((e) =>
    statements.some((s) => s.side === "prosecution" && s.evidenceIds.includes(e.id)),
  );
  const dEv = input.allEvidence.filter((e) =>
    statements.some((s) => s.side === "defense" && s.evidenceIds.includes(e.id)),
  );

  const mode = ranked
    ? "RANKED MODE — apply maximum penalty weight to logical fallacies, contradictions, and irrelevant evidence. Be unforgiving."
    : "CASUAL MODE — standard scrutiny.";

  const history = statements
    .map((s, i) => {
      const evList = s.evidenceIds
        .map((id) => input.allEvidence.find((e) => e.id === id)?.title)
        .filter(Boolean)
        .join(", ");
      const objList = s.objections.length
        ? s.objections
            .map(
              (o) =>
                `\n    [OBJECTION by ${o.objectorSide}: "${o.grounds}" → ${o.ruling.ruling}: ${o.ruling.reasoning}]`,
            )
            .join("")
        : "";
      return `(${i + 1}) [Round ${s.round} — ${s.side.toUpperCase()}${s.authorIsAI ? " / AI" : ""}]${evList ? ` (evidence: ${evList})` : ""}:\n${s.text}${objList}`;
    })
    .join("\n\n");

  return `CASE FILE: ${scenario.title}
FACTS: ${scenario.facts}

MODE: ${mode}

=== FULL TRIAL HISTORY (${statements.length} statements) ===
${history || "[No statements were filed.]"}

=== EVIDENCE PRESENTED BY PROSECUTION ===
${formatExhibits(pEv, "PROSECUTION")}

=== EVIDENCE PRESENTED BY DEFENSE ===
${formatExhibits(dEv, "DEFENSE")}

${input.juryVotes ? `JURY INDICATOR: ${input.juryVotes.guilty} guilty / ${input.juryVotes.notGuilty} not-guilty (advisory only; you hold final authority).` : ""}

Render your decree as the strict JSON object specified in your instructions.`}

function formatExhibits(items: EvidenceItem[], side: string): string {
  if (!items.length) return `=== ${side} EVIDENCE EXHIBITS: none presented ===`;
  const lines = items.map(
    (e, i) =>
      `Exhibit ${side[0]}${i + 1}: "${e.title}" [${e.side.toUpperCase()} | ${e.assetType}]\n  ${e.description}`,
  );
  return `=== ${side} EVIDENCE EXHIBITS ===\n${lines.join("\n")}`;
}

export interface ObjectionInput {
  scenario: CaseScenario;
  statements: Statement[];
  allEvidence: EvidenceItem[];
  objectorSide: "prosecution" | "defense";
  targetIndex: number;
  grounds: string;
}

export function buildObjectionUserPrompt(input: ObjectionInput): string {
  const target = input.statements[input.targetIndex];
  const history = input.statements
    .map(
      (s, i) =>
        `(${i + 1}) [Round ${s.round} — ${s.side.toUpperCase()}${s.authorIsAI ? " / AI" : ""}]: ${s.text}`,
    )
    .join("\n");

  return `CASE: ${input.scenario.title}
FACTS: ${input.scenario.facts}

=== TRIAL HISTORY ===
${history}

=== OBJECTION ===
Objector: ${input.objectorSide.toUpperCase()}
Target statement (#${input.targetIndex + 1}, by ${target?.side.toUpperCase()}): "${target?.text ?? "[none]"}"
Grounds for objection: "${input.grounds}"

Rule on this objection as the strict JSON object specified in your instructions.`;
}

export function parseJudgeResponse(raw: string): JudgeVerdict {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(text);
    const verdict = String(obj.verdict).toUpperCase().includes("NOT")
      ? "NOT GUILTY"
      : "GUILTY";
    return {
      verdict,
      reasoning:
        String(obj.reasoning ?? "").trim() ||
        "The court finds the record insufficiently articulated.",
      punishment:
        String(obj.punishment ?? "").trim() ||
        "Standard procedural sanction applied.",
      decisiveness: clampInt(Number(obj.decisiveness ?? 50), 20, 99),
    };
  } catch {
    return heuristicVerdict({ statements: input_statements_from_text(text) });
  }
}

export function parseObjectionResponse(raw: string): ObjectionRuling {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(text);
    const ruling = String(obj.ruling).toUpperCase().includes("SUSTAIN")
      ? "SUSTAINED"
      : "OVERRULED";
    return {
      ruling,
      reasoning:
        String(obj.reasoning ?? "").trim() ||
        (ruling === "SUSTAINED"
          ? "The statement violates procedural rules and is struck from consideration."
          : "The objection lacks merit. The statement stands."),
    };
  } catch {
    // heuristic: sustained if grounds mention a real flaw keyword
    const g = text.toLowerCase();
    const sustained = /hearsay|speculat|contradict|irrelevant|improper|assume|no evidence|fallacy/.test(g);
    return {
      ruling: sustained ? "SUSTAINED" : "OVERRULED",
      reasoning: sustained
        ? "The objection identifies a genuine procedural flaw. Sustained."
        : "The objection does not identify a clear procedural violation. Overruled.",
    };
  }
}

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Deterministic heuristic judge — used when no AI backend is available. */
export function heuristicVerdict(input: {
  statements?: Statement[];
  prosecutorText?: string;
  defendantText?: string;
  prosecutorEvidenceCount?: number;
  defendantEvidenceCount?: number;
}): JudgeVerdict {
  let pText = input.prosecutorText ?? "";
  let dText = input.defendantText ?? "";
  let pEv = input.prosecutorEvidenceCount ?? 0;
  let dEv = input.defendantEvidenceCount ?? 0;
  if (input.statements) {
    pText = input.statements.filter((s) => s.side === "prosecution").map((s) => s.text).join(" ");
    dText = input.statements.filter((s) => s.side === "defense").map((s) => s.text).join(" ");
    pEv = input.statements.filter((s) => s.side === "prosecution").reduce((n, s) => n + s.evidenceIds.length, 0);
    dEv = input.statements.filter((s) => s.side === "defense").reduce((n, s) => n + s.evidenceIds.length, 0);
    // sustained objections reduce that side's score
    const pStruck = input.statements.filter((s) => s.side === "prosecution").reduce((n, s) => n + s.objections.filter((o) => o.ruling.ruling === "SUSTAINED").length, 0);
    const dStruck = input.statements.filter((s) => s.side === "defense").reduce((n, s) => n + s.objections.filter((o) => o.ruling.ruling === "SUSTAINED").length, 0);
    pEv = Math.max(0, pEv - pStruck);
    dEv = Math.max(0, dEv - dStruck);
  }
  const p = scoreArgument(pText, pEv);
  const d = scoreArgument(dText, dEv);
  const total = p + d || 1;
  const pRatio = p / total;
  let verdict: "GUILTY" | "NOT GUILTY";
  let decisiveness: number;
  if (pRatio > 0.62) {
    verdict = "GUILTY";
    decisiveness = Math.round(50 + (pRatio - 0.62) * 130);
  } else if (pRatio < 0.38) {
    verdict = "NOT GUILTY";
    decisiveness = Math.round(50 + (0.38 - pRatio) * 130);
  } else {
    verdict = pRatio >= 0.5 ? "GUILTY" : "NOT GUILTY";
    decisiveness = 25 + Math.round(Math.abs(pRatio - 0.5) * 40);
  }
  decisiveness = clampInt(decisiveness, 20, 92);
  const reasoning =
    verdict === "GUILTY"
      ? `The prosecution's case carried more weight (score ${p} vs ${d}). The defense failed to create enough reasonable doubt. Key evidence went unchallenged. Culpability is established.`
      : `The defense created reasonable doubt (score ${d} vs ${p}). The prosecution's evidence chain had gaps and the burden of proof was not met. Acquittal follows.`;
  const punishment =
    verdict === "GUILTY"
      ? "All system credentials revoked, indefinite suspension from the sector, and a fine set at 3x the documented damages — plus a criminal prosecution referral."
      : "Full restoration of access, expungement of the provisional hold, and a formal judicial warning to the prosecution for premature filing.";
  return { verdict, reasoning, punishment, decisiveness };
}

function scoreArgument(text: string, evidenceCount: number): number {
  const t = text.trim();
  if (!t) return 0;
  let score = Math.min(t.length, 1000) * 0.03;
  if (/\btherefore\b/i.test(t)) score += 6;
  if (/\bexhibit\b/i.test(t)) score += 8;
  if (/\bguilt(y)?\b|\binnocen(ce|t)\b/i.test(t)) score += 6;
  if (/\bprotocol\b|\bcompliance\b|\bmainframe\b|\bcryptograph|\bserver\b|\bcode\b|\blog\b/i.test(t)) score += 8;
  const sentences = t.split(/[.!?]+/).filter((s) => s.trim().length > 12).length;
  score += Math.min(sentences, 8) * 2;
  score += evidenceCount * 12;
  if (/(.)\1{6,}/.test(t)) score -= 10;
  return Math.max(0, score);
}

// helper for parse fallback when only raw text is available
function input_statements_from_text(text: string): { text: string; side: "prosecution"; round: number; evidenceIds: string[]; objections: never[]; id: string; at: number }[] {
  return [{ id: "x", round: 1, side: "prosecution", text, evidenceIds: [], objections: [], at: Date.now() }];
}
