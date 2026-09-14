-- Dialed: golf dispersion tracker
-- Run this whole file once in your Supabase project's SQL editor.

create extension if not exists "pgcrypto";

-- Clubs in your bag
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Courses you've saved pin locations for (reusable across rounds)
create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Default green-center location per hole for a saved course
-- (set ahead of time in Pre-round mode, or pulled from OpenStreetMap)
create table course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  par integer,
  pin_lat double precision,
  pin_lng double precision,
  pin_source text check (pin_source in ('osm', 'manual')),
  unique (course_id, hole_number)
);

-- A single round played
create table rounds (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id),
  course_name text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Today's actual pin position per hole for a round. Overrides course_holes.
-- Editable mid-round; round play never depends on this being filled in.
create table round_holes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  pin_lat double precision,
  pin_lng double precision,
  pin_source text check (pin_source in ('osm', 'course_default', 'manual')),
  unique (round_id, hole_number)
);

-- Every shot, practice or on-course
create table shots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete set null,
  mode text not null check (mode in ('practice', 'round')),
  round_id uuid references rounds(id) on delete cascade,
  hole_number integer,
  start_lat double precision not null,
  start_lng double precision not null,
  end_lat double precision not null,
  end_lng double precision not null,
  target_lat double precision,
  target_lng double precision,
  carry_yards numeric not null,
  target_distance_yards numeric,
  lateral_yards numeric,
  long_short_yards numeric,
  created_at timestamptz not null default now()
);

create index shots_club_idx on shots (club_id);
create index shots_round_idx on shots (round_id);
create index shots_mode_idx on shots (mode);

-- Row Level Security
-- This app is gated by a client-side passcode, not real Supabase Auth, so
-- there's no logged-in user to scope rows to. We enable RLS and grant the
-- anon key full read/write access. That means anyone who extracted your
-- anon key from the deployed JS bundle could reach the database directly,
-- bypassing the passcode screen. That's an acceptable trade-off for low
-- stakes personal shot data, but if you ever want real protection, switch
-- to Supabase email auth and scope these policies to auth.uid() instead.
alter table clubs enable row level security;
alter table courses enable row level security;
alter table course_holes enable row level security;
alter table rounds enable row level security;
alter table round_holes enable row level security;
alter table shots enable row level security;

create policy "anon full access" on clubs for all using (true) with check (true);
create policy "anon full access" on courses for all using (true) with check (true);
create policy "anon full access" on course_holes for all using (true) with check (true);
create policy "anon full access" on rounds for all using (true) with check (true);
create policy "anon full access" on round_holes for all using (true) with check (true);
create policy "anon full access" on shots for all using (true) with check (true);

-- Starter bag — edit freely from the Clubs tab after deploying
insert into clubs (name, sort_order) values
  ('Driver', 1),
  ('3 Wood', 2),
  ('5 Wood', 3),
  ('4 Iron', 4),
  ('5 Iron', 5),
  ('6 Iron', 6),
  ('7 Iron', 7),
  ('8 Iron', 8),
  ('9 Iron', 9),
  ('PW', 10),
  ('GW', 11),
  ('SW', 12),
  ('LW', 13),
  ('Putter', 14);
