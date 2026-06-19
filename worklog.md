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

---
Task ID: UI-POLISH
Agent: frontend-styling-expert
Task: Polish UI, add framer-motion animations, QoL features (connection indicator, turn toast, better empty states, hover glows).

Work Log:
- Created `src/components/game/ConnectionIndicator.tsx`: emerald pulse dot + "LIVE" / red dot + "SYNC..." label, glowing box-shadow, terminal styling. Drop-in for the CourtHeader.
- `Dashboard.tsx`: imported `motion` from framer-motion; wrapped Matchmaking, ProfileStats, AvatarCustomizer, Leaderboard in `motion.div` with staggered fade-in (opacity 0→1, y 12→0, durations 0.4s, delays 0.05/0.15/0.25/0.35s) for a cascading reveal on dashboard mount.
- `Courtroom.tsx`:
  - Imported `motion` from framer-motion + `ConnectionIndicator`.
  - Added turn-notification effect right after `isMyTurn` definition: fires `toast.info("Your turn — file your statement!", { duration: 4000 })` whenever `isMyTurn` flips to true.
  - `StatementBlock`: changed outer `<div>` to `<motion.div>` with slide-in from left (prosecution, x: -20) / right (defense, x: 20), opacity 0→1, 0.3s duration — gives the timeline a directional flow matching each side.
  - `VerdictView`: wrapped the verdict text (GUILTY/NOT GUILTY) in `<motion.div>` with `initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}` — dramatic spring-scale reveal that complements the existing text-glow.
  - `CourtHeader`: rendered `<ConnectionIndicator />` next to the Chamber code block.
  - `StatementTimeline` empty state: rewrote with `ScrollText` (gold/40) + two-line text "Waiting for opening statements. / The prosecution begins." + a blinking gold cursor dot.
- `LoadingScreen.tsx`: full rewrite —
  - Added `ParticleField`: 28 deterministic pseudo-random gold/white particles drifting upward (pure CSS keyframe `particle-drift`, no canvas), seeded via `Math.sin` LCG so SSR + CSR match.
  - Added radial gold glow overlay behind the PixelScales for a vignette feel.
  - Wrapped PixelScales in `animate-flicker` (existing utility) for subtle CRT flicker.
  - Replaced line-by-line `BootLines` reveal with `BootTypewriter`: drives character-by-character reveal off the global `pct` value, shows a blinking gold ▌ cursor on the currently-typing line, and stamps `> protocol ready_` once all four lines are fully revealed.
- `Matchmaking.tsx`: added `hover:shadow-[0_0_20px_-5px_var(--gold)]` to the four action cards (Create / Join / Ranked / Practice) via the shared base className; also added `disabled:hover:shadow-none` so the glow doesn't show when busy.
- Lint: `bun run lint` returns 0 errors / 0 warnings.
- TypeScript: `tsc --noEmit` shows pre-existing errors in Courtroom.tsx, automation.ts, judge.ts, and CaseIntroOverlay.tsx unrelated to this task (PlayerRole union mismatch: `"prosecutor" | "defendant" | "spectator"` vs `"prosecutor" | "defense"`). These existed before this task — verified via git diff that none of my edits touched those code paths or type unions. Lint (which is what the task asked for) is clean.

Stage Summary:
- All 6 polish tasks delivered. Aesthetic stays dark terminal (black bg, white borders, gold/red/emerald accents). No existing functionality broken.
- New file: src/components/game/ConnectionIndicator.tsx
- Edited files: Dashboard.tsx, Courtroom.tsx, LoadingScreen.tsx, Matchmaking.tsx

---
Task ID: COURTROOM-FIX
Agent: courtroom-fixer
Task: Fix critical bugs in Courtroom + CaseIntroOverlay (ranked lobby rules, host-only case intro, Lawliet entrance reliability, Ctrl+Enter shortcut, auto-scroll timeline).

Work Log:
- Read worklog.md and full Courtroom.tsx (1814 lines) + CaseIntroOverlay.tsx to understand context.
- **Courtroom.tsx — LobbyView + RoleSlot (ranked vs casual)**:
  - Added `const isRanked = room.matchmakingType === "ranked"` in LobbyView.
  - Ready check now branches: ranked requires `!!room.prosecutorId && !!room.defendantId && !room.prosecutorIsAI && !room.defendantIsAI`; casual keeps `(prosecutorId || prosecutorIsAI) && (defendantId || defendantIsAI)`.
  - Added `waitingForOpponent = isRanked && !room.defendantId`.
  - Host view: ranked shows a prominent Chamber Code card (gold-bordered, 2xl gold mono) with Copy Link button + animated 3-dot "Waiting for opponent" indicator when defendant empty; casual keeps Preset Case / Generate AI Case buttons. The "not ready" hint now branches per mode.
  - Non-host view: ranked shows prominent Chamber Code + "Opponent joined — waiting for host..." or animated "Waiting for opponent" dots; casual keeps existing blink indicator + "Chamber code: ..." line.
  - RoleSlot gained `isRanked: boolean` prop. When true: hides Take Role / Fill AI buttons, shows "Auto-assigned (host)" (prosecution) / "Auto-assigned (opponent)" (defense) text, and shows "Awaiting..." instead of "Empty slot" when name is null. Both RoleSlot call sites now pass `isRanked={isRanked}`.
- **CaseIntroOverlay.tsx — host vs non-host**:
  - Added `isHost: boolean` prop. Host keeps the gold "Enter Court" button calling onBegin. Non-host sees a pulsing gold dot + "Waiting for host to open court..." text.
  - Courtroom.tsx call site now passes `isHost={isHost}`.
- **Courtroom.tsx — Lawliet entrance reliability**:
  - Added `const lawlietShownRef = useRef(false)` to prevent double-triggering.
  - Existing transition effect (lobby→case_intro) now also sets `lawlietShownRef.current = true` before `setShowLawliet(true)`.
  - Added new on-mount useEffect: if `room.phase === "case_intro"` and `!lawlietShownRef.current` and the profile is Lawliet/admin, sets the ref + shows the entrance. This handles the case where an admin navigates directly into a courtroom that is already in case_intro (where lastPhaseSeen starts as "" so the prev==="lobby" branch never fires).
- **Courtroom.tsx — Ctrl+Enter shortcut**:
  - ArgumentInput's Textarea now has an onKeyDown handler: `(e.ctrlKey || e.metaKey) && e.key === "Enter"` calls preventDefault + onSubmit.
  - Updated the help text below the textarea to hint "Ctrl+Enter to file."
- **Courtroom.tsx — Auto-scroll statement timeline**:
  - StatementTimeline now has `const bottomRef = useRef<HTMLDivElement>(null)` + a useEffect that calls `bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })` whenever `statements.length` changes. Added `<div ref={bottomRef} />` at the end of the scrollable list.
- Lint: `bun run lint` returns clean (0 errors, 0 warnings). Dev log shows successful recompiles with no errors related to these edits.

Stage Summary:
- All 5 bug fixes delivered across 2 files (Courtroom.tsx, CaseIntroOverlay.tsx).
- Ranked mode now correctly hides role-selection UI, shows a shareable chamber code, displays animated "Waiting for opponent" dots, and uses the strict ready check.
- Case intro is host-gated: non-hosts can no longer trigger beginTrialFromIntro.
- Lawliet entrance now fires reliably both on phase transition and on admin mount-into-briefing.
- Ctrl+Enter files statements; timeline auto-scrolls to the newest statement.

Files edited:
- src/components/game/Courtroom.tsx
- src/components/game/CaseIntroOverlay.tsx

---
Task ID: v3-FIXES
Agent: orchestrator
Task: Fix ranked/waiting room, commence trial sync, Lawliet entrance, UI polish, QoL features.

Work Log:
- useGameRoom: added 2s polling fallback + broadcast event so both players see phase transitions (fixes "commence trial only takes one person").
- LobbyView: ranked-aware — no role selection, no AI, auto-assigned roles, animated "Waiting for opponent" with shareable code. Casual keeps full role/AI/scenario controls.
- RoleSlot: isRanked prop hides Take Role / Fill AI, shows "Auto-assigned" text.
- CaseIntroOverlay: host sees "Enter Court", non-host sees "Waiting for host to open court...".
- LawlietEntrance: now triggers on mount (not just phase transition) via lawlietShownRef.
- Ctrl+Enter shortcut to file statements.
- Auto-scroll statement timeline to latest.
- Framer-motion: staggered dashboard sections, verdict spring-scale reveal, statement slide-in.
- ConnectionIndicator (LIVE dot) in courtroom header.
- Turn notification toast ("Your turn — file your statement!").
- LoadingScreen: particle field + typewriter boot text.
- Hover glow on matchmaking cards.
- Agent Browser verified: admin login → Lawliet entrance → case intro → courtroom R1/4 → statement filed → LIVE indicator → zero blocking errors.

Stage Summary:
- Ranked: strictly human vs human, auto-roles, no AI.
- Both players sync via polling (2s) + realtime broadcast.
- Lawliet shows reliably for admin on court entry.
- TTS fails in sandbox (z-ai SDK) — non-blocking, caught. Works on Vercel with a real TTS provider.
