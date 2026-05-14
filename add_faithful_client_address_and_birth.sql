-- ─────────────────────────────────────────────────────────────────────────────
-- Add address + date_of_birth to faithful_clients
--
-- Both columns are optional (nullable). The address is auto-filled into the
-- "Adresse Client" field of the reservation form when the admin picks a
-- faithful client from the autocomplete.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.faithful_clients
    ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.faithful_clients
    ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMENT ON COLUMN public.faithful_clients.address IS
    'Adresse postale du client. Optionnelle. Auto-renseignée dans le formulaire de réservation lors de la sélection.';

COMMENT ON COLUMN public.faithful_clients.date_of_birth IS
    'Date de naissance du client. Optionnelle.';
