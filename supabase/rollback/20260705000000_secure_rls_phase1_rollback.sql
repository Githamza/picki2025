-- ROLLBACK for 20260705000000_secure_rls_phase1.sql
-- Restores the pre-migration state captured from pg_policies on 2026-07-04.
-- Emergency use only: this re-opens the security holes the migration closed.

-- Disable RLS again on the tables the migration enabled it on
alter table public.products disable row level security;
alter table public.categories disable row level security;
alter table public.product_steps disable row level security;
alter table public.product_step_options disable row level security;
alter table public.customisations disable row level security;
alter table public.customisation_options disable row level security;
alter table public.product_customisations disable row level security;
alter table public.product_complements disable row level security;
alter table public.vendors disable row level security;
alter table public.vendor_metadata disable row level security;

-- Drop the policies the migration added
drop policy if exists products_select_public on public.products;
drop policy if exists products_insert_vendor on public.products;
drop policy if exists products_update_vendor on public.products;
drop policy if exists products_delete_vendor on public.products;
drop policy if exists categories_select_public on public.categories;
drop policy if exists categories_insert_vendor on public.categories;
drop policy if exists categories_update_vendor on public.categories;
drop policy if exists categories_delete_vendor on public.categories;
drop policy if exists product_steps_select_public on public.product_steps;
drop policy if exists product_steps_write_vendor on public.product_steps;
drop policy if exists product_step_options_select_public on public.product_step_options;
drop policy if exists product_step_options_write_vendor on public.product_step_options;
drop policy if exists customisations_select_public on public.customisations;
drop policy if exists customisations_write_vendor on public.customisations;
drop policy if exists customisation_options_select_public on public.customisation_options;
drop policy if exists customisation_options_write_vendor on public.customisation_options;
drop policy if exists product_customisations_select_public on public.product_customisations;
drop policy if exists product_customisations_write_vendor on public.product_customisations;
drop policy if exists product_complements_select_public on public.product_complements;
drop policy if exists product_complements_write_vendor on public.product_complements;
drop policy if exists vendors_select_own_admin on public.vendors;
drop policy if exists vendors_update_own_admin on public.vendors;
drop policy if exists vendor_metadata_insert_vendor on public.vendor_metadata;
drop policy if exists vendor_metadata_update_vendor on public.vendor_metadata;
drop policy if exists vendor_metadata_delete_vendor on public.vendor_metadata;
drop policy if exists vendor_admin_users_select_self on public.vendor_admin_users;
drop policy if exists vendor_admin_users_insert_self on public.vendor_admin_users;
drop policy if exists vendor_admin_users_update_self on public.vendor_admin_users;
drop policy if exists vendor_stuart_settings_select_vendor on public.vendor_stuart_settings;
drop policy if exists vendor_just_eat_daas_settings_vendor on public.vendor_just_eat_daas_settings;
drop policy if exists users_insert_self on public.users;
drop policy if exists banners_select_vendor on public.banners;
drop policy if exists banners_insert_vendor on public.banners;
drop policy if exists banners_update_vendor on public.banners;
drop policy if exists banners_delete_vendor on public.banners;

-- Recreate the original policies (verbatim from the 2026-07-04 dump)
create policy "Dev mode - full access to products" on public.products
  as permissive for all to public using (true) with check (true);
create policy "Public can view active categories" on public.categories
  as permissive for select to public using (is_active = true);
create policy "Allow vendor admin access" on public.vendor_admin_users
  as permissive for all to public using (true);
create policy "Authenticated users can insert banners" on public.banners
  as permissive for insert to authenticated with check (true);
create policy "Authenticated users can update banners" on public.banners
  as permissive for update to authenticated using (true);
create policy "Authenticated users can delete banners" on public.banners
  as permissive for delete to authenticated using (true);
create policy "Allow authenticated users to insert business hours" on public.business_hours
  as permissive for insert to authenticated with check (true);
create policy "Allow authenticated users to update business hours" on public.business_hours
  as permissive for update to authenticated using (true) with check (true);
create policy "Allow authenticated users to delete business hours" on public.business_hours
  as permissive for delete to authenticated using (true);
drop policy if exists business_hours_select_policy on public.business_hours;
create policy business_hours_select_policy on public.business_hours
  as permissive for select to authenticated
  using (vendor_id in (select vendor_admin_users.vendor_id from vendor_admin_users where vendor_admin_users.id = auth.uid()));
drop policy if exists business_hours_insert_policy on public.business_hours;
create policy business_hours_insert_policy on public.business_hours
  as permissive for insert to authenticated
  with check (vendor_id in (select vendor_admin_users.vendor_id from vendor_admin_users where vendor_admin_users.id = auth.uid()));
drop policy if exists business_hours_update_policy on public.business_hours;
create policy business_hours_update_policy on public.business_hours
  as permissive for update to authenticated
  using (vendor_id in (select vendor_admin_users.vendor_id from vendor_admin_users where vendor_admin_users.id = auth.uid()))
  with check (vendor_id in (select vendor_admin_users.vendor_id from vendor_admin_users where vendor_admin_users.id = auth.uid()));
drop policy if exists business_hours_delete_policy on public.business_hours;
create policy business_hours_delete_policy on public.business_hours
  as permissive for delete to authenticated
  using (vendor_id in (select vendor_admin_users.vendor_id from vendor_admin_users where vendor_admin_users.id = auth.uid()));
create policy vendor_stuart_settings_select_public on public.vendor_stuart_settings
  as permissive for select to public using (true);
create policy vendor_stuart_settings_insert_public on public.vendor_stuart_settings
  as permissive for insert to public with check (true);
create policy vendor_stuart_settings_update_public on public.vendor_stuart_settings
  as permissive for update to public using (true);
create policy "Allow public read access to just eat daas settings" on public.vendor_just_eat_daas_settings
  as permissive for select to anon, authenticated using (true);
create policy "Allow authenticated users to insert just eat daas settings" on public.vendor_just_eat_daas_settings
  as permissive for insert to authenticated with check (true);
create policy "Allow authenticated users to update just eat daas settings" on public.vendor_just_eat_daas_settings
  as permissive for update to authenticated using (true);
create policy "Allow authenticated users to delete just eat daas settings" on public.vendor_just_eat_daas_settings
  as permissive for delete to authenticated using (true);
create policy "Allow authenticated users to delete vendor metadata" on public.vendor_metadata
  as permissive for delete to authenticated using (true);
create policy "Public can create users during signup" on public.users
  as permissive for insert to public with check (true);

drop function if exists public.jwt_vendor_ids();
