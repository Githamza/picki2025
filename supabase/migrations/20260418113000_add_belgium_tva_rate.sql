-- Extend supported product TVA rates to include Belgium's 12% rate

ALTER TABLE "public"."products"
DROP CONSTRAINT IF EXISTS "products_tva_rate_check";

ALTER TABLE "public"."products"
ADD CONSTRAINT "products_tva_rate_check"
CHECK (tva_rate IN (5.5, 10, 12, 20));

COMMENT ON COLUMN "public"."products"."tva_rate" IS
'Supported VAT rate: 5.5%, 10%, 12%, or 20% depending on the vendor country and product type';
