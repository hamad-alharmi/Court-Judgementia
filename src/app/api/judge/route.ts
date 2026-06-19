// ===== /api/judge — Chief Justice Vanguard verdict + Elo resolution =====
import { NextRequest, NextResponse } from "next/server";
import {
  buildJudgeUserPrompt,
  heuristicVerdict,
  JUDGE_SYSTEM_PROMPT,
  parseJudgeResponse,
} from "@/lib/judge";
import { resolveElo, didProsecutorWin } from "@/lib/elo";
import type { CaseScenario, EvidenceItem, JudgeVerdict } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface JudgeRequestBody {
  scenario: CaseScenario;
  prosecutorText: string;
  defendantText: string;
  prosecutorEvidence: EvidenceItem[];
  defendantEvidence: EvidenceItem[];
  ranked: boolean;
  juryVotes?: { guilty: number; notGuilty: number };
  prosecutorElo: number;
  defendantElo: number;
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
    const body = (await req.json()) as JudgeRequestBody;
    const {
      scenario,
      prosecutorText,
      defendantText,
      prosecutorEvidence,
      defendantEvidence,
      ranked,
      juryVotes,
      prosecutorElo,
      defendantElo,
    } = body;

    const userPrompt = buildJudgeUserPrompt({
      scenario,
      prosecutorText,
      defendantText,
      prosecutorEvidence,
      defendantEvidence,
      ranked,
      juryVotes,
    });

    let verdict: JudgeVerdict;
    let engine = "heuristic";

    // 1) Gemini (production)
    if (process.env.GEMINI_API_KEY) {
      try {
        const raw = await runGemini(JUDGE_SYSTEM_PROMPT, userPrompt);
        verdict = parseJudgeResponse(raw);
        engine = "gemini";
      } catch (e) {
        console.error("gemini judge failed, falling back", e);
        verdict = fallbackVerdict(body);
      }
    } else {
      // 2) z-ai-web-dev-sdk (sandbox preview)
      try {
        const raw = await runZAI(JUDGE_SYSTEM_PROMPT, userPrompt);
        if (raw && raw.trim()) {
          verdict = parseJudgeResponse(raw);
          engine = "z-ai";
        } else {
          verdict = fallbackVerdict(body);
        }
      } catch (e) {
        console.error("z-ai judge failed, falling back", e);
        verdict = fallbackVerdict(body);
      }
    }

    // ----- Elo resolution (computed server-side) -----
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
      eloAdjustments: {
        prosecutor: prosecutorAdjustment,
        defendant: defendantAdjustment,
      },
      engine,
    });
  } catch (e) {
    console.error("judge route error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "judge-failure" },
      { status: 500 },
    );
  }
}

function fallbackVerdict(body: JudgeRequestBody): JudgeVerdict {
  return heuristicVerdict({
    prosecutorText: body.prosecutorText,
    defendantText: body.defendantText,
    prosecutorEvidenceCount: body.prosecutorEvidence.length,
    defendantEvidenceCount: body.defendantEvidence.length,
  });
}
