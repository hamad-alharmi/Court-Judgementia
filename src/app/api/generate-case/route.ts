// ===== /api/generate-case — AI generates a case on the spot from a theme =====
import { NextRequest, NextResponse } from "next/server";
import type { CaseScenario, EvidenceItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are the case-generator for the Judgementia legal game.
Generate a single high-stakes case file for the given theme.

OUTPUT RULES (NON-NEGOTIABLE):
- Respond with a single JSON object and NOTHING else. No markdown, no extra prose.
- JSON shape:
  {
    "title": string,                 // punchy case title, max 8 words
    "facts": string,                 // 1-2 short plain-English sentences describing what happened. Modern readable English, NOT Shakespearean. Max ~280 chars.
    "evidence": [                    // EXACTLY 3 items
      {
        "title": string,             // short evidence title
        "description": string,       // 2-3 plain-English sentences explaining what it shows. Max ~260 chars.
        "assetType": string,         // e.g. "Server log", "Email", "Crypto ledger"
        "side": "prosecution" | "defense" | "ambiguous"
      }
    ]
  }
- The 3 evidence items MUST include at least 1 prosecution, at least 1 defense, and the 3rd may be ambiguous.
- Keep language simple and short. A non-native English speaker must be able to follow it.`;

async function runGemini(theme: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_GEMINI_KEY");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1500,
      responseMimeType: "application/json",
    },
  });
  const res = await model.generateContent(
    `Theme: "${theme}". Generate the case JSON now.`,
  );
  return res.response.text();
}

async function runZAI(theme: string): Promise<string> {
  const ZAIModule: any = await import("z-ai-web-dev-sdk");
  const ZAI = ZAIModule.default || ZAIModule;
  const zai = await ZAI.create();
  const completion: any = await zai.chat.completions.create({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Theme: "${theme}". Generate the case JSON now.` },
    ],
    temperature: 0.9,
    max_tokens: 1500,
  });
  return completion.choices?.[0]?.message?.content ?? "";
}

function fallbackCase(theme: string): CaseScenario {
  // deterministic-ish fallback so the game still works without AI
  const t = theme.toLowerCase();
  if (t.includes("murder") || t.includes("death")) {
    return {
      id: "gen-murder",
      title: "The Locked Server Room",
      theme,
      generated: true,
      facts:
        "A senior engineer was found dead inside a locked server room. The only other keycard access that night belongs to a junior developer.",
      evidence: [
        {
          id: "m-ev1",
          title: "Keycard Access Log",
          description:
            "The junior developer's keycard was used to enter the server room at 11:42 PM, eight minutes before the alarm fired. The log shows no other entries that night.",
          assetType: "Access log",
          side: "prosecution",
        },
        {
          id: "m-ev2",
          title: "Shared Keycard Report",
          description:
            "A security note shows the keycard was reported shared among three team members last month. The access log cannot prove who actually held the card.",
          assetType: "Security memo",
          side: "defense",
        },
        {
          id: "m-ev3",
          title: "Mystery Payment",
          description:
            "A $20,000 deposit hit the victim's account two days earlier. The sender is a shell company with no clear owner.",
          assetType: "Bank record",
          side: "ambiguous",
        },
      ],
    };
  }
  if (t.includes("joke") || t.includes("fun")) {
    return {
      id: "gen-joke",
      title: "The Stolen Snack Stash",
      theme,
      generated: true,
      facts:
        "Someone cleaned out the office snack cabinet on Friday night. The only two people with after-hours access are the intern and the office manager.",
      evidence: [
        {
          id: "j-ev1",
          title: "Crumb Trail",
          description:
            "A trail of chip crumbs leads from the cabinet straight to the intern's desk. The crumbs match the brand that was stolen.",
          assetType: "Photo evidence",
          side: "prosecution",
        },
        {
          id: "j-ev2",
          title: "Door Cam Gap",
          description:
            "The hallway camera was turned off for 12 minutes during the theft. Only the office manager has the password to disable it.",
          assetType: "Camera log",
          side: "defense",
        },
        {
          id: "j-ev3",
          title: "Group Chat Screenshot",
          description:
            "A message in the team chat says 'snack heist tonight, who's in?' — but the sender's name is redacted.",
          assetType: "Chat screenshot",
          side: "ambiguous",
        },
      ],
    };
  }
  // default cyber
  return {
    id: "gen-cyber",
    title: "The Midnight Breach",
    theme,
    generated: true,
    facts:
      "A database holding customer records was wiped at 2 AM. The prime suspect is the on-call admin, whose account was active during the breach.",
    evidence: [
      {
        id: "c-ev1",
        title: "Admin Login at 02:03 AM",
        description:
          "The admin's account logged in and ran the delete command at 02:03 AM. The session came from their home IP address.",
        assetType: "Database log",
        side: "prosecution",
      },
      {
        id: "c-ev2",
        title: "Stolen Credentials Alert",
        description:
          "Three days before the breach, the security team flagged the admin's password on a leaked-credentials list. The admin was told to change it but the request was never followed up.",
        assetType: "Security alert",
        side: "defense",
      },
      {
        id: "c-ev3",
        title: "Unknown Outbound Transfer",
        description:
          "A 4 GB file left the server at 02:11 AM, heading to an unknown IP. It is unclear whether this was the attacker exfiltrating data or an automated backup.",
        assetType: "Network capture",
        side: "ambiguous",
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { theme } = (await req.json()) as { theme: string };
    const cleanTheme = (theme || "cyber").trim().slice(0, 60) || "cyber";

    let raw = "";
    if (process.env.GEMINI_API_KEY) {
      try {
        raw = await runGemini(cleanTheme);
      } catch (e) {
        console.error("gemini case-gen failed, fallback", e);
      }
    } else {
      try {
        raw = await runZAI(cleanTheme);
      } catch (e) {
        console.error("z-ai case-gen failed, fallback", e);
      }
    }

    if (raw) {
      try {
        let text = raw.trim();
        const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fence) text = fence[1].trim();
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) text = text.slice(start, end + 1);
        const obj = JSON.parse(text);
        const evidence: EvidenceItem[] = (obj.evidence || []).slice(0, 3).map(
          (e: Record<string, unknown>, i: number) => ({
            id: `gen-ev-${i + 1}`,
            title: String(e.title ?? `Evidence ${i + 1}`).slice(0, 80),
            description: String(e.description ?? "").slice(0, 400),
            assetType: String(e.assetType ?? "Evidence").slice(0, 40),
            side: (["prosecution", "defense", "ambiguous"].includes(String(e.side))
              ? String(e.side)
              : "ambiguous") as EvidenceItem["side"],
          }),
        );
        // ensure exactly 3
        while (evidence.length < 3) {
          evidence.push({
            id: `gen-ev-${evidence.length + 1}`,
            title: "Additional Exhibit",
            description: "Supporting documentation relevant to the case.",
            assetType: "Document",
            side: "ambiguous",
          });
        }
        const scenario: CaseScenario = {
          id: "gen-" + Date.now().toString(36),
          title: String(obj.title || cleanTheme + " Case").slice(0, 80),
          facts: String(obj.facts || "").slice(0, 400),
          evidence,
          theme: cleanTheme,
          generated: true,
        };
        return NextResponse.json({ scenario, engine: process.env.GEMINI_API_KEY ? "gemini" : "z-ai" });
      } catch (e) {
        console.error("case parse failed, fallback", e);
      }
    }
    const fb = fallbackCase(cleanTheme);
    return NextResponse.json({ scenario: fb, engine: "fallback" });
  } catch (e) {
    console.error("generate-case route error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "case-gen-failure" },
      { status: 500 },
    );
  }
}
