-- Add job_id to store provider job identifier (e.g., Stuart job id)
alter table if exists public.order_deliveries
  add column if not exists job_id text;

-- Helpful index for lookups by job_id
create index if not exists idx_order_deliveries_job_id
  on public.order_deliveries(job_id);
