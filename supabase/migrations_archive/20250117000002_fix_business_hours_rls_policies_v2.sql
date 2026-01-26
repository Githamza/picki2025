-- Fix RLS policies for business_hours table - Version 2
-- This migration creates more permissive policies for testing and debugging

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "business_hours_select_policy" ON business_hours;
DROP POLICY IF EXISTS "business_hours_insert_policy" ON business_hours;
DROP POLICY IF EXISTS "business_hours_update_policy" ON business_hours;
DROP POLICY IF EXISTS "business_hours_delete_policy" ON business_hours;

-- Ensure RLS is enabled on business_hours table
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow SELECT for authenticated users
-- Users can see business hours for vendors they have access to
CREATE POLICY "business_hours_select_policy" ON business_hours
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy 2: Allow SELECT for service role (for debugging)
-- This allows service role to bypass RLS for debugging
CREATE POLICY "business_hours_service_select_policy" ON business_hours
  FOR SELECT
  TO service_role
  USING (true);

-- Policy 3: Allow INSERT for authenticated users
-- Users can create business hours for vendors they have access to
CREATE POLICY "business_hours_insert_policy" ON business_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy 4: Allow INSERT for service role
CREATE POLICY "business_hours_service_insert_policy" ON business_hours
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy 5: Allow UPDATE for authenticated users
-- Users can update business hours for vendors they have access to
CREATE POLICY "business_hours_update_policy" ON business_hours
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

-- Policy 6: Allow UPDATE for service role
CREATE POLICY "business_hours_service_update_policy" ON business_hours
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 7: Allow DELETE for authenticated users
-- Users can delete business hours for vendors they have access to
CREATE POLICY "business_hours_delete_policy" ON business_hours
  FOR DELETE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy 8: Allow DELETE for service role
CREATE POLICY "business_hours_service_delete_policy" ON business_hours
  FOR DELETE
  TO service_role
  USING (true);

-- Add comment for documentation
COMMENT ON TABLE business_hours IS 'Business hours for each vendor, with RLS policies ensuring vendors can only access their own data';
