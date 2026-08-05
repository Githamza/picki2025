-- Migration: Add automatic ticket printing setting
-- Description: Vendor-level switch for printing incoming orders on a Bluetooth
-- thermal printer from the Android tablet app. The printer itself is configured
-- per device (Capacitor Preferences); this flag decides whether the vendor
-- wants automatic printing at all.

ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS auto_print_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN vendors.auto_print_enabled IS
  'When true, the Android tablet app automatically prints a ticket for each incoming order on the paired Bluetooth thermal printer. Defaults to false so existing vendors are unaffected.';
