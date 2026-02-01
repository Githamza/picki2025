-- Add paygreen_onboarding_completed column to vendors table
-- This column tracks whether the vendor has completed PayGreen onboarding
-- Similar to stripe_onboarding_completed

ALTER TABLE "public"."vendors"
ADD COLUMN "paygreen_onboarding_completed" boolean DEFAULT false;

-- Add a comment to document the column
COMMENT ON COLUMN "public"."vendors"."paygreen_onboarding_completed" IS 'Indicates whether the vendor has completed PayGreen payment provider onboarding';
