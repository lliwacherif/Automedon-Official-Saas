-- ─────────────────────────────────────────────────────────────────────────────
-- Add Toyota, Haval and Citroen to the allowed car brands.
--
-- Run once in the Supabase SQL editor. Existing rows are not touched; the
-- updated CHECK constraint only affects future INSERT / UPDATE operations.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.cars
    DROP CONSTRAINT IF EXISTS cars_brand_check;

ALTER TABLE public.cars
    ADD CONSTRAINT cars_brand_check
    CHECK (brand = ANY (ARRAY[
        'Renault'::text,
        'Dacia'::text,
        'Skoda'::text,
        'Hyundai'::text,
        'Seat'::text,
        'MG'::text,
        'Mahindra'::text,
        'Kia'::text,
        'Honda'::text,
        'Peugeot'::text,
        'Cherry'::text,
        'Geely'::text,
        'Volkswagen'::text,
        'Suzuki'::text,
        'Chevrolet'::text,
        'Fiat'::text,
        'Toyota'::text,
        'Haval'::text,
        'Citroen'::text
    ]));

COMMIT;
