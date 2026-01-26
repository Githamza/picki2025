-- Migration to add 'initiated' status to order_status enum
-- Run this in your Supabase SQL Editor

-- Add 'initiated' to the order_status enum
ALTER TYPE order_status ADD VALUE 'initiated';

-- Update any existing orders that might need the initiated status
-- (This is optional and depends on your business logic)
-- UPDATE orders SET status = 'initiated' WHERE status IS NULL;

-- Verify the enum values
-- You can run this to check that 'initiated' was added:
-- SELECT unnest(enum_range(NULL::order_status)) AS status_values; 