// ===== /api/admin — admin account management (delete / reset / ban) =====
import { NextRequest, NextResponse } from "next/server";
import { profiles } from "@/lib/api";
import { hashPassword } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_USER = "alrzrii";
const ADMIN_PASS = "vyhghgg46";

async function verifyAdmin(token: string | null, username?: string, password?: string) {
  // token-based: the admin signs in normally, session carries isAdmin. We accept
  // a bearer that matches a server-side check OR direct creds (for first-time setup).
  if (username && password) {
    const h = await hashPassword(password);
    const expected = await hashPassword(ADMIN_PASS);
    return username === ADMIN_USER && h === expected;
  }
  void token;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, targetId, adminUsername, adminPassword } = body as {
      action: "delete" | "reset" | "ban";
      targetId: string;
      adminUsername?: string;
      adminPassword?: string;
    };

    const ok = await verifyAdmin(null, adminUsername, adminPassword);
    if (!ok) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
    }

    const target = await profiles.get(targetId);
    if (!target) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (target.isAdmin) {
      return NextResponse.json({ error: "CANNOT_TOUCH_ADMIN" }, { status: 400 });
    }

    if (action === "delete" || action === "ban") {
      // ban = delete the account entirely (disappears from leaderboard)
      await profiles.remove(targetId);
      return NextResponse.json({ ok: true, action });
    }
    if (action === "reset") {
      await profiles.update(targetId, {
        elo: 1000,
        rank: "Junior Associate",
        casesTried: 0,
        convictions: 0,
        acquittals: 0,
        judgeFavorability: 50,
        wins: 0,
        losses: 0,
      });
      return NextResponse.json({ ok: true, action });
    }
    return NextResponse.json({ error: "BAD_ACTION" }, { status: 400 });
  } catch (e) {
    console.error("admin route error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "admin-failure" },
      { status: 500 },
    );
  }
}
