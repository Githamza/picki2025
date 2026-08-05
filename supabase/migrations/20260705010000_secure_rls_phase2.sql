-- ============================================================================
-- Phase 2 security lockdown: orders / order_items / order_item_complements /
-- payments / order_deliveries.
--
-- Customers are anonymous, so these tables previously carried USING(true)
-- policies for the anon checkout + payment-success flow — which also let any
-- anon-key holder dump all customer PII and mark any order paid. This phase
-- moves the flow behind controlled entry points and removes every public
-- policy on the order tables:
--
--   * create_full_order()    — SECURITY DEFINER RPC: checkout inserts the
--     order + items + complements and reserves stock atomically (rollback on
--     insufficient stock replaces the old client-side delete-on-failure).
--   * save_order_delivery()  — SECURITY DEFINER RPC: the delivery-quote
--     upsert, refused once the order is progressed or a courier is assigned.
--   * confirm-payment edge function (service role) — payment verification,
--     initiated->paid, payments insert, delivery status, email flag, and all
--     customer-facing order reads (success page polling, tracking links).
--
-- Remaining policies are vendor-scoped (jwt_vendor_ids(), from phase 1) for
-- the admin apps, plus the service-role bypass for edge functions/webhooks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Checkout RPC: create order + items + complements + reserve stock
-- ----------------------------------------------------------------------------
create or replace function public.create_full_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid := coalesce(nullif(p_order->>'id', '')::uuid, gen_random_uuid());
  v_status text := coalesce(p_order->>'status', 'initiated');
  v_item jsonb;
  v_complement jsonb;
  v_item_id bigint;
  v_stock jsonb;
begin
  -- Anonymous checkout may only create orders awaiting payment or counter
  -- payment; 'paid' is set exclusively by the confirm-payment function.
  if v_status not in ('initiated', 'todo') then
    raise exception 'Invalid initial order status: %', v_status;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if coalesce((p_order->>'total_amount')::numeric, -1) < 0 then
    raise exception 'Invalid total amount';
  end if;

  insert into orders (
    id, order_number, customer_email, customer_first_name, customer_last_name,
    customer_phone, total_amount, status, order_type, timing, scheduled_time,
    table_number, notes, pay_at_checkout, vendor_id, coupon_id, coupon_code,
    discount_amount
  ) values (
    v_order_id,
    p_order->>'order_number',
    p_order->>'customer_email',
    p_order->>'customer_first_name',
    p_order->>'customer_last_name',
    p_order->>'customer_phone',
    (p_order->>'total_amount')::numeric,
    v_status::order_status,
    (p_order->>'order_type')::order_type,
    coalesce(nullif(p_order->>'timing', ''), 'asap')::order_timing,
    nullif(p_order->>'scheduled_time', '')::timestamptz,
    p_order->>'table_number',
    p_order->>'notes',
    coalesce((p_order->>'pay_at_checkout')::boolean, false),
    nullif(p_order->>'vendor_id', '')::uuid,
    nullif(p_order->>'coupon_id', '')::uuid,
    p_order->>'coupon_code',
    coalesce((p_order->>'discount_amount')::numeric, 0)
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if coalesce((v_item->>'quantity')::integer, 0) <= 0 then
      raise exception 'Invalid item quantity';
    end if;

    insert into order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price,
      tva_rate, vendor_id, options, comment
    ) values (
      v_order_id,
      nullif(v_item->>'product_id', '')::integer,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric,
      coalesce(nullif(v_item->>'tva_rate', '')::numeric, 10.00),
      nullif(v_item->>'vendor_id', '')::uuid,
      coalesce(v_item->'options', '[]'::jsonb),
      v_item->>'comment'
    )
    returning id into v_item_id;

    if v_item ? 'complements' and jsonb_typeof(v_item->'complements') = 'array' then
      for v_complement in select * from jsonb_array_elements(v_item->'complements')
      loop
        insert into order_item_complements (
          order_item_id, complement_product_id, complement_name, quantity,
          unit_price, total_price
        ) values (
          v_item_id,
          nullif(v_complement->>'complement_product_id', '')::integer,
          v_complement->>'complement_name',
          (v_complement->>'quantity')::integer,
          (v_complement->>'unit_price')::numeric,
          (v_complement->>'total_price')::numeric
        );
      end loop;
    end if;
  end loop;

  v_stock := reserve_stock_for_order(v_order_id);
  if not coalesce((v_stock->>'success')::boolean, false) then
    -- Raising rolls back the order + items inserted above.
    raise exception 'INSUFFICIENT_STOCK'
      using detail = coalesce(v_stock->'insufficientItems', '[]'::jsonb)::text,
            errcode = 'P0001';
  end if;

  return jsonb_build_object('success', true, 'order_id', v_order_id, 'stock', v_stock);
end;
$$;

comment on function public.create_full_order(jsonb, jsonb) is
  'Anonymous checkout entry point: creates an order with its items and complements and reserves stock atomically. Replaces the direct anon INSERTs on the order tables.';

revoke all on function public.create_full_order(jsonb, jsonb) from public;
grant execute on function public.create_full_order(jsonb, jsonb) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Delivery-quote RPC (checkout upsert, locked once the courier flow starts)
-- ----------------------------------------------------------------------------
create or replace function public.save_order_delivery(p jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid := (p->>'order_id')::uuid;
  v_existing record;
begin
  perform 1 from orders
  where id = v_order_id and status in ('initiated', 'todo');
  if not found then
    raise exception 'Order not found or already progressed';
  end if;

  select delivery_id, status into v_existing
  from order_deliveries where order_id = v_order_id;
  if found and (v_existing.delivery_id is not null) then
    raise exception 'Delivery already dispatched for this order';
  end if;

  insert into order_deliveries (
    order_id, provider, quote_amount_minor, currency, eta_minutes, status,
    pickup_line1, pickup_postal_code, pickup_city, pickup_country_code,
    pickup_lat, pickup_lng,
    dropoff_line1, dropoff_postal_code, dropoff_city, dropoff_country_code,
    dropoff_lat, dropoff_lng,
    raw, updated_at
  ) values (
    v_order_id,
    p->>'provider',
    nullif(p->>'quote_amount_minor', '')::numeric,
    p->>'currency',
    nullif(p->>'eta_minutes', '')::integer,
    nullif(p->>'status', ''),
    p->'pickup'->>'line1', p->'pickup'->>'postal_code', p->'pickup'->>'city',
    p->'pickup'->>'country_code',
    nullif(p->'pickup'->>'lat', '')::double precision,
    nullif(p->'pickup'->>'lng', '')::double precision,
    p->'dropoff'->>'line1', p->'dropoff'->>'postal_code', p->'dropoff'->>'city',
    p->'dropoff'->>'country_code',
    nullif(p->'dropoff'->>'lat', '')::double precision,
    nullif(p->'dropoff'->>'lng', '')::double precision,
    p->'raw',
    now()
  )
  on conflict (order_id) do update set
    provider = excluded.provider,
    quote_amount_minor = excluded.quote_amount_minor,
    currency = excluded.currency,
    eta_minutes = excluded.eta_minutes,
    status = excluded.status,
    pickup_line1 = excluded.pickup_line1,
    pickup_postal_code = excluded.pickup_postal_code,
    pickup_city = excluded.pickup_city,
    pickup_country_code = excluded.pickup_country_code,
    pickup_lat = excluded.pickup_lat,
    pickup_lng = excluded.pickup_lng,
    dropoff_line1 = excluded.dropoff_line1,
    dropoff_postal_code = excluded.dropoff_postal_code,
    dropoff_city = excluded.dropoff_city,
    dropoff_country_code = excluded.dropoff_country_code,
    dropoff_lat = excluded.dropoff_lat,
    dropoff_lng = excluded.dropoff_lng,
    raw = excluded.raw,
    updated_at = now();
end;
$$;

comment on function public.save_order_delivery(jsonb) is
  'Anonymous checkout entry point: upserts the delivery quote for an order still awaiting payment. Replaces the direct anon writes on order_deliveries.';

revoke all on function public.save_order_delivery(jsonb) from public;
grant execute on function public.save_order_delivery(jsonb) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. orders — vendor-scoped only (customers go through the entry points above)
-- ----------------------------------------------------------------------------
drop policy if exists "Allow all order updates for development" on public.orders;
drop policy if exists "Allow order status updates for development" on public.orders;
drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Public can insert orders" on public.orders;
drop policy if exists "Public can select orders" on public.orders;
drop policy if exists "Authenticated users can insert orders" on public.orders;
drop policy if exists "Users can view their own orders" on public.orders;
drop policy if exists "Vendors can view orders with their products" on public.orders;
-- kept: "Service role can manage all orders"

drop policy if exists orders_select_vendor on public.orders;
create policy orders_select_vendor
  on public.orders for select to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()));

drop policy if exists orders_update_vendor on public.orders;
create policy orders_update_vendor
  on public.orders for update to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()))
  with check (vendor_id in (select public.jwt_vendor_ids()));

-- ----------------------------------------------------------------------------
-- 4. order_items — vendor-scoped (fee rows have NULL vendor_id, so also allow
--    access through the owning order's vendor)
-- ----------------------------------------------------------------------------
drop policy if exists "Public can create order items" on public.order_items;
drop policy if exists "Public can insert order items" on public.order_items;
drop policy if exists "Public can select order items" on public.order_items;
drop policy if exists "Users can update order items from their orders" on public.order_items;
drop policy if exists "Users can view order items from their orders" on public.order_items;
drop policy if exists "Users can view their order items" on public.order_items;
drop policy if exists "Vendors can update their order items" on public.order_items;
drop policy if exists "Vendors can view their order items" on public.order_items;

drop policy if exists order_items_select_vendor on public.order_items;
create policy order_items_select_vendor
  on public.order_items for select to authenticated
  using (
    vendor_id in (select public.jwt_vendor_ids())
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.vendor_id in (select public.jwt_vendor_ids())
    )
  );

drop policy if exists order_items_update_vendor on public.order_items;
create policy order_items_update_vendor
  on public.order_items for update to authenticated
  using (
    vendor_id in (select public.jwt_vendor_ids())
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.vendor_id in (select public.jwt_vendor_ids())
    )
  );

-- ----------------------------------------------------------------------------
-- 5. order_item_complements — vendor read via the owning order
-- ----------------------------------------------------------------------------
drop policy if exists "Public can insert order item complements" on public.order_item_complements;
drop policy if exists "Public can select order item complements" on public.order_item_complements;

drop policy if exists order_item_complements_select_vendor on public.order_item_complements;
create policy order_item_complements_select_vendor
  on public.order_item_complements for select to authenticated
  using (exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_complements.order_item_id
      and o.vendor_id in (select public.jwt_vendor_ids())
  ));

-- ----------------------------------------------------------------------------
-- 6. payments — vendor-scoped via the order; writes only from confirm-payment
--    (service role) and the vendor's own status updates
-- ----------------------------------------------------------------------------
drop policy if exists "Allow all payment operations for development" on public.payments;
drop policy if exists "Users can view their own payments" on public.payments;
drop policy if exists "Vendors can view payments for their orders" on public.payments;

drop policy if exists payments_select_vendor on public.payments;
create policy payments_select_vendor
  on public.payments for select to authenticated
  using (order_id in (
    select o.id from public.orders o
    where o.vendor_id in (select public.jwt_vendor_ids())
  ));

drop policy if exists payments_update_vendor on public.payments;
create policy payments_update_vendor
  on public.payments for update to authenticated
  using (order_id in (
    select o.id from public.orders o
    where o.vendor_id in (select public.jwt_vendor_ids())
  ))
  with check (order_id in (
    select o.id from public.orders o
    where o.vendor_id in (select public.jwt_vendor_ids())
  ));

-- ----------------------------------------------------------------------------
-- 7. order_deliveries — vendor-scoped via the order (webhooks + confirm-payment
--    use the service role; the checkout quote goes through save_order_delivery)
-- ----------------------------------------------------------------------------
drop policy if exists order_deliveries_insert_public on public.order_deliveries;
drop policy if exists order_deliveries_select_public on public.order_deliveries;
drop policy if exists order_deliveries_update_public on public.order_deliveries;

drop policy if exists order_deliveries_select_vendor on public.order_deliveries;
create policy order_deliveries_select_vendor
  on public.order_deliveries for select to authenticated
  using (order_id in (
    select o.id from public.orders o
    where o.vendor_id in (select public.jwt_vendor_ids())
  ));

drop policy if exists order_deliveries_write_vendor on public.order_deliveries;
create policy order_deliveries_write_vendor
  on public.order_deliveries for all to authenticated
  using (order_id in (
    select o.id from public.orders o
    where o.vendor_id in (select public.jwt_vendor_ids())
  ))
  with check (order_id in (
    select o.id from public.orders o
    where o.vendor_id in (select public.jwt_vendor_ids())
  ));

-- ----------------------------------------------------------------------------
-- 8. Fix the anonymous passthrough in the customer-ownership helpers.
--    (Their policies are dropped above, but the functions remain callable and
--    previously returned true for ANY anonymous caller.)
-- ----------------------------------------------------------------------------
create or replace function public.user_owns_order(order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from orders
    where orders.id = order_id
      and orders.user_id = auth.uid()
  );
end;
$$;

create or replace function public.order_item_belongs_to_user(item_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from orders
    where orders.id = item_order_id
      and orders.user_id = auth.uid()
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Move vendors.national_id (PayGreen SIRET) out of the publicly readable
--    vendors row into a vendor-scoped table.
-- ----------------------------------------------------------------------------
create table if not exists public.vendor_private_info (
  vendor_id uuid primary key references public.vendors(id) on delete cascade,
  national_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.vendor_private_info is
  'Vendor fields that must not be exposed on the public vendors row (e.g. the SIRET used for PayGreen onboarding). Vendor-scoped RLS.';

alter table public.vendor_private_info enable row level security;

drop policy if exists vendor_private_info_vendor on public.vendor_private_info;
create policy vendor_private_info_vendor
  on public.vendor_private_info for all to authenticated
  using (vendor_id in (select public.jwt_vendor_ids()))
  with check (vendor_id in (select public.jwt_vendor_ids()));

-- Guarded so the migration stays re-runnable after the column is dropped
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vendors'
      and column_name = 'national_id'
  ) then
    insert into public.vendor_private_info (vendor_id, national_id)
    select id, national_id from public.vendors
    where national_id is not null
    on conflict (vendor_id) do nothing;
  end if;
end $$;

alter table public.vendors drop column if exists national_id;

-- ----------------------------------------------------------------------------
-- 10. Storage: image writes are admin operations (the app uploads product /
--     category / banner / logo images from the admin screens, now on the
--     authenticated client). Public READ policies and the buckets' public
--     flags are kept so existing image URLs keep rendering.
-- ----------------------------------------------------------------------------
drop policy if exists "upload oimages rq4fyk_0" on storage.objects;
drop policy if exists "Give anon users access to JPG images in folder rq4fyk_0" on storage.objects;
drop policy if exists "Allow public uploads to product-images" on storage.objects;
drop policy if exists "Allow public updates to product-images" on storage.objects;
drop policy if exists "Anyone can upload vendor assets" on storage.objects;
drop policy if exists "Anyone can update vendor assets" on storage.objects;
drop policy if exists "Anyone can delete vendor assets" on storage.objects;

drop policy if exists productsophotos_insert_authenticated on storage.objects;
create policy productsophotos_insert_authenticated
  on storage.objects for insert to authenticated
  with check (bucket_id = 'productsophotos');

drop policy if exists productsophotos_update_authenticated on storage.objects;
create policy productsophotos_update_authenticated
  on storage.objects for update to authenticated
  using (bucket_id = 'productsophotos');

drop policy if exists productsophotos_delete_authenticated on storage.objects;
create policy productsophotos_delete_authenticated
  on storage.objects for delete to authenticated
  using (bucket_id = 'productsophotos');

drop policy if exists vendor_assets_insert_authenticated on storage.objects;
create policy vendor_assets_insert_authenticated
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-assets');

drop policy if exists vendor_assets_update_authenticated on storage.objects;
create policy vendor_assets_update_authenticated
  on storage.objects for update to authenticated
  using (bucket_id = 'vendor-assets');

drop policy if exists vendor_assets_delete_authenticated on storage.objects;
create policy vendor_assets_delete_authenticated
  on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-assets');

-- ----------------------------------------------------------------------------
-- 11. SECURITY DEFINER function exposure. After this phase:
--     * reserve_stock_for_order runs only inside create_full_order,
--     * restore_stock_for_order is called by the admin app (authenticated),
--     * the boolean order-ownership helpers back no policy anymore,
--     * decrement/reset/create_user_profile have no client callers.
--     validate_stock_for_cart intentionally stays anon-callable: the customer
--     cart validates stock before checkout.
-- ----------------------------------------------------------------------------
-- NOTE: EXECUTE is granted to PUBLIC by default on Postgres functions, so
-- revoking from anon/authenticated alone is a no-op — revoke from public and
-- re-grant only the roles that need each function.
revoke execute on function public.reserve_stock_for_order(uuid) from public, anon, authenticated;
grant execute on function public.reserve_stock_for_order(uuid) to service_role;

revoke execute on function public.restore_stock_for_order(uuid) from public, anon;
grant execute on function public.restore_stock_for_order(uuid) to authenticated, service_role;

revoke execute on function public.decrement_stock_for_order(uuid) from public, anon, authenticated;
grant execute on function public.decrement_stock_for_order(uuid) to service_role;

revoke execute on function public.reset_daily_product_stock() from public, anon, authenticated;
grant execute on function public.reset_daily_product_stock() to service_role;

revoke execute on function public.create_user_profile() from public, anon, authenticated;
grant execute on function public.create_user_profile() to service_role;

revoke execute on function public.is_vendor_order(uuid) from public, anon, authenticated;
revoke execute on function public.user_owns_order(uuid) from public, anon, authenticated;
revoke execute on function public.order_item_belongs_to_user(uuid) from public, anon, authenticated;
revoke execute on function public.user_is_vendor_for_order_item(uuid) from public, anon, authenticated;
revoke execute on function public.vendor_has_items_in_order(uuid) from public, anon, authenticated;

-- Public buckets serve object URLs without a SELECT policy; dropping these
-- broad SELECT policies only disables anonymous LISTING of the buckets.
drop policy if exists "Allow public reads from product-images" on storage.objects;
drop policy if exists "Public read access for vendor assets" on storage.objects;
