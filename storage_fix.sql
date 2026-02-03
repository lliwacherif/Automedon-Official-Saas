-- Helper to create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('car-images', 'car-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public Read Access
DROP POLICY IF EXISTS "Public can read car images" ON storage.objects;
CREATE POLICY "Public can read car images"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-images');

-- Policy: Authenticated Upload
DROP POLICY IF EXISTS "Authenticated users can upload car images" ON storage.objects;
CREATE POLICY "Authenticated users can upload car images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'car-images' AND auth.role() = 'authenticated');

-- Policy: Authenticated Update
DROP POLICY IF EXISTS "Authenticated users can update car images" ON storage.objects;
CREATE POLICY "Authenticated users can update car images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'car-images' AND auth.role() = 'authenticated');

-- Policy: Authenticated Delete
DROP POLICY IF EXISTS "Authenticated users can delete car images" ON storage.objects;
CREATE POLICY "Authenticated users can delete car images"
ON storage.objects FOR DELETE
USING (bucket_id = 'car-images' AND auth.role() = 'authenticated');
