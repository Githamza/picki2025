-- Per-vendor Stuart configuration (webhook tracking)
create table if not exists public.vendor_stuart_settings (
  vendor_id uuid primary key references public.vendors(id) on delete cascade,
  webhook_id text,
  webhook_url text,
  topics text[] default '{}',
  enabled boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendor_stuart_settings enable row level security;

-- Prototype policies (adjust later)
create policy "vendor_stuart_settings_select_public"
  on public.vendor_stuart_settings for select
  to public using (true);

create policy "vendor_stuart_settings_insert_public"
  on public.vendor_stuart_settings for insert
  to public with check (true);

create policy "vendor_stuart_settings_update_public"
  on public.vendor_stuart_settings for update
  to public using (true);

create index if not exists idx_vendor_stuart_settings_vendor_id
  on public.vendor_stuart_settings(vendor_id);
