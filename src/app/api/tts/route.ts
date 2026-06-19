// ===== /api/tts — Text-to-Speech for admin (Lawliet) statement readout =====
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text: string };
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }
    // TTS API limit is 1024 chars; truncate to be safe.
    const input = text.trim().slice(0, 1000);

    const ZAIModule: any = await import("z-ai-web-dev-sdk");
    const ZAI = ZAIModule.default || ZAIModule;
    const zai = await ZAI.create();

    const response = await zai.audio.tts.create({
      input,
      voice: "xiaochen", // calm, composed analytical voice
      speed: 0.95,
      response_format: "mp3",
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("TTS route error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "tts-failure" },
      { status: 500 },
    );
  }
}
