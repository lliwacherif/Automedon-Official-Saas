-- ─────────────────────────────────────────────────────────────────────────────
-- Optional columns for the new contract fields:
--   • Le type de location (Location / Transfert / Excursion)
--   • Contrat préparé par
--
-- NOTE: this migration is OPTIONAL.
--
-- The contract builder already persists everything under
-- `rental_contracts.contract_data` (JSONB). The two new fields (`locationType`
-- and `preparedBy`) are simply additional keys inside that JSON — they are
-- saved, loaded and rendered without any schema change.
--
-- Run this script ONLY if you want these fields as top-level columns so they
-- can be queried directly (e.g. for reports, filters). The application keeps
-- writing the JSON values, so both representations stay in sync if you also
-- add a trigger to extract them, but the easiest path is to ignore this file.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.rental_contracts
    ADD COLUMN IF NOT EXISTS location_type TEXT
        CHECK (location_type IS NULL OR location_type IN ('Location', 'Transfert', 'Excursion'));

ALTER TABLE public.rental_contracts
    ADD COLUMN IF NOT EXISTS prepared_by TEXT;

COMMENT ON COLUMN public.rental_contracts.location_type
    IS 'Optional flattened copy of contract_data->>locationType. Allowed values: Location, Transfert, Excursion.';

COMMENT ON COLUMN public.rental_contracts.prepared_by
    IS 'Optional flattened copy of contract_data->>preparedBy. Name of the agent who prepared the contract.';

-- One-shot back-fill from the JSON payload for rows that already exist.
UPDATE public.rental_contracts
SET
    location_type = COALESCE(location_type, contract_data->>'locationType'),
    prepared_by   = COALESCE(prepared_by,   contract_data->>'preparedBy');

COMMIT;
