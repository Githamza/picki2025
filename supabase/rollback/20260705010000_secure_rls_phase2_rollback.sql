-- ROLLBACK for 20260705010000_secure_rls_phase2.sql
-- Restores the pre-migration open policies captured from pg_policies on
-- 2026-07-04. Emergency use only — also requires re-deploying the pre-Phase-2
-- frontend build, since the refactored app writes through the RPCs and the
-- confirm-payment function instead of the tables.
-- If Phase 1 must also be rolled back, run THIS file first (its policies
-- reference jwt_vendor_ids(), which the Phase 1 rollback drops).

-- Drop the vendor-scoped policies Phase 2 added
drop policy if exists orders_select_vendor on public.orders;
drop policy if exists orders_update_vendor on public.orders;
drop policy if exists order_items_select_vendor on public.order_items;
drop policy if exists order_items_update_vendor on public.order_items;
drop policy if exists order_item_complements_select_vendor on public.order_item_complements;
drop policy if exists payments_select_vendor on public.payments;
drop policy if exists payments_update_vendor on public.payments;
drop policy if exists order_deliveries_select_vendor on public.order_deliveries;
drop policy if exists order_deliveries_write_vendor on public.order_deliveries;

-- Recreate the original policies (verbatim from the 2026-07-04 dump)
create policy "Public can select orders" on public.orders
  as permissive for select to public using (true);
create policy "Public can create orders" on public.orders
  as permissive for insert to public with check (true);
create policy "Public can insert orders" on public.orders
  as permissive for insert to public with check (true);
create policy "Authenticated users can insert orders" on public.orders
  as permissive for insert to authenticated with check (true);
create policy "Allow all order updates for development" on public.orders
  as permissive for update to public using (true);
create policy "Allow order status updates for development" on public.orders
  as permissive for update to public using (true);
create policy "Users can view their own orders" on public.orders
  as permissive for select to public using ((user_id = auth.uid()) or (auth.uid() is null));
create policy "Vendors can view orders with their products" on public.orders
  as permissive for select to public using (is_vendor_order(id));

create policy "Public can select order items" on public.order_items
  as permissive for select to public using (true);
create policy "Public can create order items" on public.order_items
  as permissive for insert to public with check (true);
create policy "Public can insert order items" on public.order_items
  as permissive for insert to public with check (true);
create policy "Users can view order items from their orders" on public.order_items
  as permissive for select to public using (order_item_belongs_to_user(order_id));
create policy "Users can update order items from their orders" on public.order_items
  as permissive for update to public using (order_item_belongs_to_user(order_id));
create policy "Users can view their order items" on public.order_items
  as permissive for select to public using (user_owns_order(order_id));
create policy "Vendors can view their order items" on public.order_items
  as permissive for select to public using (user_is_vendor_for_order_item(vendor_id));
create policy "Vendors can update their order items" on public.order_items
  as permissive for update to public using (user_is_vendor_for_order_item(vendor_id));

create policy "Public can select order item complements" on public.order_item_complements
  as permissive for select to public using (true);
create policy "Public can insert order item complements" on public.order_item_complements
  as permissive for insert to public with check (true);

create policy "Allow all payment operations for development" on public.payments
  as permissive for all to public using (true) with check (true);
create policy "Users can view their own payments" on public.payments
  as permissive for select to public
  using (order_id in (select orders.id from orders where orders.user_id = auth.uid()));
create policy "Vendors can view payments for their orders" on public.payments
  as permissive for select to public
  using (order_id in (select distinct o.id from orders o join order_items oi on o.id = oi.order_id
         where oi.vendor_id in (select vendors.id from vendors where vendors.user_id = auth.uid())));

create policy order_deliveries_select_public on public.order_deliveries
  as permissive for select to public using (true);
create policy order_deliveries_insert_public on public.order_deliveries
  as permissive for insert to public with check (true);
create policy order_deliveries_update_public on public.order_deliveries
  as permissive for update to public using (true);

-- Restore the original helper functions (with the anonymous passthrough)
create or replace function public.user_owns_order(order_id uuid)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  return exists (
    select 1 from orders
    where orders.id = order_id
      and (orders.user_id = auth.uid() or auth.uid() is null)
  );
end; $$;

create or replace function public.order_item_belongs_to_user(item_order_id uuid)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  return exists (
    select 1 from orders
    where orders.id = item_order_id
      and (orders.user_id = auth.uid() or auth.uid() is null)
  );
end; $$;

-- Restore vendors.national_id from vendor_private_info
alter table public.vendors add column if not exists national_id text;
update public.vendors v
set national_id = pi.national_id
from public.vendor_private_info pi
where pi.vendor_id = v.id;
drop table if exists public.vendor_private_info;

-- Drop the checkout RPCs
drop function if exists public.create_full_order(jsonb, jsonb);
drop function if exists public.save_order_delivery(jsonb);

-- Restore the original storage policies
drop policy if exists productsophotos_insert_authenticated on storage.objects;
drop policy if exists productsophotos_update_authenticated on storage.objects;
drop policy if exists productsophotos_delete_authenticated on storage.objects;
drop policy if exists vendor_assets_insert_authenticated on storage.objects;
drop policy if exists vendor_assets_update_authenticated on storage.objects;
drop policy if exists vendor_assets_delete_authenticated on storage.objects;

create policy "upload oimages rq4fyk_0" on storage.objects
  as permissive for insert to anon with check (bucket_id = 'productsophotos');
create policy "Give anon users access to JPG images in folder rq4fyk_0" on storage.objects
  as permissive for insert to public
  with check (bucket_id = 'productsophotos' and lower((storage.foldername(name))[1]) = 'public' and auth.role() = 'anon');
create policy "Allow public uploads to product-images" on storage.objects
  as permissive for insert to public with check (bucket_id = 'product-images');
create policy "Allow public updates to product-images" on storage.objects
  as permissive for update to public using (bucket_id = 'product-images');
create policy "Anyone can upload vendor assets" on storage.objects
  as permissive for insert to anon, authenticated with check (bucket_id = 'vendor-assets');
create policy "Anyone can update vendor assets" on storage.objects
  as permissive for update to anon, authenticated using (bucket_id = 'vendor-assets');
create policy "Anyone can delete vendor assets" on storage.objects
  as permissive for delete to anon, authenticated using (bucket_id = 'vendor-assets');
