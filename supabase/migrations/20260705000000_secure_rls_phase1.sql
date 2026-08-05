-- ============================================================================
-- Phase 1 security lockdown (non-breaking).
--
-- Fixes the critical advisor findings without touching the anonymous customer
-- checkout flow (orders / order_items / order_item_complements / payments /
-- order_deliveries are deliberately left as-is; they are locked down in the
-- Phase 2 migration together with the confirm-payment edge function):
--   1. One canonical admin-identity helper: jwt_vendor_ids().
--      Vendor admins authenticate via Supabase Auth and are linked to a vendor
--      through vendor_admin_users.user_id = auth.uid(). (vendors.user_id is
--      NULL for every production row and vendor_admin_users.id is unrelated to
--      auth.uid() — policies built on either never matched.)
--   2. vendor_admin_users: replace the ALL/USING(true) policy with self-only.
--   3. Enable RLS on the 10 exposed tables (products, categories, vendors,
--      vendor_metadata, product_steps, product_step_options, customisations,
--      customisation_options, product_customisations, product_complements):
--      public read (the storefront browses anonymously), vendor-scoped writes.
--   4. Vendor settings tables: replace USING(true) policies with vendor-scoped
--      ones (business_hours, banners, vendor_stuart_settings,
--      vendor_just_eat_daas_settings, vendor_metadata, users).
--   5. Pin search_path on the flagged functions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Canonical identity helper
-- ----------------------------------------------------------------------------
create or replace function public.jwt_vendor_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select vendor_id
  from public.vendor_admin_users
  where user_id = auth.uid()
    and is_active = true
$$;

comment on function public.jwt_vendor_ids() is
  'Vendor ids the calling JWT administers (via vendor_admin_users.user_id = auth.uid()). Canonical identity check for vendor-scoped RLS policies.';

-- Only authenticated policies reference this; anon must not be able to call it.
revoke all on function public.jwt_vendor_ids() from public, anon;
grant execute on function public.jwt_vendor_ids() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. vendor_admin_users — was: ALL USING(true) for everyone
-- ----------------------------------------------------------------------------
-- Backfill user_id from auth.users for legacy rows created before user_id was
-- set (the login flow looks the row up after Supabase Auth sign-in, so a row
-- whose user_id is NULL would otherwise become invisible to its own admin).
update public.vendor_admin_users vau
set user_id = u.id
from auth.users u
where vau.user_id is null
  and lower(u.email) = lower(vau.email);

drop policy if exists "Allow vendor admin access" on public.vendor_admin_users;

drop policy if exists vendor_admin_users_select_self on public.vendor_admin_users;
create policy vendor_admin_users_select_self
  on public.vendor_admin_users for select to authenticated
  using (
    user_id = auth.uid()
    -- Safety net for rows created email-first: an admin may read the row
    -- carrying their own (JWT-verified) email even before user_id is set.
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists vendor_admin_users_insert_self on public.vendor_admin_users;
create policy vendor_admin_users_insert_self
  on public.vendor_admin_users for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists vendor_admin_users_update_self on public.vendor_admin_users;
create policy vendor_admin_users_update_self
  on public.vendor_admin_users for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Catalog tables — enable RLS, public read, vendor-scoped writes
-- ----------------------------------------------------------------------------

-- products ------------------------------------------------------------------
alter table public.products enable row level security;
drop policy if exists "Dev mode - full access to products" on public.products;

drop policy if exists products_select_public on public.products;
create policy products_select_public
  on public.products for select to anon, authenticated
  using (true);

drop policy if exists products_insert_vendor on public.products;
create policy products_insert_vendor
  on public.products for insert to authenticated
  with check (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists products_update_vendor on public.products;
create policy products_update_vendor
  on public.products for update to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()))
  with check (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists products_delete_vendor on public.products;
create policy products_delete_vendor
  on public.products for delete to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()));

-- categories (vendor column is camelCase "vendorId") -------------------------
alter table public.categories enable row level security;
-- The old policy would hide inactive categories from the admin manager once
-- RLS is enforced; replaced by an unconditional read (names/images only).
drop policy if exists "Public can view active categories" on public.categories;

drop policy if exists categories_select_public on public.categories;
create policy categories_select_public
  on public.categories for select to anon, authenticated
  using (true);

drop policy if exists categories_insert_vendor on public.categories;
create policy categories_insert_vendor
  on public.categories for insert to authenticated
  with check ("vendorId" in (select public.jwt_vendor_ids()));

drop policy if exists categories_update_vendor on public.categories;
create policy categories_update_vendor
  on public.categories for update to authenticated
  using ("vendorId" in (select public.jwt_vendor_ids()))
  with check ("vendorId" in (select public.jwt_vendor_ids()));

drop policy if exists categories_delete_vendor on public.categories;
create policy categories_delete_vendor
  on public.categories for delete to authenticated
  using ("vendorId" in (select public.jwt_vendor_ids()));

-- product_steps (no vendor column — scope through the owning product) --------
alter table public.product_steps enable row level security;

drop policy if exists product_steps_select_public on public.product_steps;
create policy product_steps_select_public
  on public.product_steps for select to anon, authenticated
  using (true);

drop policy if exists product_steps_write_vendor on public.product_steps;
create policy product_steps_write_vendor
  on public.product_steps for all to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_steps.product_id
      and p.vendor_id in (select public.jwt_vendor_ids())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_steps.product_id
      and p.vendor_id in (select public.jwt_vendor_ids())
  ));

-- product_step_options (has its own vendor_id; also linked to a product) -----
alter table public.product_step_options enable row level security;

drop policy if exists product_step_options_select_public on public.product_step_options;
create policy product_step_options_select_public
  on public.product_step_options for select to anon, authenticated
  using (true);

drop policy if exists product_step_options_write_vendor on public.product_step_options;
create policy product_step_options_write_vendor
  on public.product_step_options for all to authenticated
  using (
    vendor_id in (select public.jwt_vendor_ids())
    or exists (
      select 1 from public.products p
      where p.id = product_step_options.product_id
        and p.vendor_id in (select public.jwt_vendor_ids())
    )
  )
  with check (
    vendor_id in (select public.jwt_vendor_ids())
    or exists (
      select 1 from public.products p
      where p.id = product_step_options.product_id
        and p.vendor_id in (select public.jwt_vendor_ids())
    )
  );

-- customisations (has vendor_id) ----------------------------------------------
alter table public.customisations enable row level security;

drop policy if exists customisations_select_public on public.customisations;
create policy customisations_select_public
  on public.customisations for select to anon, authenticated
  using (true);

drop policy if exists customisations_write_vendor on public.customisations;
create policy customisations_write_vendor
  on public.customisations for all to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()))
  with check (vendor_id in (select public.jwt_vendor_ids()));

-- customisation_options (scope through the parent customisation) -------------
alter table public.customisation_options enable row level security;

drop policy if exists customisation_options_select_public on public.customisation_options;
create policy customisation_options_select_public
  on public.customisation_options for select to anon, authenticated
  using (true);

drop policy if exists customisation_options_write_vendor on public.customisation_options;
create policy customisation_options_write_vendor
  on public.customisation_options for all to authenticated
  using (exists (
    select 1 from public.customisations c
    where c.id = customisation_options.customisation_id
      and c.vendor_id in (select public.jwt_vendor_ids())
  ))
  with check (exists (
    select 1 from public.customisations c
    where c.id = customisation_options.customisation_id
      and c.vendor_id in (select public.jwt_vendor_ids())
  ));

-- product_customisations (scope through the product) --------------------------
alter table public.product_customisations enable row level security;

drop policy if exists product_customisations_select_public on public.product_customisations;
create policy product_customisations_select_public
  on public.product_customisations for select to anon, authenticated
  using (true);

drop policy if exists product_customisations_write_vendor on public.product_customisations;
create policy product_customisations_write_vendor
  on public.product_customisations for all to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_customisations.product_id
      and p.vendor_id in (select public.jwt_vendor_ids())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_customisations.product_id
      and p.vendor_id in (select public.jwt_vendor_ids())
  ));

-- product_complements (scope through the main product) ------------------------
alter table public.product_complements enable row level security;

drop policy if exists product_complements_select_public on public.product_complements;
create policy product_complements_select_public
  on public.product_complements for select to anon, authenticated
  using (true);

drop policy if exists product_complements_write_vendor on public.product_complements;
create policy product_complements_write_vendor
  on public.product_complements for all to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_complements.product_id
      and p.vendor_id in (select public.jwt_vendor_ids())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_complements.product_id
      and p.vendor_id in (select public.jwt_vendor_ids())
  ));

-- ----------------------------------------------------------------------------
-- 4. vendors — enable RLS (exposes national_id until Phase 2 moves it)
-- ----------------------------------------------------------------------------
alter table public.vendors enable row level security;
-- Existing policies kept: "Public can view active vendors" (select, is_active),
-- "Authenticated users can become vendors" (insert). The existing update policy
-- ("Vendors can update their own profile", user_id = auth.uid()) never matches
-- (vendors.user_id is NULL in production) but is harmless; real admin access:

drop policy if exists vendors_select_own_admin on public.vendors;
create policy vendors_select_own_admin
  on public.vendors for select to authenticated
  using (id in (select public.jwt_vendor_ids()));

drop policy if exists vendors_update_own_admin on public.vendors;
create policy vendors_update_own_admin
  on public.vendors for update to authenticated
  using (id in (select public.jwt_vendor_ids()))
  with check (id in (select public.jwt_vendor_ids()));

-- ----------------------------------------------------------------------------
-- 5. Vendor settings tables
-- ----------------------------------------------------------------------------

-- vendor_metadata (public contact/address info; storefront reads it anon) ----
alter table public.vendor_metadata enable row level security;
-- kept: "Allow public read access to vendor metadata"
drop policy if exists "Allow authenticated users to delete vendor metadata" on public.vendor_metadata;

drop policy if exists vendor_metadata_insert_vendor on public.vendor_metadata;
create policy vendor_metadata_insert_vendor
  on public.vendor_metadata for insert to authenticated
  with check (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists vendor_metadata_update_vendor on public.vendor_metadata;
create policy vendor_metadata_update_vendor
  on public.vendor_metadata for update to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()))
  with check (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists vendor_metadata_delete_vendor on public.vendor_metadata;
create policy vendor_metadata_delete_vendor
  on public.vendor_metadata for delete to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()));

-- business_hours (storefront reads anon; writes were USING(true), and the
-- vendor-scoped policies compared the wrong column: vendor_admin_users.id) ----
drop policy if exists "Allow authenticated users to delete business hours" on public.business_hours;
drop policy if exists "Allow authenticated users to insert business hours" on public.business_hours;
drop policy if exists "Allow authenticated users to update business hours" on public.business_hours;
-- kept: "Allow public read access to business hours"

drop policy if exists business_hours_select_policy on public.business_hours;
create policy business_hours_select_policy
  on public.business_hours for select to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists business_hours_insert_policy on public.business_hours;
create policy business_hours_insert_policy
  on public.business_hours for insert to authenticated
  with check (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists business_hours_update_policy on public.business_hours;
create policy business_hours_update_policy
  on public.business_hours for update to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()))
  with check (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists business_hours_delete_policy on public.business_hours;
create policy business_hours_delete_policy
  on public.business_hours for delete to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()));

-- banners ---------------------------------------------------------------------
drop policy if exists "Authenticated users can insert banners" on public.banners;
drop policy if exists "Authenticated users can update banners" on public.banners;
drop policy if exists "Authenticated users can delete banners" on public.banners;
-- kept: "Public can view active banners"

drop policy if exists banners_select_vendor on public.banners;
create policy banners_select_vendor
  on public.banners for select to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists banners_insert_vendor on public.banners;
create policy banners_insert_vendor
  on public.banners for insert to authenticated
  with check (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists banners_update_vendor on public.banners;
create policy banners_update_vendor
  on public.banners for update to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()))
  with check (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists banners_delete_vendor on public.banners;
create policy banners_delete_vendor
  on public.banners for delete to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()));

-- vendor_stuart_settings (webhook config; only edge functions write it) -------
drop policy if exists vendor_stuart_settings_select_public on public.vendor_stuart_settings;
drop policy if exists vendor_stuart_settings_insert_public on public.vendor_stuart_settings;
drop policy if exists vendor_stuart_settings_update_public on public.vendor_stuart_settings;

drop policy if exists vendor_stuart_settings_select_vendor on public.vendor_stuart_settings;
create policy vendor_stuart_settings_select_vendor
  on public.vendor_stuart_settings for select to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()));

-- vendor_just_eat_daas_settings ------------------------------------------------
drop policy if exists "Allow public read access to just eat daas settings" on public.vendor_just_eat_daas_settings;
drop policy if exists "Allow authenticated users to insert just eat daas settings" on public.vendor_just_eat_daas_settings;
drop policy if exists "Allow authenticated users to update just eat daas settings" on public.vendor_just_eat_daas_settings;
drop policy if exists "Allow authenticated users to delete just eat daas settings" on public.vendor_just_eat_daas_settings;

drop policy if exists vendor_just_eat_daas_settings_vendor on public.vendor_just_eat_daas_settings;
create policy vendor_just_eat_daas_settings_vendor
  on public.vendor_just_eat_daas_settings for all to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()))
  with check (vendor_id in (select public.jwt_vendor_ids()));

-- users (legacy signup path; only allow inserting one's own row) ---------------
drop policy if exists "Public can create users during signup" on public.users;

drop policy if exists users_insert_self on public.users;
create policy users_insert_self
  on public.users for insert to authenticated
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 6. Pin search_path on flagged functions (advisor: function_search_path_mutable)
-- ----------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_vendor_order', 'user_owns_order', 'order_item_belongs_to_user',
        'user_is_vendor_for_order_item', 'vendor_has_items_in_order',
        'reserve_stock_for_order', 'restore_stock_for_order',
        'decrement_stock_for_order', 'reset_daily_product_stock',
        'validate_stock_for_cart', 'fn_redeem_coupon_on_order',
        'create_user_profile', 'update_updated_at_column', 'update_updated_at',
        'update_listings_updated_at', 'set_updated_at'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
  end loop;
end $$;
