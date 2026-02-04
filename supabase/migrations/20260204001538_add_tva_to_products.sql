-- Add tva_rate column to products table
-- French VAT rates: 5.5% (reduced), 10% (food service), 20% (standard)
-- Default is 10% which is the standard rate for restaurant food

ALTER TABLE "public"."products"
ADD COLUMN "tva_rate" numeric(4,2) DEFAULT 10.00 NOT NULL;

-- Add constraint to ensure valid French VAT rates
ALTER TABLE "public"."products"
ADD CONSTRAINT "products_tva_rate_check"
CHECK (tva_rate IN (5.5, 10, 20));

COMMENT ON COLUMN "public"."products"."tva_rate" IS
'French VAT rate: 5.5% (reduced), 10% (food service), or 20% (standard)';
