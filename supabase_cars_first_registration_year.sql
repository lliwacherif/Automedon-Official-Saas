-- =========================================================================
-- Migration : add "first_registration_year" to public.cars
-- Purpose   : Store the optional "année de mise en circulation"
--             (year of first registration) for each vehicle.
-- Safe to run multiple times (idempotent).
-- =========================================================================

-- 1. Add the column if it doesn't already exist
ALTER TABLE public.cars
    ADD COLUMN IF NOT EXISTS first_registration_year integer;

-- 2. Add a sensible sanity-check constraint (only once)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cars_first_registration_year_check'
    ) THEN
        ALTER TABLE public.cars
            ADD CONSTRAINT cars_first_registration_year_check
            CHECK (
                first_registration_year IS NULL
                OR (first_registration_year BETWEEN 1950 AND EXTRACT(YEAR FROM now())::int + 1)
            );
    END IF;
END $$;

-- 3. Document the column
COMMENT ON COLUMN public.cars.first_registration_year
    IS 'Year of first registration / Année de mise en circulation (optional)';

-- 4. Force PostgREST / Supabase API to reload the schema cache
--    so the new column is visible to the client immediately.
NOTIFY pgrst, 'reload schema';
