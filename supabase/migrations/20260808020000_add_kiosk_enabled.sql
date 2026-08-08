-- Migration: Add self-ordering kiosk mode setting (SPEC.md FR4, T29)
-- Description: Vendor-level switch that activates the kiosk experience on the
-- storefront (attract screen, idle session reset, XL touch UI, forced
-- pay-at-counter). The storefront only applies kiosk behavior on landscape
-- form factors, so a kiosk-enabled vendor's phone customers keep the normal
-- flow. Readable by the anonymous storefront role through the existing
-- "Public can view active vendors" select policy (no policy change needed).

ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS kiosk_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN vendors.kiosk_enabled IS
  'When true, the storefront runs the self-ordering kiosk experience (attract screen, idle reset, pay-at-counter) on landscape devices. Defaults to false so existing vendors are unaffected.';
