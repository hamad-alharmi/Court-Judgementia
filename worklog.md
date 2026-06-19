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

---
Task ID: v2
Agent: orchestrator
Task: Implement Replit-transcript feature requests (multi-round, objections, themes, admin, Lawliet, AI case gen, setup options).

Work Log:
- Rewrote types.ts: multi-round Statements[], Objections, room setup (statementCount, aiDifficulty, caseTheme, aiRoles), admin/character fields, UITheme.
- judge.ts: verdict + objection evaluation (SUSTAINED/OVERRULED) with full history context; simpler-language prompts.
- automation.ts: round-aware AI arguments, difficulty-scaled, maybeAIObjection, heuristicObjection, simulateJuryVotes with sustained-objection weight.
- New API routes: /api/generate-case (Gemini case gen from theme), /api/judge (verdict + objection), /api/admin (delete/reset/ban), /api/tts (Lawliet voice).
- ThemeProvider (5 themes: gold/crimson/jade/violet/cyan) + SettingsModal + AdminPanel.
- CreateRoomModal: statement count (1/2/3/4/6/8), AI role checkboxes, AI difficulty, case theme input + presets.
- Courtroom v2: multi-round statement timeline, OBJECTION button + modal, round counter, CaseIntroOverlay, LawlietEntrance (SVG portrait + slide-out animation), lobby role selection (Take Role / Fill AI), TTS read-aloud for admin's own statements.
- Resilience: Supabase insert/update auto-retries without v2 columns (stashes in game_state._v2) so the app works whether or not the user has run the v2 schema migration. AI player IDs are null (not string) to satisfy uuid constraint.
- Fixed W/L tracking (prosecutor wins = GUILTY, defender wins = NOT GUILTY). Leaderboard sorts by wins DESC.
- Simpler case language (plain English, not Shakespearean).
- Agent Browser verified: signup on live Supabase → practice match → 4-round trial (P1→D1→P2→D2→P3→D3→P4→D4) → AI Judge verdict (NOT GUILTY + reasoning + punishment) with zero console errors.

Stage Summary:
- All Replit-transcript features delivered except Google OAuth (noted as needs Google Cloud console setup).
- Lawliet portrait = pure SVG (image-gen timed out in sandbox); PNG fallback wired if /characters/lawliet.png exists.
- User must run supabase-schema.sql (v2) in Supabase SQL editor to add statement_count/ai_difficulty/case_theme columns + admin account (alrzrii). App works in v1 mode until then via resilience fallback.
