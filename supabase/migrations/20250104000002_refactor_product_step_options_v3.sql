-- Migration: Refactor product_step_options to use step_ids array and vendor_id
-- This eliminates duplication by allowing options to be assigned to multiple steps
-- Handles NULL product_id cases (component options)

-- Step 1: Add new columns
ALTER TABLE product_step_options 
ADD COLUMN step_ids INTEGER[],
ADD COLUMN vendor_id UUID;

-- Step 2: First, populate step_ids with current step_id
UPDATE product_step_options 
SET step_ids = ARRAY[step_id];

-- Step 3: Populate vendor_id for options that have a product_id
UPDATE product_step_options 
SET vendor_id = p.vendor_id
FROM products p 
WHERE product_step_options.product_id = p.id;

-- Step 4: Populate vendor_id for options that DON'T have a product_id (component options)
-- Get vendor from the step's product
UPDATE product_step_options 
SET vendor_id = p.vendor_id
FROM product_steps ps
JOIN products p ON ps.product_id = p.id
WHERE product_step_options.vendor_id IS NULL 
  AND product_step_options.step_id = ps.id;

-- Step 5: Make columns NOT NULL after population
ALTER TABLE product_step_options ALTER COLUMN step_ids SET NOT NULL;
ALTER TABLE product_step_options ALTER COLUMN vendor_id SET NOT NULL;

-- Step 6: Add foreign key constraint for vendor_id
ALTER TABLE product_step_options 
ADD CONSTRAINT fk_product_step_options_vendor 
FOREIGN KEY (vendor_id) REFERENCES vendors(id);

-- Step 7: Create a function to consolidate duplicate options
CREATE OR REPLACE FUNCTION consolidate_product_step_options()
RETURNS void AS $$
DECLARE
    option_record RECORD;
    rows_affected INTEGER;
BEGIN
    -- Create a temporary table to store consolidated data
    CREATE TEMP TABLE consolidated_options AS
    SELECT 
        MIN(id) as keep_id,
        vendor_id,
        product_id,
        name,
        price_adjustment,
        display_order,
        is_available,
        image_url,
        option_type,
        description,
        ARRAY_AGG(DISTINCT step_id ORDER BY step_id) as consolidated_step_ids,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at,
        COUNT(*) as duplicate_count
    FROM product_step_options
    WHERE step_ids IS NOT NULL  -- Only process records with step_ids
    GROUP BY vendor_id, product_id, name, price_adjustment, display_order, 
             is_available, image_url, option_type, description
    HAVING COUNT(*) > 1;  -- Only consolidate actual duplicates

    -- Log how many duplicates we found
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RAISE NOTICE 'Found % groups of duplicate options to consolidate', rows_affected;

    -- Update the kept records with consolidated step_ids
    FOR option_record IN 
        SELECT * FROM consolidated_options
    LOOP
        UPDATE product_step_options 
        SET step_ids = option_record.consolidated_step_ids,
            updated_at = option_record.updated_at
        WHERE id = option_record.keep_id;
        
        RAISE NOTICE 'Updated option ID % (%) with % step_ids: %', 
                     option_record.keep_id, 
                     option_record.name,
                     array_length(option_record.consolidated_step_ids, 1),
                     option_record.consolidated_step_ids;
    END LOOP;

    -- Delete duplicate records (keep only the ones we updated)
    DELETE FROM product_step_options 
    WHERE id NOT IN (SELECT keep_id FROM consolidated_options)
      AND (vendor_id, COALESCE(product_id, -1), name, COALESCE(price_adjustment, 0), 
           COALESCE(display_order, 0), COALESCE(is_available, true), 
           COALESCE(image_url, ''), COALESCE(option_type, ''), COALESCE(description, '')) 
      IN (
          SELECT vendor_id, COALESCE(product_id, -1), name, COALESCE(price_adjustment, 0),
                 COALESCE(display_order, 0), COALESCE(is_available, true),
                 COALESCE(image_url, ''), COALESCE(option_type, ''), COALESCE(description, '')
          FROM consolidated_options
      );

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate records', rows_affected;

    -- Drop the temporary table
    DROP TABLE consolidated_options;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Run the consolidation
SELECT consolidate_product_step_options();

-- Step 9: Drop the consolidation function (cleanup)
DROP FUNCTION consolidate_product_step_options();

-- Step 10: Remove the old step_id column
ALTER TABLE product_step_options DROP COLUMN step_id;

-- Step 11: Add indexes for performance
CREATE INDEX idx_product_step_options_step_ids ON product_step_options USING GIN (step_ids);
CREATE INDEX idx_product_step_options_vendor ON product_step_options (vendor_id);
CREATE INDEX idx_product_step_options_vendor_product ON product_step_options (vendor_id, product_id);

-- Step 12: Add a constraint to ensure step_ids array is not empty
ALTER TABLE product_step_options 
ADD CONSTRAINT check_step_ids_not_empty 
CHECK (array_length(step_ids, 1) > 0);

-- Migration complete - existing product_step_options table has been updated with:
-- - step_ids array instead of single step_id
-- - vendor_id for vendor isolation
-- - consolidated duplicate records
-- - performance indexes 