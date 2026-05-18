-- ─────────────────────────────────────────────────────────────────────────────
-- Make client_phone optional on reservations
--
-- The reservation form on /admin/reservations/new no longer requires the
-- client's phone number. Drop the NOT NULL constraint so empty values
-- are stored as NULL.
--
-- Safe to run multiple times — ALTER COLUMN DROP NOT NULL is a no-op when
-- the constraint is already absent.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.reservations
    ALTER COLUMN client_phone DROP NOT NULL;

COMMENT ON COLUMN public.reservations.client_phone IS
    'Numéro de téléphone du client. Optionnel — peut être NULL.';
