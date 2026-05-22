-- ─────────────────────────────────────────────────────────────────────────────
-- ADD 'sub_office' ROLE TO tenant_users + OPTIONAL FRIENDLY LABEL
--
-- Purpose:
--   The admin can now create a "Sous-Bureau" (sub-office) user from
--   /admin/settings → Sous-Bureaux. Such a user is a restricted operator
--   that sees the same admin pages EXCEPT the fleet dashboard, scoped to
--   a fleet of cars assigned to them (see create_sub_office_cars.sql).
--
--   We extend the existing role CHECK constraint to include 'sub_office'
--   and add an optional friendly label (e.g. "Bureau Annaba") that is
--   shown in the admin UI alongside the username.
--
-- Safe to run multiple times — the DROP CONSTRAINT IF EXISTS makes the
-- CHECK update idempotent, and the column is created with IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tenant_users
    DROP CONSTRAINT IF EXISTS tenant_users_role_check;

ALTER TABLE public.tenant_users
    ADD CONSTRAINT tenant_users_role_check
    CHECK (role IN ('root', 'admin', 'assistant', 'user', 'sub_office'));

COMMENT ON CONSTRAINT tenant_users_role_check ON public.tenant_users IS
    'Roles autorisés: root (super-admin global), admin (gérant tenant), assistant (legacy), user (utilisateur normal créé depuis la page Settings), sub_office (sous-bureau avec flotte dédiée).';

ALTER TABLE public.tenant_users
    ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN public.tenant_users.label IS
    'Optional friendly name shown in the admin UI for sub-office users (e.g. "Bureau Annaba"). NULL → falls back to the username.';
