-- Add anon access to vendor-assets bucket for uploads (since SupabaseService uses anon client)

-- Drop existing policies and recreate with anon access
DROP POLICY IF EXISTS "Authenticated users can upload vendor assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update vendor assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete vendor assets" ON storage.objects;

-- Policy: Allow anon and authenticated users to upload files
CREATE POLICY "Anyone can upload vendor assets"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'vendor-assets');

-- Policy: Allow anon and authenticated users to update files
CREATE POLICY "Anyone can update vendor assets"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'vendor-assets');

-- Policy: Allow anon and authenticated users to delete files
CREATE POLICY "Anyone can delete vendor assets"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'vendor-assets');
