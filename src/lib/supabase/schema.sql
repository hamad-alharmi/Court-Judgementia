-- =====================================================================
-- JUDGEMENTIA — Supabase Schema (v2: multi-round, objections, setup, admin)
-- Run this in the Supabase SQL editor for your project.
-- Idempotent: safe to re-run on an existing v1 database to add columns.
-- =====================================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  avatar jsonb not null default '{"archetype":"advocate","accent":"gold","motto":"Order in the chamber."}'::jsonb,
  elo integer not null default 1000,
  rank text not null default 'Junior Associate',
  cases_tried integer not null default 0,
  convictions integer not null default 0,
  acquittals integer not null default 0,
  judge_favorability integer not null default 50,
  wins integer not null default 0,
  losses integer not null default 0,
  is_admin boolean not null default false,
  character text,
  created_at timestamptz not null default now()
);

-- v2 columns (add if missing)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_admin') then
    alter table public.profiles add column is_admin boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='character') then
    alter table public.profiles add column character text;
  end if;
end$$;

create index if not exists profiles_elo_idx on public.profiles (elo desc);
create index if not exists profiles_wins_idx on public.profiles (wins desc);

-- ---------- ROOMS ----------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  phase text not null default 'lobby',
  matchmaking_type text not null default 'casual',
  scenario_id text not null,
  host_id uuid not null,
  prosecutor_id uuid,
  defendant_id uuid,
  prosecutor_name text,
  defendant_name text,
  prosecutor_is_ai boolean not null default false,
  defendant_is_ai boolean not null default false,
  statement_count integer not null default 4,
  ai_difficulty text not null default 'medium',
  case_theme text not null default '',
  game_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  closed boolean not null default false
);

-- v2 columns (add if missing)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='rooms' and column_name='statement_count') then
    alter table public.rooms add column statement_count integer not null default 4;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='rooms' and column_name='ai_difficulty') then
    alter table public.rooms add column ai_difficulty text not null default 'medium';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='rooms' and column_name='case_theme') then
    alter table public.rooms add column case_theme text not null default '';
  end if;
end$$;

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_phase_idx on public.rooms (phase);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;

drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles for select using (true);
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert with check (true);
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update using (true) with check (true);
drop policy if exists "profiles_delete_all" on public.profiles;
create policy "profiles_delete_all" on public.profiles for delete using (true);

drop policy if exists "rooms_read_all" on public.rooms;
create policy "rooms_read_all" on public.rooms for select using (true);
drop policy if exists "rooms_write_all" on public.rooms;
create policy "rooms_write_all" on public.rooms for insert with check (true);
drop policy if exists "rooms_update_all" on public.rooms;
create policy "rooms_update_all" on public.rooms for update using (true) with check (true);
drop policy if exists "rooms_delete_all" on public.rooms;
create policy "rooms_delete_all" on public.rooms for delete using (true);

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.rooms;

-- ---------- ADMIN ACCOUNT + DEMO LEADERBOARD SEED ----------
-- Admin: username alrzrii, password vyhghgg46 (hashed client-side at runtime;
-- the 'seed' placeholder here is overwritten on first admin login via the app).
insert into public.profiles (username, password_hash, elo, rank, cases_tried, convictions, acquittals, judge_favorability, wins, losses, is_admin, character)
values
  ('alrzrii', 'seed', 2500, 'Chief Justice Elite', 999, 700, 299, 99, 700, 50, true, 'lawliet')
on conflict (username) do update set
  is_admin = true,
  character = 'lawliet';

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
