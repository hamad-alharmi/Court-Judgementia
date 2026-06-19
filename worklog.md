# Judgementia — Build Worklog

Project: Real-time multiplayer cyber-legal thriller game.
Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Supabase + Gemini (AI Judge).

Architecture decisions:
- Dual-mode data layer: real Supabase when env vars present, else local mock (localStorage + BroadcastChannel) so the preview works without credentials.
- AI Judge: Gemini when GEMINI_API_KEY set, else z-ai-web-dev-sdk (sandbox), else deterministic heuristic.
- Single route `/` driven by a client-side state machine (GameApp).
- Forced dark cyber-legal theme: pure black, dark-gray panels, white borders, gold accents, mono typography.

---
Task ID: 0
Agent: orchestrator
Task: Initialize worklog and plan.

Work Log:
- Inspected existing project (Next.js 16, shadcn/ui full set, Tailwind 4, Prisma SQLite).
- Decided dual-mode (Supabase | local mock) architecture for preview + deploy.
- Created todo list.

Stage Summary:
- Ready to build foundation (packages, theme, data layer).

---
Task ID: 12
Agent: orchestrator
Task: Lint, dev server, Agent Browser self-verification, fix issues.

Work Log:
- Built full UI: LoadingScreen (tilting pixel scales), AuthGate (signup/login), GavelTransition (slam + screen-shake + flash), Dashboard (Matchmaking/ProfileStats/AvatarCustomizer/Leaderboard), Courtroom split-screen (65/35) with EvidenceVault, TurnTimer, char counter, chamber share, VerdictView.
- Built GameApp state machine + page.tsx wiring; auto-join via ?chamber=CODE.
- Lint: clean (0 errors, 0 warnings).
- Agent Browser verification: signup -> dashboard -> practice vs AI -> lobby -> courtroom -> present evidence -> file argument -> AI defendant auto-arg -> jury sim -> AI Judge verdict (GUILTY, decisiveness 92, full reasoning + punishment) -> Elo resolution (1000->1023, +1 conviction, favorability 50->55) -> leaderboard updated with YOU highlight.
- Fixed a real stack-overflow bug: seedLocalDemoProfiles emitted a "profiles" event before setting its guard, causing synchronous re-entrant recursion through reactive subscribers on first load. Fix: (1) queueMicrotask-deferred emit, (2) seedingInProgress re-entrancy guard, (3) set SEEDED_KEY before writeProfiles.
- Post-fix: console clean, leaderboard populates, full flow runs with 0 errors.

Stage Summary:
- Production-ready. Dual-mode data layer (Supabase | local mock). AI Judge via Gemini | z-ai | heuristic. Realtime via Supabase Realtime | BroadcastChannel.
- Deploy: set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / GEMINI_API_KEY (optional SUPABASE_SERVICE_ROLE_KEY) in Vercel, run src/lib/supabase/schema.sql in Supabase SQL editor.
- .env.local.example created with all vars documented.
