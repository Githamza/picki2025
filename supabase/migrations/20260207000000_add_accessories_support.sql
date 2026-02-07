-- Add accessories support to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_accessory boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS applicable_order_types text[] DEFAULT ARRAY['eat-in', 'take-away', 'delivery'],
  ADD COLUMN IF NOT EXISTS icon_emoji text;

-- Partial index for fast accessory lookups per vendor
CREATE INDEX IF NOT EXISTS idx_products_accessories
  ON public.products(vendor_id, is_accessory)
  WHERE is_accessory = true AND is_available = true;
