-- Add separate Click & Collect pickup hours to business_hours table
ALTER TABLE "public"."business_hours"
  ADD COLUMN "pickup_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN "pickup_open_time" time without time zone,
  ADD COLUMN "pickup_close_time" time without time zone;
