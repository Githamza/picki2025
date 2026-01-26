-- Add logo_url field to vendors table
ALTER TABLE vendors ADD COLUMN logo_url TEXT;

-- Add a comment to the column
COMMENT ON COLUMN vendors.logo_url IS 'URL to the vendor/restaurant logo image'; 