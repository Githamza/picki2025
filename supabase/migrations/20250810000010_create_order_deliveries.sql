-- Create table to persist delivery selection and lifecycle per order
create table if not exists public.order_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  -- selection
  provider text not null, -- e.g. 'stuart', 'uber'
  quote_amount_minor integer not null,
  currency text not null default 'EUR',
  eta_minutes integer,

  -- pickup (restaurant)
  pickup_line1 text not null,
  pickup_postal_code text not null,
  pickup_city text not null,
  pickup_country_code text not null,
  pickup_lat numeric,
  pickup_lng numeric,

  -- dropoff (customer)
  dropoff_line1 text not null,
  dropoff_postal_code text not null,
  dropoff_city text not null,
  dropoff_country_code text not null,
  dropoff_lat numeric,
  dropoff_lng numeric,

  -- provider creation result
  delivery_id text,
  tracking_url text,
  status text, -- provider-mapped status or internal
  raw jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_deliveries enable row level security;

-- Minimal permissive policies for prototype phase
create policy "order_deliveries_select_public"
  on public.order_deliveries for select
  to public using (true);

create policy "order_deliveries_insert_public"
  on public.order_deliveries for insert
  to public with check (true);

create policy "order_deliveries_update_public"
  on public.order_deliveries for update
  to public using (true);

-- Helpful index
create index if not exists idx_order_deliveries_order_id
  on public.order_deliveries(order_id);

