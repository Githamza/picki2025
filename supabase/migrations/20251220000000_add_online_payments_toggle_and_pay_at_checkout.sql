-- Add vendor-level toggle for online payments
-- and mark orders that should be paid at checkout (offline payment).

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS online_payments_enabled boolean NOT NULL DEFAULT true;

-- Orders created when online payments are disabled should be flagged so that:
-- - Admin UI can display "À payer au retrait / à la caisse"
-- - We don't mix them with abandoned online-payment "initiated" orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pay_at_checkout boolean NOT NULL DEFAULT false;

