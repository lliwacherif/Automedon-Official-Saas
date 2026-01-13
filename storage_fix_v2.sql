-- Force update the bucket to be public and unrestricted if it exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('car-images', 'car-images', true, 5242880, NULL)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = NULL;

-- Remove all existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Public can read car images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload car images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update car images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete car images" ON storage.objects;
DROP POLICY IF EXISTS "Give me access" ON storage.objects;

-- Re-create policies

-- 1. Allow Public Read Access (Essential for viewing images)
CREATE POLICY "Public can read car images"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-images');

-- 2. Allow Authenticated Users to Upload (INSERT)
CREATE POLICY "Authenticated users can upload car images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'car-images' AND auth.role() = 'authenticated');

-- 3. Allow Authenticated Users to Update (UPDATE)
CREATE POLICY "Authenticated users can update car images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'car-images' AND auth.role() = 'authenticated');

-- 4. Allow Authenticated Users to Delete (DELETE)
CREATE POLICY "Authenticated users can delete car images"
ON storage.objects FOR DELETE
USING (bucket_id = 'car-images' AND auth.role() = 'authenticated');
