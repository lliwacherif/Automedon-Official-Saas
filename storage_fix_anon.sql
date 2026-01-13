-- CRITICAL FIX: The app uses custom auth (not Supabase Auth), so we must allow ANONYMOUS access.

-- Force update bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('car-images', 'car-images', true, 5242880, NULL)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = NULL;

-- Remove old "Authenticated" policies
DROP POLICY IF EXISTS "Public can read car images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload car images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update car images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete car images" ON storage.objects;
DROP POLICY IF EXISTS "Give me access" ON storage.objects;

-- Create "Public/Anonymous" policies

-- 1. Everyone can read (already public, but good to be explicit)
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-images');

-- 2. Everyone (Anonymous) can Upload
-- Since your app manages "Admin" state locally, Supabase sees you as "anon".
CREATE POLICY "Public Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'car-images');

-- 3. Everyone (Anonymous) can Update
CREATE POLICY "Public Update Access"
ON storage.objects FOR UPDATE
USING (bucket_id = 'car-images');

-- 4. Everyone (Anonymous) can Delete
CREATE POLICY "Public Delete Access"
ON storage.objects FOR DELETE
USING (bucket_id = 'car-images');

-- Grant permissions to the 'anon' role
GRANT USAGE ON SCHEMA storage TO anon;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.buckets TO anon;
