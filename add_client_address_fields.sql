-- ─────────────────────────────────────────────────────────────────────────────
-- Optional address fields for reservation clients
-- Run this once in the Supabase SQL editor.
--
-- These columns feed:
--   • Reservation form (Informations Client / Deuxième Conducteur)
--   • Contract Builder V1 (locataire.adresse / conducteur.adresse)
--   • Contract Builder V2 (same fields, shared model)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.reservations
    ADD COLUMN IF NOT EXISTS client_address TEXT;

ALTER TABLE public.reservations
    ADD COLUMN IF NOT EXISTS second_driver_address TEXT;

COMMENT ON COLUMN public.reservations.client_address
    IS 'Optional postal address of the primary client / locataire. Auto-prefills the contract builder.';

COMMENT ON COLUMN public.reservations.second_driver_address
    IS 'Optional postal address of the second driver / conducteur. Auto-prefills the contract builder.';
