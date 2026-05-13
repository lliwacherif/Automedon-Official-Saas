-- ─────────────────────────────────────────────────────────────────────────────
-- Split faithful_clients.full_name into first_name + last_name
--
-- Both columns are nullable so existing rows keep working unchanged. The
-- application now stores nom (last_name) and prénom (first_name) separately
-- on creation and also keeps full_name in sync ("Prenom Nom") for backward
-- compatibility with autocomplete & search that still query full_name.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.faithful_clients
    ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE public.faithful_clients
    ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Phone is now optional in the Clients Fidèles form, so the DB constraint
-- must allow NULLs. This is a no-op if the column already permits NULL.
ALTER TABLE public.faithful_clients
    ALTER COLUMN phone DROP NOT NULL;

COMMENT ON COLUMN public.faithful_clients.first_name
    IS 'Prénom du client. Renseigné dans le formulaire Clients Fidèles.';

COMMENT ON COLUMN public.faithful_clients.last_name
    IS 'Nom du client. Renseigné dans le formulaire Clients Fidèles.';

-- Optional: back-fill the new columns from existing full_name values.
-- The naive split takes the first token as first_name and the rest as
-- last_name; leaves the row untouched if the source is empty.
UPDATE public.faithful_clients
SET
    first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
    last_name  = COALESCE(
        last_name,
        NULLIF(regexp_replace(full_name, '^\S+\s*', ''), '')
    )
WHERE full_name IS NOT NULL AND full_name <> '';
