-- Deterministic seed for local development and e2e (Playwright).
-- Loaded by `supabase db reset --yes --local` (config.toml → [db.seed]).
--
-- Storefront URL: /vendor/e2e-cafe  (slug derives from business_name)
-- The vendor has online_payments_enabled = false so the e2e order journey
-- completes through the pay-at-counter branch and never touches
-- Stripe/PayGreen (SPEC.md: e2e must not reach payment providers).

-- ---------------------------------------------------------------------------
-- Vendor
-- ---------------------------------------------------------------------------
insert into public.vendors (
  id,
  business_name,
  business_type,
  country,
  currency,
  is_active,
  online_payments_enabled,
  enabled_order_types,
  delivery_system,
  paymentprovider,
  auto_print_enabled
) values (
  'e2e00000-0000-4000-8000-000000000001',
  'E2E Cafe',
  'restaurant',
  'FR',
  'EUR',
  true,
  false,
  array['eat-in', 'take-away']::public.order_type[],
  'picki',
  'STRIPE',
  false
);

-- Open 24/7 so business-hours validation never gates the journey.
insert into public.business_hours
  (vendor_id, day_of_week, is_closed, open_time, close_time, pickup_enabled)
select
  'e2e00000-0000-4000-8000-000000000001',
  d,
  false,
  '00:00',
  '23:59',
  true
from generate_series(0, 6) as d;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
insert into public.categories (id, name, description, display_order, is_active, "vendorId", image_url) values
  (9001, 'Burgers',  'Nos burgers maison', 1, true, 'e2e00000-0000-4000-8000-000000000001',
   'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23b5651d"/></svg>'),
  (9002, 'Boissons', 'Boissons fraîches',  2, true, 'e2e00000-0000-4000-8000-000000000001',
   'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%231d7ab5"/></svg>');

insert into public.products
  (id, name, short_description, price, category_id, display_order,
   is_available, is_multi_step, has_customisations, stock_quantity, vendor_id, image_url) values
  -- Simple product, in stock — the ≤3-taps journey product.
  (9101, 'Burger Classique', 'Steak, salade, tomate', 8.50, 9001, 1,
   true, false, false, null, 'e2e00000-0000-4000-8000-000000000001',
   'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23c0392b"/></svg>'),
  -- Out-of-stock product — stock/unavailable states in grid + card specs.
  (9102, 'Limonade artisanale', 'Citron pressé maison', 3.00, 9002, 1,
   true, false, false, 0, 'e2e00000-0000-4000-8000-000000000001',
   'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23f1c40f"/></svg>'),
  -- Multi-step menu — FR4d journeys (required single, constrained multi, optional).
  (9103, 'Menu Burger', 'Burger + accompagnements + dessert', 12.00, 9001, 2,
   true, true, true, null, 'e2e00000-0000-4000-8000-000000000001',
   'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23803a2b"/></svg>'),
  -- Standalone drink shown in Boissons.
  (9104, 'Coca-Cola', '33cl', 2.50, 9002, 2,
   true, false, false, null, 'e2e00000-0000-4000-8000-000000000001',
   'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23222222"/></svg>');

-- ---------------------------------------------------------------------------
-- Multi-step configuration for "Menu Burger" (9103)
--   Step 1: required single-select
--   Step 2: required multi-select, min 1 / max 2 (constraint-countdown specs)
--   Step 3: optional single-select
-- ---------------------------------------------------------------------------
insert into public.product_steps
  (id, product_id, name, description, display_order, is_required,
   min_selections, max_selections, step_type) values
  (9201, 9103, 'Burger',          'Choisissez votre burger', 1, true,  1, 1, 'single-select'),
  (9202, 9103, 'Accompagnements', 'Choisissez 1 à 2 accompagnements', 2, true, 1, 2, 'multi-select'),
  (9203, 9103, 'Dessert',         'Envie d''une touche sucrée ?', 3, false, 0, 1, 'single-select');

insert into public.product_step_options
  (id, vendor_id, name, description, display_order, option_type,
   price_adjustment, step_ids) values
  (9301, 'e2e00000-0000-4000-8000-000000000001', 'Classique',      'Notre recette signature', 1, 'component', 0,    array[9201]),
  (9302, 'e2e00000-0000-4000-8000-000000000001', 'Double steak',   'Pour les grandes faims',  2, 'component', 2.00, array[9201]),
  (9303, 'e2e00000-0000-4000-8000-000000000001', 'Frites',         null, 1, 'component', 0,    array[9202]),
  (9304, 'e2e00000-0000-4000-8000-000000000001', 'Salade',         null, 2, 'component', 0,    array[9202]),
  (9305, 'e2e00000-0000-4000-8000-000000000001', 'Onion rings',    null, 3, 'component', 0.50, array[9202]),
  (9306, 'e2e00000-0000-4000-8000-000000000001', 'Cookie',         null, 1, 'component', 1.50, array[9203]),
  (9307, 'e2e00000-0000-4000-8000-000000000001', 'Muffin',         null, 2, 'component', 1.50, array[9203]);

-- ---------------------------------------------------------------------------
-- Promotional banner (attract screen reuses this table in the kiosk phase)
-- ---------------------------------------------------------------------------
insert into public.banners (id, vendor_id, title, image_url, is_active, display_order) values
  (9401, 'e2e00000-0000-4000-8000-000000000001', 'Bienvenue chez E2E Cafe',
   'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="%23e91e63"/></svg>',
   true, 1);

-- Keep identity sequences ahead of the fixed ids above.
select setval(pg_get_serial_sequence('public.categories', 'id'),           10000, false);
select setval(pg_get_serial_sequence('public.products', 'id'),             10000, false);
select setval(pg_get_serial_sequence('public.product_steps', 'id'),        10000, false);
select setval(pg_get_serial_sequence('public.product_step_options', 'id'), 10000, false);
select setval(pg_get_serial_sequence('public.banners', 'id'),              10000, false);
