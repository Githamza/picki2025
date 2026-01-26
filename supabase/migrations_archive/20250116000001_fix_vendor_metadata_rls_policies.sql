-- Fix RLS policies for vendor_metadata table
-- This migration ensures that vendor metadata can be created and accessed properly

-- First, check if RLS is enabled and what policies exist
-- (This is for reference - the actual policies will be created below)

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "vendor_metadata_select_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_insert_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_update_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_delete_policy" ON vendor_metadata;

-- Ensure RLS is enabled on vendor_metadata table
ALTER TABLE vendor_metadata ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow SELECT for authenticated users
-- Users can only see metadata for vendors they own
CREATE POLICY "vendor_metadata_select_policy" ON vendor_metadata
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Allow INSERT for authenticated users
-- Users can only create metadata for vendors they own
CREATE POLICY "vendor_metadata_insert_policy" ON vendor_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 3: Allow UPDATE for authenticated users
-- Users can only update metadata for vendors they own
CREATE POLICY "vendor_metadata_update_policy" ON vendor_metadata
  FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 4: Allow DELETE for authenticated users
-- Users can only delete metadata for vendors they own
CREATE POLICY "vendor_metadata_delete_policy" ON vendor_metadata
  FOR DELETE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors 
      WHERE user_id = auth.uid()
    )
  );

-- Alternative: If you want more restrictive policies based on vendor ownership
-- Uncomment the following policies and comment out the above ones:

-- CREATE POLICY "vendor_metadata_select_by_vendor" ON vendor_metadata
--   FOR SELECT
--   TO authenticated
--   USING (
--     vendor_id IN (
--       SELECT id FROM vendors 
--       WHERE user_id = auth.uid()
--     )
--   );

-- CREATE POLICY "vendor_metadata_insert_by_vendor" ON vendor_metadata
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     vendor_id IN (
--       SELECT id FROM vendors 
--       WHERE user_id = auth.uid()
--     )
--   );

-- CREATE POLICY "vendor_metadata_update_by_vendor" ON vendor_metadata
--   FOR UPDATE
--   TO authenticated
--   USING (
--     vendor_id IN (
--       SELECT id FROM vendors 
--       WHERE user_id = auth.uid()
--     )
--   )
--   WITH CHECK (
--     vendor_id IN (
--       SELECT id FROM vendors 
--       WHERE user_id = auth.uid()
--     )
--   );

-- CREATE POLICY "vendor_metadata_delete_by_vendor" ON vendor_metadata
--   FOR DELETE
--   TO authenticated
--   USING (
--     vendor_id IN (
--       SELECT id FROM vendors 
--       WHERE user_id = auth.uid()
--     )
--   );
