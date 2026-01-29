-- Migration: Add daily stock reset feature
-- Description: Adds vendor setting to automatically reset product stocks to NULL daily at midnight

-- Step 1: Add vendor setting column (default TRUE as requested)
ALTER TABLE vendors
ADD COLUMN daily_stock_reset_enabled boolean DEFAULT true;

-- Step 2: Create the reset function
CREATE OR REPLACE FUNCTION reset_daily_product_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE products
    SET stock_quantity = NULL,
        updated_at = NOW()
    WHERE vendor_id IN (
        SELECT id FROM vendors
        WHERE daily_stock_reset_enabled = TRUE
          AND is_active = TRUE
    );

    RAISE NOTICE 'Daily stock reset completed at %', NOW();
END;
$$;

-- Step 3: Enable pg_cron extension (requires Supabase Pro plan)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 4: Schedule job to run at midnight UTC daily
SELECT cron.schedule(
    'daily-stock-reset',
    '0 0 * * *',
    'SELECT reset_daily_product_stock()'
);

-- Add comment for documentation
COMMENT ON COLUMN vendors.daily_stock_reset_enabled IS 'When true, product stocks are reset to NULL (unlimited) daily at midnight UTC';
COMMENT ON FUNCTION reset_daily_product_stock() IS 'Resets stock_quantity to NULL for all products belonging to vendors with daily_stock_reset_enabled = true';
