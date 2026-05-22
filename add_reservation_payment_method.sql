-- ============================================================================
-- add_reservation_payment_method.sql
-- ----------------------------------------------------------------------------
-- Adds an optional `payment_method` column to `public.reservations` so the
-- admin can record the primary mode de paiement straight from the Tarification
-- section of the new/edit reservation page.
--
-- The same value is round-tripped with the Contract Builder's "Mode de
-- paiement" field (paiement.mode in rental_contracts.contract_data), giving
-- a bidirectional sync between the two surfaces:
--   * Reservation → Contract  : pre-fills the Mode de paiement select.
--   * Contract   → Reservation: when "Sauvegarder comme réservation" runs
--                               on a blank contract, the chosen mode is
--                               persisted on the new reservation row.
--
-- Allowed values mirror the contract dropdown exactly so the round-trip is
-- lossless:
--   * 'cheque'   → Chèque
--   * 'carte'    → Carte de crédit
--   * 'especes'  → Espèces
--   * 'virement' → Virement
--   * NULL       → Non défini (default for legacy rows)
-- ============================================================================

ALTER TABLE public.reservations
    ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IN ('cheque', 'carte', 'especes', 'virement'));

COMMENT ON COLUMN public.reservations.payment_method IS
    'Mode de paiement principal de la réservation. Synchronisé avec paiement.mode du contrat de location. Valeurs : cheque | carte | especes | virement | NULL.';
