-- ============================================================
-- Faithful client documents — up to 2 personal papers per client
-- ------------------------------------------------------------
-- Backs the "Documents" feature inside the Clients Fidèles
-- section of Admin Settings: the user can attach up to two
-- pictures (CIN, permit, etc.) to each faithful client and
-- view them later from the "Clients récents" list.
--
-- - Adds a text[] column to public.faithful_clients defaulting
--   to an empty array, capped at 2 entries by a CHECK.
-- - Provisions a public client-papers storage bucket with the
--   same anon-friendly policies used by car-images and
--   car-papers (no impact on existing buckets / policies).
-- ============================================================

-- ── 1. Schema addition ───────────────────────────────────────
ALTER TABLE public.faithful_clients
    ADD COLUMN IF NOT EXISTS documents text[]
        DEFAULT ARRAY[]::text[];

-- Cardinality cap (enforced at DB level so the app cannot
-- accidentally store more than 2 URLs per client).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'faithful_clients_documents_max_two'
    ) THEN
        ALTER TABLE public.faithful_clients
            ADD CONSTRAINT faithful_clients_documents_max_two
            CHECK (documents IS NULL OR cardinality(documents) <= 2);
    END IF;
END$$;

-- ── 2. Storage bucket ────────────────────────────────────────
-- 15 MB upload cap, mime types unrestricted (image + PDF).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-papers', 'client-papers', true, 15728640, NULL)
ON CONFLICT (id) DO UPDATE
    SET public           = true,
        file_size_limit  = 15728640,
        allowed_mime_types = NULL;

-- ── 3. Anonymous-access policies ─────────────────────────────
DROP POLICY IF EXISTS "Public read client papers"   ON storage.objects;
DROP POLICY IF EXISTS "Public upload client papers" ON storage.objects;
DROP POLICY IF EXISTS "Public update client papers" ON storage.objects;
DROP POLICY IF EXISTS "Public delete client papers" ON storage.objects;

CREATE POLICY "Public read client papers"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'client-papers');

CREATE POLICY "Public upload client papers"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'client-papers');

CREATE POLICY "Public update client papers"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'client-papers');

CREATE POLICY "Public delete client papers"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'client-papers');

-- ── 4. Grants (no-op if already granted by previous migrations) ──
GRANT USAGE ON SCHEMA storage TO anon;
GRANT ALL   ON TABLE  storage.objects TO anon;
GRANT ALL   ON TABLE  storage.buckets TO anon;
