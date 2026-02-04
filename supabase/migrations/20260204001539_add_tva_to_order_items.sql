-- Add tva_rate column to order_items table
-- This stores the TVA rate at the time of purchase for historical accuracy
-- Similar to how unit_price is stored to preserve the price at order time

ALTER TABLE "public"."order_items"
ADD COLUMN "tva_rate" numeric(4,2) DEFAULT 10.00 NOT NULL;

COMMENT ON COLUMN "public"."order_items"."tva_rate" IS
'VAT rate at the time of purchase, stored for historical accuracy';
