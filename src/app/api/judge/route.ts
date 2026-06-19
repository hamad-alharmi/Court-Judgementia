// ===== /api/judge — Chief Justice Vanguard: verdicts + objection rulings =====
import { NextRequest, NextResponse } from "next/server";
import {
  buildObjectionUserPrompt,
  buildVerdictUserPrompt,
  heuristicVerdict,
  JUDGE_SYSTEM_PROMPT,
  OBJECTION_SYSTEM_PROMPT,
  parseJudgeResponse,
  parseObjectionResponse,
} from "@/lib/judge";
import { heuristicObjection } from "@/lib/automation";
import { resolveElo, didProsecutorWin } from "@/lib/elo";
import type {
  CaseScenario,
  EvidenceItem,
  JudgeVerdict,
  ObjectionRuling,
  Statement,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | { action: "verdict"; body: VerdictBody }
  | { action: "objection"; body: ObjectionBody };

interface VerdictBody {
  scenario: CaseScenario;
  statements: Statement[];
  allEvidence: EvidenceItem[];
  ranked: boolean;
  juryVotes?: { guilty: number; notGuilty: number };
  prosecutorElo: number;
  defendantElo: number;
}

interface ObjectionBody {
  scenario: CaseScenario;
  statements: Statement[];
  allEvidence: EvidenceItem[];
  objectorSide: "prosecution" | "defense";
  targetIndex: number;
  grounds: string;
}

async function runGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_GEMINI_KEY");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
    },
  });
  const res = await model.generateContent(userPrompt);
  return res.response.text();
}

async function runZAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const ZAIModule: any = await import("z-ai-web-dev-sdk");
  const ZAI = ZAIModule.default || ZAIModule;
  const zai = await ZAI.create();
  const completion: any = await zai.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1200,
  });
  return completion.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: Action["action"] = body.action === "objection" ? "objection" : "verdict";

    if (action === "objection") {
      return await handleObjection(body as ObjectionBody);
    }
    return await handleVerdict(body as VerdictBody);
  } catch (e) {
    console.error("judge route error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "judge-failure" },
      { status: 500 },
    );
  }
}

async function handleVerdict(body: VerdictBody) {
  const {
    scenario,
    statements,
    allEvidence,
    ranked,
    juryVotes,
    prosecutorElo,
    defendantElo,
  } = body;

  const userPrompt = buildVerdictUserPrompt({
    scenario,
    statements,
    allEvidence,
    ranked,
    juryVotes,
  });

  let verdict: JudgeVerdict;
  let engine = "heuristic";

  if (process.env.GEMINI_API_KEY) {
    try {
      const raw = await runGemini(JUDGE_SYSTEM_PROMPT, userPrompt);
      verdict = parseJudgeResponse(raw);
      engine = "gemini";
    } catch (e) {
      console.error("gemini verdict failed, falling back", e);
      verdict = heuristicVerdict({ statements });
    }
  } else {
    try {
      const raw = await runZAI(JUDGE_SYSTEM_PROMPT, userPrompt);
      if (raw && raw.trim()) {
        verdict = parseJudgeResponse(raw);
        engine = "z-ai";
      } else {
        verdict = heuristicVerdict({ statements });
      }
    } catch (e) {
      console.error("z-ai verdict failed, falling back", e);
      verdict = heuristicVerdict({ statements });
    }
  }

  const prosecutorWon = didProsecutorWin(verdict.verdict);
  const prosecutorAdjustment = resolveElo(
    prosecutorWon,
    prosecutorElo,
    defendantElo,
    verdict.decisiveness,
  );
  const defendantAdjustment = resolveElo(
    !prosecutorWon,
    defendantElo,
    prosecutorElo,
    verdict.decisiveness,
  );

  return NextResponse.json({
    verdict,
    eloAdjustments: { prosecutor: prosecutorAdjustment, defendant: defendantAdjustment },
    engine,
  });
}

async function handleObjection(body: ObjectionBody) {
  const { scenario, statements, allEvidence, objectorSide, targetIndex, grounds } = body;
  const userPrompt = buildObjectionUserPrompt({
    scenario,
    statements,
    allEvidence,
    objectorSide,
    targetIndex,
    grounds,
  });

  let ruling: ObjectionRuling;
  let engine = "heuristic";

  if (process.env.GEMINI_API_KEY) {
    try {
      const raw = await runGemini(OBJECTION_SYSTEM_PROMPT, userPrompt);
      ruling = parseObjectionResponse(raw);
      engine = "gemini";
    } catch (e) {
      console.error("gemini objection failed, falling back", e);
      ruling = heuristicObjection(grounds);
    }
  } else {
    try {
      const raw = await runZAI(OBJECTION_SYSTEM_PROMPT, userPrompt);
      if (raw && raw.trim()) {
        ruling = parseObjectionResponse(raw);
        engine = "z-ai";
      } else {
        ruling = heuristicObjection(grounds);
      }
    } catch (e) {
      console.error("z-ai objection failed, falling back", e);
      ruling = heuristicObjection(grounds);
    }
  }

  return NextResponse.json({ ruling, engine });
}
