-- Migration: Qonto payment terminal on kiosk (SPEC-QONTO-TERMINAL.md, T1)
-- Description: Per-vendor Qonto OAuth connection (tokens are service-role-only:
-- RLS enabled with zero policies, same isolation approach as vendor_private_info),
-- vendor-level terminal binding + activation toggle, and terminal-payment
-- reconciliation columns on orders. The vendor columns are readable by the
-- anonymous storefront role through the existing "Public can view active
-- vendors" select policy (no policy change needed); a terminal UUID is not a
-- secret and is unusable without the OAuth tokens.

-- 1. Qonto connection: one per vendor, tokens never leave edge functions.
CREATE TABLE IF NOT EXISTS public.vendor_qonto_connections (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  organization_id text,
  access_token text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  refresh_token text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_qonto_connections ENABLE ROW LEVEL SECURITY;
-- Deliberately NO policies: neither anon nor authenticated may read tokens.
-- Only the service role (edge functions) can touch this table.

COMMENT ON TABLE public.vendor_qonto_connections IS
  'Qonto OAuth tokens per vendor. Service-role-only (RLS enabled, zero policies). Refresh tokens are one-time use: refresh must be serialized with SELECT ... FOR UPDATE.';

-- 2. Vendor settings: terminal binding + activation toggle.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS kiosk_terminal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kiosk_terminal_id text,
  ADD COLUMN IF NOT EXISTS kiosk_terminal_label text;

COMMENT ON COLUMN public.vendors.kiosk_terminal_enabled IS
  'When true (and a Qonto connection + terminal exist), kiosk orders require card payment on the Qonto terminal before printing. Defaults to false: pay-at-counter flow unchanged.';
COMMENT ON COLUMN public.vendors.kiosk_terminal_id IS
  'Qonto terminal UUID pushed to by the kiosk. Selected in admin Paiement settings.';
COMMENT ON COLUMN public.vendors.kiosk_terminal_label IS
  'Human-readable terminal label (Adyen poi_id) shown in admin settings.';

-- 3. Order <-> terminal payment reconciliation (written only by edge functions).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS terminal_payment_id text,
  ADD COLUMN IF NOT EXISTS terminal_payment_method text,
  ADD COLUMN IF NOT EXISTS terminal_card_summary text;

COMMENT ON COLUMN public.orders.terminal_payment_id IS
  'Qonto terminal_payment UUID for the latest payment attempt on this order.';
COMMENT ON COLUMN public.orders.terminal_payment_method IS
  'Card scheme reported by Qonto on authorization (visa, cartebancaire, ...).';
COMMENT ON COLUMN public.orders.terminal_card_summary IS
  'Last 4 digits of the card reported by Qonto on authorization.';
