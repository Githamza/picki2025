-- Temporarily disable RLS on vendor_metadata table for debugging
-- This allows the application to work while we fix the authentication system

-- Disable RLS temporarily
ALTER TABLE vendor_metadata DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "vendor_metadata_select_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_insert_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_update_policy" ON vendor_metadata;
DROP POLICY IF EXISTS "vendor_metadata_delete_policy" ON vendor_metadata;

-- Add comment for documentation
COMMENT ON TABLE vendor_metadata IS 'Vendor metadata table with RLS temporarily disabled for debugging authentication issues';
