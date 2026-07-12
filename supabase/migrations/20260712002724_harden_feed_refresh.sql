-- Harden the existing trigger function without rewriting its applied migration.
-- An empty search_path prevents caller-controlled schema resolution; pg_catalog
-- functions such as now() remain implicitly available.
alter function public.capcheck_touch_updated_at()
  set search_path = '';

-- The refresh-run row is the cross-process single-flight lock. PostgreSQL
-- enforces that only one row may remain in the running state at a time.
create unique index if not exists capcheck_refresh_runs_one_running_idx
  on public.capcheck_refresh_runs ((true))
  where status = 'running';
