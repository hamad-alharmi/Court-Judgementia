-- =====================================================================
-- JUDGEMENTIA — Supabase Schema
-- Run this in the Supabase SQL editor for your project.
-- =====================================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,            -- simple sha-256 hash (client-supplied)
  avatar jsonb not null default '{"archetype":"advocate","accent":"gold","motto":"Order in the chamber."}'::jsonb,
  elo integer not null default 1000,
  rank text not null default 'Junior Associate',
  cases_tried integer not null default 0,
  convictions integer not null default 0,
  acquittals integer not null default 0,
  judge_favorability integer not null default 50,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists profiles_elo_idx on public.profiles (elo desc);

-- ---------- ROOMS (with embedded game_state JSONB) ----------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- 4-letter join code
  phase text not null default 'lobby',     -- lobby | prosecutor_turn | defendant_turn | jury_voting | verdict
  matchmaking_type text not null default 'casual',
  scenario_id text not null,
  host_id uuid not null,
  prosecutor_id uuid,
  defendant_id uuid,
  prosecutor_name text,
  defendant_name text,
  prosecutor_is_ai boolean not null default false,
  defendant_is_ai boolean not null default false,
  game_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  closed boolean not null default false
);

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_phase_idx on public.rooms (phase);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;

-- Profiles: anyone can read (leaderboard), only owner can write.
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles for select using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert with check (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update using (true) with check (true);

-- Rooms: open read/write for authenticated clients (matchmaking lobby model).
drop policy if exists "rooms_read_all" on public.rooms;
create policy "rooms_read_all" on public.rooms for select using (true);

drop policy if exists "rooms_write_all" on public.rooms;
create policy "rooms_write_all" on public.rooms for insert with check (true);

drop policy if exists "rooms_update_all" on public.rooms;
create policy "rooms_update_all" on public.rooms for update using (true) with check (true);

drop policy if exists "rooms_delete_all" on public.rooms;
create policy "rooms_delete_all" on public.rooms for delete using (true);

-- ---------- REALTIME ----------
-- Enable realtime replication on both tables so clients can subscribe
-- to row-level changes via Supabase Realtime.
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.rooms;

-- ---------- HELPER: seed a few demo profiles for the leaderboard ----------
insert into public.profiles (username, password_hash, elo, rank, cases_tried, convictions, acquittals, judge_favorability, wins, losses)
values
  ('V_Whitcombe', 'seed', 2380, 'Chief Justice Elite', 412, 261, 151, 78, 261, 151),
  ('Aurochs_Vex', 'seed', 2210, 'Chief Justice Elite', 388, 240, 148, 71, 240, 148),
  ('Mira_Stenwick', 'seed', 2050, 'Magistrate', 351, 198, 153, 66, 198, 153),
  ('Dorian_Faye', 'seed', 1925, 'Magistrate', 302, 170, 132, 62, 170, 132),
  ('Kestrel_Imre', 'seed', 1810, 'Magistrate', 277, 159, 118, 58, 159, 118),
  ('Sable_Okafor', 'seed', 1680, 'Senior Counsel', 244, 138, 106, 55, 138, 106),
  ('Rune_Calloway', 'seed', 1545, 'Senior Counsel', 211, 121, 90, 52, 121, 90),
  ('Thessaly_Vox', 'seed', 1410, 'Partner', 188, 104, 84, 49, 104, 84),
  ('Percival_Mott', 'seed', 1288, 'Partner', 156, 88, 68, 46, 88, 68),
  ('Iola_Brigant', 'seed', 1150, 'Junior Associate', 122, 67, 55, 43, 67, 55)
on conflict (username) do nothing;
