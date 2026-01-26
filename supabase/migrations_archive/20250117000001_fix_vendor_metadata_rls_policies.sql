-- Fix RLS policies for vendor_metadata table to use correct user-vendor relationship
-- This migration updates the policies to use vendor_admin_users table instead of vendors.user_id

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "vendor_metadata_select_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_insert_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_update_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_delete_policy" ON vendor_metadata;

-- Ensure RLS is enabled on vendor_metadata table
ALTER TABLE vendor_metadata ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow SELECT for authenticated users
-- Users can only see metadata for vendors they have access to
CREATE POLICY "vendor_metadata_select_policy" ON vendor_metadata
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy 2: Allow INSERT for authenticated users
-- Users can only create metadata for vendors they have access to
CREATE POLICY "vendor_metadata_insert_policy" ON vendor_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy 3: Allow UPDATE for authenticated users
-- Users can only update metadata for vendors they have access to
CREATE POLICY "vendor_metadata_update_policy" ON vendor_metadata
  FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy 4: Allow DELETE for authenticated users
-- Users can only delete metadata for vendors they have access to
CREATE POLICY "vendor_metadata_delete_policy" ON vendor_metadata
  FOR DELETE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE vendor_metadata IS 'Vendor metadata with RLS policies ensuring users can only access their vendor data';
