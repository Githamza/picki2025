-- Ensure a single row per order in order_deliveries
-- Required for Postgres ON CONFLICT (used by Supabase upsert on `order_id`)
--
-- Note: If this migration fails due to existing duplicates, you must deduplicate
-- rows for the same order_id before applying.

create unique index if not exists uq_order_deliveries_order_id
  on public.order_deliveries(order_id);






