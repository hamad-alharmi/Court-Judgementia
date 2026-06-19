# JUDGEMENTIA

A real-time multiplayer cyber-legal thriller. Prosecute, defend, raise objections, and face the verdict of **Chief Justice Vanguard** — an AI judge powered by Gemini.

![Judgementia](public/characters/lawliet.png)

## Overview

Players enter as digital attorneys, climbing the ranked ladder from **Junior Associate** to **Chief Justice Elite**. Each trial is a turn-based battle of rhetoric: present evidence, file statements, object to your opponent's arguments, and let an AI judge weigh the facts.

## Features

- **Real-time multiplayer** via Supabase Realtime — turns, timers, votes, and statements sync live across players
- **AI Judge (Chief Justice Vanguard)** — powered by Gemini, delivers structured verdicts with legal reasoning and punishment decrees
- **Dynamic case generation** — type any theme (cyber, murder, heist, joke) and the AI generates a fresh case with evidence
- **Multi-round trials** — configurable statement count per side (1–8), with objection mechanics
- **Objection system** — object to your opponent's statements; the AI judge rules SUSTAINED or OVERRULED
- **Elo progression** — 5 rank tiers, Elo scaled by verdict decisiveness
- **5 accent themes** — Gold, Crimson, Jade, Violet, Cyan
- **Admin system** — ban/reset accounts, Lawliet character with voice
- **Practice mode** — solo drill against AI defense counsel

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript 5**
- **Tailwind CSS 4** + shadcn/ui
- **Supabase** (Postgres + Realtime)
- **Google Gemini API** (AI Judge + case generation)
- **Framer Motion** (animations)

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase + Gemini keys

# 3. Run the Supabase schema
#    Paste supabase-schema.sql into your Supabase SQL Editor and click Run

# 4. Start the dev server
bun run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GEMINI_API_KEY` | Google Gemini API key for the AI Judge |

Without Supabase vars, the app runs in **local mock mode** (localStorage + BroadcastChannel) — functional for single-browser testing.

## Deployment

### Vercel

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add the 4 environment variables (above) in Project Settings
4. Deploy

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Open the SQL Editor and run `supabase-schema.sql`
3. This creates the `profiles` and `rooms` tables, RLS policies, Realtime, and seeds the leaderboard

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── judge/          # AI Judge (verdicts + objection rulings)
│   │   ├── generate-case/  # Dynamic case generation from theme
│   │   ├── admin/          # Admin account management
│   │   └── tts/            # Text-to-speech (legacy)
│   ├── globals.css         # Theme + animations
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Entry point
├── components/
│   ├── game/               # All game UI components
│   └── ui/                 # shadcn/ui components
├── hooks/                  # useAuth, useGameRoom, useLeaderboard
└── lib/
    ├── api.ts              # Unified data layer (Supabase | local)
    ├── judge.ts            # Judge prompts + verdict parsing
    ├── automation.ts       # AI arguments + jury simulation
    ├── elo.ts              # Elo resolution engine
    ├── codec.ts            # 4-letter chamber code generator
    ├── room.ts             # Room/game-state factories
    ├── types.ts            # Type definitions
    ├── data/               # Case files + rank tiers
    ├── supabase/           # Supabase clients + schema
    └── local/              # Local mock data layer
```

## Admin Account

The account `alrzrii` is hardcoded as admin with the Lawliet character. Sign in with the credentials set in your Supabase schema. Admins can:
- Access the Admin Panel (gold shield button)
- Reset or delete/ban any player account
- Equip the Lawliet character with entrance animation + voice

## License

Private project.
