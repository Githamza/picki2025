-- Fix RLS policies for business_hours table
-- This migration ensures that vendors can create, read, update, and delete their business hours

-- First, ensure RLS is enabled on business_hours table
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "business_hours_select_policy" ON business_hours;
DROP POLICY IF EXISTS "business_hours_insert_policy" ON business_hours;
DROP POLICY IF EXISTS "business_hours_update_policy" ON business_hours;
DROP POLICY IF EXISTS "business_hours_delete_policy" ON business_hours;

-- Policy 1: Allow SELECT for authenticated users
-- Users can only see business hours for vendors they have access to
CREATE POLICY "business_hours_select_policy" ON business_hours
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy 2: Allow INSERT for authenticated users
-- Users can only create business hours for vendors they have access to
CREATE POLICY "business_hours_insert_policy" ON business_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy 3: Allow UPDATE for authenticated users
-- Users can only update business hours for vendors they have access to
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

-- Policy 4: Allow DELETE for authenticated users
-- Users can only delete business hours for vendors they have access to
CREATE POLICY "business_hours_delete_policy" ON business_hours
  FOR DELETE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE business_hours IS 'Business hours for each vendor, with RLS policies ensuring vendors can only access their own data';
