ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS max_quantity_per_order integer DEFAULT NULL;
