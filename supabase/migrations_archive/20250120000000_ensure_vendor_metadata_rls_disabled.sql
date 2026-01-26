-- Ensure RLS is disabled on vendor_metadata table
-- This migration ensures that vendor metadata operations work without RLS restrictions

-- Disable RLS on vendor_metadata table
ALTER TABLE vendor_metadata DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to ensure clean state
DROP POLICY IF EXISTS "vendor_metadata_select_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_insert_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_update_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_delete_policy" ON vendor_metadata;

-- Add comment for documentation
COMMENT ON TABLE vendor_metadata IS 'Vendor metadata table with RLS disabled for application functionality';
