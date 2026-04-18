-- Allow marketplace vendors to have no public_key
ALTER TABLE vendor_paygreen_credentials ALTER COLUMN public_key DROP NOT NULL;

-- Add SIRET/national_id for PayGreen marketplace registration
ALTER TABLE vendors ADD COLUMN national_id text;
