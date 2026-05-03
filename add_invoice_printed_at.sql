-- ─────────────────────────────────────────────────────────────────────────────
-- "Invoice already printed" marker
-- Run this once in the Supabase SQL editor.
--
-- Stores the timestamp at which a reservation / service was last included in
-- a downloaded PDF invoice (Facture Pro). The contract / invoice builders
-- write this timestamp on every successful download so the picker can show
-- a "printed" badge next time, preventing accidental duplicate invoices.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.reservations
    ADD COLUMN IF NOT EXISTS invoice_printed_at TIMESTAMPTZ;

ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS invoice_printed_at TIMESTAMPTZ;

-- Optional convenience indexes — speeds up filters like "show only un-printed".
CREATE INDEX IF NOT EXISTS reservations_invoice_printed_at_idx
    ON public.reservations (invoice_printed_at);

CREATE INDEX IF NOT EXISTS services_invoice_printed_at_idx
    ON public.services (invoice_printed_at);
