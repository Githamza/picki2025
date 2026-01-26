-- Add vendor custom domain support
-- Allows mapping incoming hostnames (e.g. granola.fr) to a vendor without /vendor/:vendorSlug

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS "customDomain" text;

-- Ensure domains are unique (case-insensitive) when set
CREATE UNIQUE INDEX IF NOT EXISTS vendors_custom_domain_unique
  ON public.vendors (lower("customDomain"))
  WHERE "customDomain" IS NOT NULL;







