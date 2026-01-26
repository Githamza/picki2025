-- Migration: Refactor product_step_options to use step_ids array and vendor_id
-- This eliminates duplication by allowing options to be assigned to multiple steps
-- Handles NULL product_id cases (component options)

-- Step 1: Add new columns
ALTER TABLE product_step_options 
ADD COLUMN step_ids INTEGER[],
ADD COLUMN vendor_id UUID;

-- Step 2: Populate the new columns
-- For options with product_id, get vendor from the product
-- For options without product_id (components), get vendor from the step's product
UPDATE product_step_options 
SET step_ids = ARRAY[step_id],
    vendor_id = COALESCE(
        p.vendor_id,  -- Use product vendor if product_id exists
        ps_p.vendor_id  -- Otherwise use step's product vendor
    )
FROM products p
FULL OUTER JOIN product_steps ps ON product_step_options.step_id = ps.id
FULL OUTER JOIN products ps_p ON ps.product_id = ps_p.id
WHERE product_step_options.product_id = p.id OR p.id IS NULL;

-- Step 3: Handle any remaining NULL vendor_ids (shouldn't happen, but safety check)
-- Get vendor from step's product for any remaining NULL cases
UPDATE product_step_options 
SET vendor_id = ps_p.vendor_id
FROM product_steps ps
JOIN products ps_p ON ps.product_id = ps_p.id
WHERE product_step_options.vendor_id IS NULL 
  AND product_step_options.step_id = ps.id;

-- Step 4: Make columns NOT NULL after population
ALTER TABLE product_step_options ALTER COLUMN step_ids SET NOT NULL;
ALTER TABLE product_step_options ALTER COLUMN vendor_id SET NOT NULL;

-- Step 5: Add foreign key constraint for vendor_id
ALTER TABLE product_step_options 
ADD CONSTRAINT fk_product_step_options_vendor 
FOREIGN KEY (vendor_id) REFERENCES vendors(id);

-- Step 6: Create a function to consolidate duplicate options
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
    GROUP BY vendor_id, product_id, name, price_adjustment, display_order, 
             is_available, image_url, option_type, description
    HAVING COUNT(*) > 1;  -- Only consolidate actual duplicates

    -- Update the kept records with consolidated step_ids
    FOR option_record IN 
        SELECT * FROM consolidated_options
    LOOP
        UPDATE product_step_options 
        SET step_ids = option_record.consolidated_step_ids,
            updated_at = option_record.updated_at
        WHERE id = option_record.keep_id;
        
        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        RAISE NOTICE 'Updated option ID % with % step_ids', option_record.keep_id, array_length(option_record.consolidated_step_ids, 1);
    END LOOP;

    -- Delete duplicate records (keep only the ones we updated)
    DELETE FROM product_step_options 
    WHERE id NOT IN (SELECT keep_id FROM consolidated_options)
      AND id IN (
          SELECT pso.id 
          FROM product_step_options pso
          JOIN consolidated_options co ON (
              pso.vendor_id = co.vendor_id AND
              COALESCE(pso.product_id, -1) = COALESCE(co.product_id, -1) AND
              pso.name = co.name AND
              COALESCE(pso.price_adjustment, 0) = COALESCE(co.price_adjustment, 0) AND
              COALESCE(pso.display_order, 0) = COALESCE(co.display_order, 0) AND
              COALESCE(pso.is_available, true) = COALESCE(co.is_available, true) AND
              COALESCE(pso.image_url, '') = COALESCE(co.image_url, '') AND
              COALESCE(pso.option_type, '') = COALESCE(co.option_type, '') AND
              COALESCE(pso.description, '') = COALESCE(co.description, '')
          )
      );

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate records', rows_affected;

    -- Drop the temporary table
    DROP TABLE consolidated_options;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Run the consolidation
SELECT consolidate_product_step_options();

-- Step 8: Drop the consolidation function (cleanup)
DROP FUNCTION consolidate_product_step_options();

-- Step 9: Remove the old step_id column
ALTER TABLE product_step_options DROP COLUMN step_id;

-- Step 10: Add indexes for performance
CREATE INDEX idx_product_step_options_step_ids ON product_step_options USING GIN (step_ids);
CREATE INDEX idx_product_step_options_vendor ON product_step_options (vendor_id);
CREATE INDEX idx_product_step_options_vendor_product ON product_step_options (vendor_id, product_id);

-- Step 11: Add a constraint to ensure step_ids array is not empty
ALTER TABLE product_step_options 
ADD CONSTRAINT check_step_ids_not_empty 
CHECK (array_length(step_ids, 1) > 0);

-- Step 12: Create a view for easier querying (optional)
CREATE OR REPLACE VIEW product_step_options_expanded AS
SELECT 
    pso.id,
    pso.vendor_id,
    pso.product_id,
    pso.name,
    pso.price_adjustment,
    pso.display_order,
    pso.is_available,
    pso.image_url,
    pso.option_type,
    pso.description,
    pso.step_ids,
    unnest(pso.step_ids) as step_id, -- Expanded for backward compatibility
    pso.created_at,
    pso.updated_at
FROM product_step_options pso;

COMMENT ON VIEW product_step_options_expanded IS 'Expanded view of product_step_options for backward compatibility queries'; 