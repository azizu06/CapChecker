-- Harden the existing trigger function without rewriting its applied migration.
-- An empty search_path prevents caller-controlled schema resolution; pg_catalog
-- functions such as now() remain implicitly available.
alter function public.capcheck_touch_updated_at()
  set search_path = '';

-- The refresh-run row is the cross-process single-flight lock. PostgreSQL
-- enforces that only one row may remain in the running state at a time.
-- Keep the newest running row deterministically and close any older rows so
-- the unique index is safe even when legacy state contains duplicates.
with ranked_running as (
  select
    id,
    row_number() over (order by started_at desc, id desc) as running_rank
  from public.capcheck_refresh_runs
  where status = 'running'
)
update public.capcheck_refresh_runs as runs
set
  status = 'failed',
  completed_at = coalesce(runs.completed_at, now()),
  error = coalesce(runs.error, 'DUPLICATE_RUNNING_RECONCILED')
from ranked_running
where runs.id = ranked_running.id
  and ranked_running.running_rank > 1;

create unique index if not exists capcheck_refresh_runs_one_running_idx
  on public.capcheck_refresh_runs ((true))
  where status = 'running';
