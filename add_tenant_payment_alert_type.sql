-- ─────────────────────────────────────────────────────────────────────────────
-- Tenants — payment alert type (banner vs banner+modal)
--
-- The root admin can now pick between two alert experiences for each
-- tenant whose payment is overdue:
--   • banner → the existing orange strip under the navbar only
--   • modal  → the strip AND a centered popup on first load (the tenant
--              can dismiss it for the session)
-- payment_alert (boolean) still acts as the master on/off switch.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS payment_alert_type text DEFAULT 'banner'
        CHECK (payment_alert_type IN ('banner', 'modal'));

COMMENT ON COLUMN public.tenants.payment_alert_type IS
    'Type d''alerte de paiement: "banner" pour la bande orange seule, "modal" pour la bande + popup central dismissable au login. Ignoré quand payment_alert = false.';
