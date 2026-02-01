-- Add INSERT, UPDATE, DELETE policies for banners table
-- Authenticated users can manage banners for their vendor

-- Policy: Authenticated users can insert banners
CREATE POLICY "Authenticated users can insert banners"
ON public.banners
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update banners
CREATE POLICY "Authenticated users can update banners"
ON public.banners
FOR UPDATE
TO authenticated
USING (true);

-- Policy: Authenticated users can delete banners
CREATE POLICY "Authenticated users can delete banners"
ON public.banners
FOR DELETE
TO authenticated
USING (true);
