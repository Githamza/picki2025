-- Add unique constraint to business_hours table for upsert functionality
-- This ensures that each vendor can only have one business hours record per day of the week

-- Add unique constraint on vendor_id and day_of_week
ALTER TABLE business_hours 
ADD CONSTRAINT unique_vendor_day_of_week 
UNIQUE (vendor_id, day_of_week);

-- Create index for better performance on the unique constraint
CREATE INDEX IF NOT EXISTS idx_business_hours_vendor_day 
ON business_hours(vendor_id, day_of_week);
