-- Add delivery settings to vendors so admin can choose Picki vs own delivery
-- and optionally configure a fixed delivery price.

alter table public.vendors
add column if not exists delivery_system text not null default 'picki'
  check (delivery_system in ('picki', 'own'));

alter table public.vendors
add column if not exists own_delivery_price numeric not null default 0;

