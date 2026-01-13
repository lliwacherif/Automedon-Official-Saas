-- Create 'contracts' bucket for reservation documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contracts', 'contracts', true, 5242880, NULL)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = NULL;

-- Remove old policies
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access" ON storage.objects;

-- Create "Public/Anonymous" policies for 'contracts' bucket
-- Note: Re-creating policies generic to all public buckets or specific to 'contracts'

-- 1. Everyone can read
CREATE POLICY "Public Read Access Contracts"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts');

-- 2. Everyone (Anonymous) can Upload
CREATE POLICY "Public Upload Access Contracts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts');

-- 3. Everyone (Anonymous) can Update
CREATE POLICY "Public Update Access Contracts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'contracts');

-- 4. Everyone (Anonymous) can Delete
CREATE POLICY "Public Delete Access Contracts"
ON storage.objects FOR DELETE
USING (bucket_id = 'contracts');

-- Ensure 'anon' usage
GRANT USAGE ON SCHEMA storage TO anon;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.buckets TO anon;
