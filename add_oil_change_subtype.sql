-- ─────────────────────────────────────────────────────────────────────────────
-- Vidange (OIL_CHANGE) — sub-type + structured details
--
-- Lets the admin distinguish between a Simple vidange (huile + filtre huile
-- optionnel) and a Vidange Complète (full service avec inspection).
-- All columns are nullable so existing rows stay untouched.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.maintenance_records
    ADD COLUMN IF NOT EXISTS oil_change_subtype text
        CHECK (oil_change_subtype IN ('simple', 'complete'));

ALTER TABLE public.maintenance_records
    ADD COLUMN IF NOT EXISTS oil_brand text;

ALTER TABLE public.maintenance_records
    ADD COLUMN IF NOT EXISTS oil_filter_changed boolean DEFAULT false;

ALTER TABLE public.maintenance_records
    ADD COLUMN IF NOT EXISTS other_filters_changed text;

ALTER TABLE public.maintenance_records
    ADD COLUMN IF NOT EXISTS inspection_done boolean DEFAULT false;

ALTER TABLE public.maintenance_records
    ADD COLUMN IF NOT EXISTS inspection_notes text;

COMMENT ON COLUMN public.maintenance_records.oil_change_subtype IS
    'Type de vidange : simple (huile + filtre huile optionnel) ou complete (full service avec inspection).';

COMMENT ON COLUMN public.maintenance_records.oil_brand IS
    'Marque/type d''huile moteur utilisée (ex: Mobil 1 5W30). Requis pour OIL_CHANGE.';

COMMENT ON COLUMN public.maintenance_records.oil_filter_changed IS
    'Filtre à huile remplacé. Optionnel sur vidange simple, requis sur vidange complète.';

COMMENT ON COLUMN public.maintenance_records.other_filters_changed IS
    'Liste libre des autres filtres remplacés (air, habitacle, carburant). Vidange complète uniquement.';

COMMENT ON COLUMN public.maintenance_records.inspection_done IS
    'Inspection effectuée. Vidange complète uniquement.';

COMMENT ON COLUMN public.maintenance_records.inspection_notes IS
    'Notes d''inspection lors d''une vidange complète.';
