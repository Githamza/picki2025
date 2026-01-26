-- Create vendor admin users table
-- This table stores admin credentials specific to each vendor

-- Create table for vendor admin users
CREATE TABLE vendor_admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin', -- admin, manager, staff
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  
  -- Ensure unique email per vendor
  CONSTRAINT unique_vendor_email UNIQUE (vendor_id, email)
);

-- Create indexes for performance
CREATE INDEX idx_vendor_admin_users_vendor_id ON vendor_admin_users(vendor_id);
CREATE INDEX idx_vendor_admin_users_email ON vendor_admin_users(email);
CREATE INDEX idx_vendor_admin_users_active ON vendor_admin_users(is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vendor_admin_users_updated_at 
  BEFORE UPDATE ON vendor_admin_users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE vendor_admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can only see users from their own vendor
CREATE POLICY "Admins can only access their vendor users" ON vendor_admin_users
  FOR ALL USING (
    vendor_id = (
      SELECT vendor_id 
      FROM vendor_admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Allow authentication check
CREATE POLICY "Allow authentication" ON vendor_admin_users
  FOR SELECT USING (true);

-- Add some default admin users for existing vendors (optional)
-- This is commented out - you can uncomment and modify as needed
/*
INSERT INTO vendor_admin_users (vendor_id, email, password_hash, first_name, last_name, role)
SELECT 
  id as vendor_id,
  'admin@' || LOWER(REPLACE(business_name, ' ', '')) || '.com' as email,
  '$2a$10$dummy.hash.replace.with.real.hash' as password_hash,
  'Admin' as first_name,
  business_name as last_name,
  'admin' as role
FROM vendors 
WHERE is_active = true;
*/

-- Comments for documentation
COMMENT ON TABLE vendor_admin_users IS 'Stores admin user credentials for each vendor';
COMMENT ON COLUMN vendor_admin_users.vendor_id IS 'Reference to the vendor this admin user belongs to';
COMMENT ON COLUMN vendor_admin_users.email IS 'Admin user email address (unique per vendor)';
COMMENT ON COLUMN vendor_admin_users.password_hash IS 'Hashed password for authentication';
COMMENT ON COLUMN vendor_admin_users.role IS 'User role: admin, manager, or staff';
COMMENT ON COLUMN vendor_admin_users.is_active IS 'Whether the admin user account is active';
COMMENT ON COLUMN vendor_admin_users.last_login_at IS 'Timestamp of last successful login'; 