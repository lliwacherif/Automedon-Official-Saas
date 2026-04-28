-- ============================================================
-- Car Papers — store URLs of administrative documents per car
-- ------------------------------------------------------------
-- Backs the "Papier" column on the Cars page (icon → modal),
-- the dedicated /admin/cars/:id/papers gallery page, and the
-- car-papers Supabase Storage bucket they live in.
--
-- Documents stored per car:
--   - carte_grise_url        → Carte Grise (vehicle registration)
--   - assurance_url          → Insurance certificate
--   - vignette_url           → Road tax sticker
--   - visite_technique_url   → Technical inspection certificate
--
-- All four columns are nullable text so a car can have any
-- subset of papers uploaded at any given time.
-- ============================================================

-- ── 1. Schema additions ──────────────────────────────────────
ALTER TABLE public.cars
    ADD COLUMN IF NOT EXISTS carte_grise_url       text,
    ADD COLUMN IF NOT EXISTS assurance_url         text,
    ADD COLUMN IF NOT EXISTS vignette_url          text,
    ADD COLUMN IF NOT EXISTS visite_technique_url  text;

-- ── 2. Storage bucket ────────────────────────────────────────
-- 15 MB upload cap (scanned papers can be larger than car photos),
-- mime types left unrestricted to allow images + PDFs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('car-papers', 'car-papers', true, 15728640, NULL)
ON CONFLICT (id) DO UPDATE
    SET public           = true,
        file_size_limit  = 15728640,
        allowed_mime_types = NULL;

-- ── 3. Anonymous-access policies ─────────────────────────────
-- The app uses custom auth (no Supabase Auth session), so we
-- mirror the same anon-friendly policies used by car-images.
DROP POLICY IF EXISTS "Public read car papers"   ON storage.objects;
DROP POLICY IF EXISTS "Public upload car papers" ON storage.objects;
DROP POLICY IF EXISTS "Public update car papers" ON storage.objects;
DROP POLICY IF EXISTS "Public delete car papers" ON storage.objects;

CREATE POLICY "Public read car papers"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'car-papers');

CREATE POLICY "Public upload car papers"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'car-papers');

CREATE POLICY "Public update car papers"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'car-papers');

CREATE POLICY "Public delete car papers"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'car-papers');

-- ── 4. Grants ────────────────────────────────────────────────
-- (No-op if the previous storage migration already ran, but
-- keeping the script self-contained.)
GRANT USAGE ON SCHEMA storage TO anon;
GRANT ALL   ON TABLE  storage.objects TO anon;
GRANT ALL   ON TABLE  storage.buckets TO anon;
