// ===== Judgementia — Chief Justice Vanguard: prompt + verdict parsing =====
import type { CaseScenario, EvidenceItem, JudgeVerdict } from "@/lib/types";

export const JUDGE_NAME = "Chief Justice Vanguard";

export const JUDGE_SYSTEM_PROMPT = `You are ${JUDGE_NAME}, the presiding AI judge of the Judgementia cyber-legal protocol.
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
- "decisiveness" must be high (80-100) for blowout cases, mid (50-79) for clear-but-contested, low (20-49) for razor-thin splits.`;

export interface JudgeInput {
  scenario: CaseScenario;
  prosecutorText: string;
  defendantText: string;
  /** evidence items explicitly injected into the arguments */
  prosecutorEvidence: EvidenceItem[];
  defendantEvidence: EvidenceItem[];
  ranked: boolean;
  juryVotes?: { guilty: number; notGuilty: number };
}

export function buildJudgeUserPrompt(input: JudgeInput): string {
  const { scenario, prosecutorText, defendantText, ranked } = input;
  const pEv = formatExhibits(input.prosecutorEvidence, "PROSECUTION");
  const dEv = formatExhibits(input.defendantEvidence, "DEFENSE");

  const mode = ranked
    ? "RANKED MODE — apply maximum penalty weight to syntax errors, logical fallacies, and irrelevant evidence presentation. Be unforgiving."
    : "CASUAL MODE — standard scrutiny.";

  return `CASE FILE: ${scenario.title}
FACTS OF THE CASE: ${scenario.facts}

MODE: ${mode}

=== PROSECUTION ARGUMENT ===
${prosecutorText.trim() || "[The prosecution submitted no argument.]"}

${pEv}

=== DEFENSE ARGUMENT ===
${defendantText.trim() || "[The defense submitted no argument.]"}

${dEv}

${input.juryVotes ? `JURY INDICATOR: ${input.juryVotes.guilty} guilty / ${input.juryVotes.notGuilty} not-guilty (advisory only; you hold final authority).` : ""}

Render your decree as the strict JSON object specified in your instructions.`;
}

function formatExhibits(items: EvidenceItem[], side: string): string {
  if (!items.length) return `=== ${side} EVIDENCE EXHIBITS: none presented ===`;
  const lines = items.map(
    (e, i) =>
      `Exhibit ${side[0]}${i + 1}: "${e.title}" [${e.side.toUpperCase()} | ${e.assetType}]\n  ${e.description}`,
  );
  return `=== ${side} EVIDENCE EXHIBITS ===\n${lines.join("\n")}`;
}

export function parseJudgeResponse(raw: string): JudgeVerdict {
  // Tolerate code-fenced JSON.
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Find the outermost JSON object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    text = text.slice(start, end + 1);
  }

  try {
    const obj = JSON.parse(text);
    const verdict = String(obj.verdict).toUpperCase().includes("NOT")
      ? "NOT GUILTY"
      : "GUILTY";
    return {
      verdict,
      reasoning: String(obj.reasoning ?? obj.reasoning_text ?? "").trim() ||
        "The court finds the record insufficiently articulated.",
      punishment: String(obj.punishment ?? obj.sentence ?? "").trim() ||
        "Standard procedural sanction applied.",
      decisiveness: clampInt(Number(obj.decisiveness ?? 50), 20, 99),
    };
  } catch {
    // Last resort heuristic.
    return heuristicVerdict({
      prosecutorText: text,
      defendantText: "",
    });
  }
}

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Deterministic heuristic judge — used when no AI backend is available.
 * Scores arguments by length, structure, and explicit evidence mentions.
 */
export function heuristicVerdict(input: {
  prosecutorText: string;
  defendantText: string;
  prosecutorEvidenceCount?: number;
  defendantEvidenceCount?: number;
}): JudgeVerdict {
  const p = scoreArgument(input.prosecutorText, input.prosecutorEvidenceCount ?? 0);
  const d = scoreArgument(input.defendantText, input.defendantEvidenceCount ?? 0);
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
    // razor thin
    verdict = pRatio >= 0.5 ? "GUILTY" : "NOT GUILTY";
    decisiveness = 25 + Math.round(Math.abs(pRatio - 0.5) * 40);
  }
  decisiveness = clampInt(decisiveness, 20, 92);

  const reasoning =
    verdict === "GUILTY"
      ? `The prosecution's submission carried superior structural weight (score ${p} vs ${d}). The defense failed to introduce sufficient reasonable doubt; critical evidentiary vectors were left uncontested. Culpability is established on the preponderance of the technical record.`
      : `The defense constructed viable reasonable doubt (score ${d} vs ${p}). The prosecution's evidentiary chain contained uncorroborated links and the burden of proof was not discharged. Acquittal is compelled by procedural default.`;

  const punishment =
    verdict === "GUILTY"
      ? "Revocation of all system access credentials, indefinite suspension from the regulated sector, and a compensatory fine assessed at 3x documented damages — with a mandatory referral to federal cyber-prosecution review."
      : "Full restoration of access clearances, expungement of the provisional hold from the defendant's compliance record, and a formal judicial admonishment directed at the prosecution for premature filing.";

  return { verdict, reasoning, punishment, decisiveness };
}

function scoreArgument(text: string, evidenceCount: number): number {
  const t = text.trim();
  if (!t) return 0;
  let score = Math.min(t.length, 1000) * 0.03; // length up to 30
  // structural bonuses
  if (/\btherefore\b/i.test(t)) score += 6;
  if (/\bexhibit\b/i.test(t)) score += 8;
  if (/\bguilt(y)?\b/i.test(t) || /\binnocen(ce|t)\b/i.test(t)) score += 6;
  if (/\bprotocol\b|\bcompliance\b|\bmainframe\b|\bcryptograph/i.test(t)) score += 8;
  const sentences = t.split(/[.!?]+/).filter((s) => s.trim().length > 12).length;
  score += Math.min(sentences, 8) * 2;
  score += evidenceCount * 12;
  // penalties
  if (/(.)\1{6,}/.test(t)) score -= 10; // spam
  return Math.max(0, score);
}
