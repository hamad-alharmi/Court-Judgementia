---
Task ID: FEATURES
Agent: features-builder

## Work record

### Files created

1. **src/hooks/use-sound.ts** — Web Audio API sound-effects hook. Memoized `sounds` object (useMemo) exposing 9 tones (`click`, `turnStart`, `fileStatement`, `objection`, `sustained`, `overruled`, `verdict`, `evidence`, `timer`). All tones are synthesized programmatically via `OscillatorNode` + `GainNode` (no external assets). AudioContext is lazily created on first call and auto-resumed if suspended. Every play path is wrapped in try/catch so a blocked AudioContext silently no-ops. Used by Matchmaking, CreateRoomModal, and Courtroom.

2. **src/lib/data/achievements.ts** — Achievement definitions. Each entry stores the actual Lucide icon component (typed `LucideIcon`), not a string, per the task's requirement. 8 achievements: first_win, five_wins, fifty_wins, elo_1500, elo_2000, ten_cases, hundred_cases, favored. Each has a `check(profile)` predicate.

3. **src/components/game/MatchHistory.tsx** — Scrollable recent-matches list. Renders `profile.matchHistory` (newest first), each row showing: case title (looked up via `getScenarioById`, falls back to `Case <id>` for AI-generated cases), verdict badge (Guilty/Not Guilty), won/lost indicator (▲/▼ with gold/white tones), Elo delta (+/-) with up/down trend icons, and a relative timestamp ("just now", "5m ago", "3h ago", "Mar 5"). List is capped at `max-h-96 overflow-y-auto` with the `fade-mask-b` fade-out. Empty state matches the rest of the app (ScrollText icon + dashed border + radial gold backdrop). Wrapped in a `premium-card` with a "Match History" header.

4. **src/components/game/Achievements.tsx** — Gold-badge grid. Renders all 8 achievements as a 2x4 / 1x4 grid. Unlocked = gold-bordered HUD tile with `animate-glow-pulse` icon and a radial gold glow, "★ Unlocked" tag. Locked = opacity-50 grayscale + Lock icon. Header shows the unlocked count (e.g. "3 / 8 unlocked"). Wrapped in a `premium-card`.

### Files edited

5. **src/lib/types.ts** — Added `MatchHistoryEntry` interface (`{ scenarioId, verdict, won, eloDelta, at }`) and `matchHistory?: MatchHistoryEntry[]` field on `Profile`.

6. **src/lib/api.ts** — Three additions:
   - `ProfileRow` gains `match_history?: Profile["matchHistory"] | null`.
   - `rowToProfile` reads `match_history` defensively (Array.isArray check; treats non-array as undefined).
   - `profiles.signUp` now tries inserting `match_history: []` first; on column-missing error it retries with `is_admin` + `character` only, and finally falls back to the base v1 row.
   - `profiles.update` now includes `match_history` in the v2 patch when `patch.matchHistory` is supplied; on column-missing error it retries without `match_history`, then without all v2 cols.
   - Added `rooms.listOngoingTrials()` — returns rooms in phases `case_intro`/`prosecutor_turn`/`defendant_turn`/`jury_voting`, not closed, within the last 60 minutes. Uses Supabase `.in("phase", [...])` or local filter.

7. **src/lib/supabase/schema.sql** + **supabase-schema.sql** (mirror) — Added `match_history jsonb not null default '[]'` to the `profiles` CREATE TABLE and to the v2 idempotent `do $$` block.

8. **src/components/game/ProfileStats.tsx** — Wrapped return in a `flex flex-col gap-5` container holding the original stats `<section>` followed by `<Achievements />` and `<MatchHistory />`. Imports updated.

9. **src/components/game/Matchmaking.tsx** — 
   - Imported `useSound`, `Eye` icon, and `RoomPhase` type. Added a `PHASE_LABEL` map for the spectate list.
   - Added `sounds = useSound()` + `ongoing` state. `refreshLobbies` now `Promise.all`s `listRecentLobbies` + `listOngoingTrials` (5s polling).
   - All four action cards (create/join/ranked/practice) call `sounds.click()` before their action.
   - The "Enter" button under the join-code terminal plays `click`.
   - Open Chambers join button plays `click`.
   - Added "Spectate Live Trials" section below Open Chambers: emerald-bordered cards showing chamber code, live phase badge, "P v. D" participants, and an Eye icon. Clicking one calls `onEnterRoom(r.id)` directly (no slot-taking) and plays `click`.

10. **src/components/game/CreateRoomModal.tsx** — Imported `useSound`. Added `sounds = useSound()`. The preset theme buttons, statement-count buttons, AI-role toggles, AI-difficulty buttons, and the final "Open Chamber" button all play `click` before applying the selection. (toggleRole was updated to play click at the top so all role toggles share one beep.)

11. **src/components/game/Courtroom.tsx** — biggest integration:
   - Imported `useSound`, `generateChamberCode`, `newRoom`, and the `MatchHistoryEntry` type. Added `onEnterRoom: (id: string) => void` prop. Added `sounds`, `rematching`, and `lastTimerBeepRef` state/refs.
   - **turnStart** plays in the existing `isMyTurn` effect.
   - **timer** beeps at 10s/5s/3s — new effect compares `lastTimerBeepRef.current` against `remaining` and fires once per threshold crossing; resets when the turn ends.
   - **fileStatement** plays after `await update(...)` succeeds in `handleSubmit`.
   - **objection** plays when the objection bar is clicked (before opening the modal).
   - **sustained/overruled** plays after the ruling comes back from `/api/judge` in `runObjection`.
   - **verdict** plays right after `await update({ gameState: { ...gs, verdict } })` in `runJudge`.
   - **evidence** plays in `presentEvidence` after the exhibit is injected.
   - **Match History append**: in `runJudge`, after computing `won` and `adj.newElo`, both the prosecutor and defendant profile updates now include `matchHistory: [...(profile.matchHistory ?? []), entry].slice(-20)` where `entry = { scenarioId, verdict, won, eloDelta: adj.newElo - prevElo, at: Date.now() }`.
   - **Quick Rematch**: new `quickRematch()` async function — generates a fresh chamber code, creates a new casual room with the same `scenarioId`, `caseTheme`, `statementCount`, `aiDifficulty`. Preserves the player's role (defendant stays defendant; everyone else becomes prosecutor/host). Calls `onEnterRoom(created.id)` on success. Shows a "Convening..." spinner state via the new `rematching` state.
   - **VerdictView** now accepts a `rematching: boolean` prop and the "New Trial" button calls `onRematch={quickRematch}` (passed in by the parent Courtroom). The button shows "Convening..." + spinner while `rematching` is true, and is hidden entirely for spectators.

12. **src/components/game/GameApp.tsx** — Updated the `<Courtroom>` invocation to also pass `onEnterRoom={enterRoom}`. (onRematch is still passed as leaveRoom as a no-longer-used fallback; onLeave is the actual "Return to Terminal" handler.)

### Verification

- `bun run lint`: **0 errors, 0 warnings**.
- Dev server: recompiles cleanly, `GET /` returns HTTP 200, no runtime errors.
- `tsc --noEmit`: only pre-existing PlayerRole union mismatch errors remain (Courtroom.tsx, automation.ts, judge.ts, CaseIntroOverlay.tsx — all documented in prior worklog entries UI-POLISH and UI-OVERHAUL). My new code (use-sound.ts, achievements.ts, MatchHistory.tsx, Achievements.tsx, GameApp.tsx, Matchmaking.tsx spectate section, CreateRoomModal sound integration, Courtroom.tsx quickRematch + matchHistory append + sound integrations) introduces **zero** new TS errors.
