-- Fix vendors RLS policy to allow public access for vendor selection
-- This allows unauthenticated users to see vendors for selection purposes

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view associated vendors" ON vendors;

-- Create a new policy that allows public read access to active vendors
-- This is needed for vendor selection before authentication
CREATE POLICY "Public can view active vendors" ON vendors
  FOR SELECT USING (is_active = true);

-- Keep the update policy for authenticated users only
CREATE POLICY "Users can update associated vendors" ON vendors
  FOR UPDATE USING (
    id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE user_id = auth.uid()
    )
  );

-- Add a policy for insert (only admins)
CREATE POLICY "Admins can create vendors" ON vendors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );
