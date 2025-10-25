-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('productsophotos', 'productsophotos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to view/download images (public read)
CREATE POLICY "Allow public read access on productsophotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'productsophotos');

-- Policy: Allow anyone to upload images (public write)
-- Note: In production, you might want to restrict this to authenticated users
CREATE POLICY "Allow public upload to productsophotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'productsophotos');

-- Policy: Allow anyone to update images (public update)
CREATE POLICY "Allow public update on productsophotos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'productsophotos')
WITH CHECK (bucket_id = 'productsophotos');

-- Policy: Allow anyone to delete images (public delete)
CREATE POLICY "Allow public delete on productsophotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'productsophotos');

-- Optional: Create policies for authenticated users only (more secure)
-- Uncomment these and comment the above policies if you want to restrict to authenticated users

-- CREATE POLICY "Allow authenticated upload to productsophotos"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'productsophotos');

-- CREATE POLICY "Allow authenticated update on productsophotos"
-- ON storage.objects FOR UPDATE
-- TO authenticated
-- USING (bucket_id = 'productsophotos')
-- WITH CHECK (bucket_id = 'productsophotos');

-- CREATE POLICY "Allow authenticated delete on productsophotos"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING (bucket_id = 'productsophotos'); 