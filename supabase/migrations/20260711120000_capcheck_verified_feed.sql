-- CapCheck Verified Feed storage.
-- Creates the catalog + refresh-run tables in the approved public namespace.
-- Idempotent: every statement is guarded so re-running the migration is safe.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Catalog of persisted, CapCheck-vetted YouTube results.
-- ---------------------------------------------------------------------------
create table if not exists public.capcheck_catalog_items (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique,
  url text,
  title text,
  channel_title text,
  thumbnail_url text,
  duration_seconds integer,
  category text check (
    category in ('investing', 'credit', 'taxes', 'budgeting', 'retirement')
  ),
  tldr text,
  cap_score integer,
  cap_label text,
  scorecard jsonb not null,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists capcheck_catalog_items_category_idx
  on public.capcheck_catalog_items (category);

create index if not exists capcheck_catalog_items_analyzed_at_idx
  on public.capcheck_catalog_items (analyzed_at desc);

-- ---------------------------------------------------------------------------
-- Audit trail for each feed refresh run.
-- ---------------------------------------------------------------------------
create table if not exists public.capcheck_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running', 'completed', 'failed')),
  discovered_count integer not null default 0,
  analyzed_count integer not null default 0,
  kept_count integer not null default 0,
  rejected_count integer not null default 0,
  duplicate_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);

create index if not exists capcheck_refresh_runs_started_at_idx
  on public.capcheck_refresh_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- Keep updated_at fresh on every catalog write.
-- ---------------------------------------------------------------------------
create or replace function public.capcheck_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists capcheck_catalog_items_touch
  on public.capcheck_catalog_items;
create trigger capcheck_catalog_items_touch
  before update on public.capcheck_catalog_items
  for each row execute function public.capcheck_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: anonymous clients may read the vetted feed but never
-- write it. Writes run through the service role, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.capcheck_catalog_items enable row level security;
alter table public.capcheck_refresh_runs enable row level security;

drop policy if exists "Anon can read catalog" on public.capcheck_catalog_items;
create policy "Anon can read catalog"
  on public.capcheck_catalog_items
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anon can read refresh runs" on public.capcheck_refresh_runs;
create policy "Anon can read refresh runs"
  on public.capcheck_refresh_runs
  for select
  to anon, authenticated
  using (true);
