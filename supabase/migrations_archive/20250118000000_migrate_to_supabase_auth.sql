-- Migration: Migrate to Supabase Auth
-- This migration modifies the vendor_admin_users table to work with Supabase Auth

-- 1. Add user_id column to link with auth.users
ALTER TABLE vendor_admin_users 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Remove password_hash column (Supabase Auth handles this)
ALTER TABLE vendor_admin_users 
DROP COLUMN password_hash;

-- 3. Add unique constraint on user_id
ALTER TABLE vendor_admin_users 
ADD CONSTRAINT vendor_admin_users_user_id_unique UNIQUE (user_id);

-- 4. Update vendors table to use auth.users instead of custom user_id
-- First, add the new column
ALTER TABLE vendors 
ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. Create RLS policies for vendor_admin_users
ALTER TABLE vendor_admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own admin user record
CREATE POLICY "Users can view own admin record" ON vendor_admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own admin record
CREATE POLICY "Users can update own admin record" ON vendor_admin_users
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Only admins can create admin users
CREATE POLICY "Admins can create admin users" ON vendor_admin_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 6. Create RLS policies for vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view vendors they have admin access to
CREATE POLICY "Users can view associated vendors" ON vendors
  FOR SELECT USING (
    id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update vendors they have admin access to
CREATE POLICY "Users can update associated vendors" ON vendors
  FOR UPDATE USING (
    id IN (
      SELECT vendor_id FROM vendor_admin_users 
      WHERE user_id = auth.uid()
    )
  );

-- 7. Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This function will be called when a new user signs up
  -- We'll create the vendor_admin_users record here
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Add indexes for better performance
CREATE INDEX idx_vendor_admin_users_user_id ON vendor_admin_users(user_id);
CREATE INDEX idx_vendor_admin_users_vendor_id ON vendor_admin_users(vendor_id);
CREATE INDEX idx_vendors_auth_user_id ON vendors(auth_user_id);

-- 10. Add comments for documentation
COMMENT ON COLUMN vendor_admin_users.user_id IS 'References auth.users.id - Supabase Auth user ID';
COMMENT ON COLUMN vendors.auth_user_id IS 'References auth.users.id - Primary auth user for this vendor';
COMMENT ON TABLE vendor_admin_users IS 'Admin users linked to Supabase Auth system';
