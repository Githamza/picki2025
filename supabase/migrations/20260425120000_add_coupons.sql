-- Coupons feature: vendor-scoped, reusable codes (percentage or fixed amount)
-- with validity window and total-uses cap.
--
-- Conventions verified against the live picki2025 database:
--   * Money is stored as numeric major units (matches orders.total_amount).
--   * Vendor-admin auth is via vendor_admin_users.id = auth.uid() (matches business_hours_*_policy).
--   * order_status enum values: {todo, ongoing, done, picked, cancelled, initiated, paid, refused}.

------------------------------------------------------------
-- 1) Discount type enum + coupons table
------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'coupon_discount_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.coupon_discount_type AS ENUM ('percentage', 'fixed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type public.coupon_discount_type NOT NULL,
  discount_value numeric(10,2),         -- 'fixed': amount in vendor currency major units
  discount_percent numeric(5,2),        -- 'percentage': 0 < value <= 100
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  max_uses integer,                     -- NULL = unlimited
  current_uses integer NOT NULL DEFAULT 0,
  min_subtotal numeric(10,2),           -- optional gate, major units
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_per_vendor_uniq UNIQUE (vendor_id, code),
  CONSTRAINT coupons_validity_chk CHECK (valid_until > valid_from),
  CONSTRAINT coupons_value_chk CHECK (
    (discount_type = 'percentage'
       AND discount_percent IS NOT NULL
       AND discount_percent > 0 AND discount_percent <= 100
       AND discount_value IS NULL)
    OR (discount_type = 'fixed'
       AND discount_value IS NOT NULL
       AND discount_value > 0
       AND discount_percent IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_coupons_vendor_id ON public.coupons(vendor_id);

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

------------------------------------------------------------
-- 2) RLS policies (mirrors business_hours_*_policy pattern)
------------------------------------------------------------
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupons_select_policy ON public.coupons;
CREATE POLICY coupons_select_policy ON public.coupons
  FOR SELECT TO authenticated
  USING (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS coupons_insert_policy ON public.coupons;
CREATE POLICY coupons_insert_policy ON public.coupons
  FOR INSERT TO authenticated
  WITH CHECK (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS coupons_update_policy ON public.coupons;
CREATE POLICY coupons_update_policy ON public.coupons
  FOR UPDATE TO authenticated
  USING (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users WHERE id = auth.uid()
  ))
  WITH CHECK (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS coupons_delete_policy ON public.coupons;
CREATE POLICY coupons_delete_policy ON public.coupons
  FOR DELETE TO authenticated
  USING (vendor_id IN (
    SELECT vendor_id FROM public.vendor_admin_users WHERE id = auth.uid()
  ));

-- Note: customer-facing validation runs through the validate-coupon edge function
-- using the service role key, so no anon SELECT policy is exposed.

------------------------------------------------------------
-- 3) Add redemption columns to orders (numeric major units)
------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_redeemed boolean NOT NULL DEFAULT false;

------------------------------------------------------------
-- 4) Atomic, idempotent redemption trigger
--    Fires when an order reaches a "consumed" status.
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_redeem_coupon_on_order()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.coupon_id IS NOT NULL
     AND NEW.coupon_redeemed = false
     AND NEW.status IN ('paid', 'todo', 'ongoing', 'done', 'picked')
  THEN
    UPDATE public.coupons
       SET current_uses = current_uses + 1
     WHERE id = NEW.coupon_id
       AND is_active
       AND now() BETWEEN valid_from AND valid_until
       AND (max_uses IS NULL OR current_uses < max_uses);
    NEW.coupon_redeemed := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_redeem_coupon ON public.orders;
CREATE TRIGGER trg_orders_redeem_coupon
  BEFORE INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_redeem_coupon_on_order();
