-- Add fields needed for Uber webhook processing to order_deliveries table

alter table if exists public.order_deliveries
  add column if not exists occurred_at timestamptz,
  add column if not exists event_id text,
  add column if not exists eta_timestamp timestamptz,
  add column if not exists last_known_location jsonb,
  add column if not exists current_task text;

-- Create index for event_id lookups to prevent duplicate processing
create index if not exists idx_order_deliveries_event_id
  on public.order_deliveries(event_id);

-- Create index for occurred_at to help with temporal queries
create index if not exists idx_order_deliveries_occurred_at
  on public.order_deliveries(occurred_at);
