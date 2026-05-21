-- ─────────────────────────────────────────────────────────────────────────────
-- Fix the tenant_users.role CHECK constraint to allow 'user'
--
-- Symptom:
--   new row for relation "tenant_users" violates check constraint
--   "tenant_users_role_check"
--
-- Cause:
--   The original schema only allowed ('root', 'admin', 'assistant') but
--   the "Créer un nouvel utilisateur" form in /admin/settings inserts
--   rows with role = 'user'.
--
-- Safe to run multiple times — the DROP CONSTRAINT IF EXISTS makes it
-- idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tenant_users
    DROP CONSTRAINT IF EXISTS tenant_users_role_check;

ALTER TABLE public.tenant_users
    ADD CONSTRAINT tenant_users_role_check
    CHECK (role IN ('root', 'admin', 'assistant', 'user'));

COMMENT ON CONSTRAINT tenant_users_role_check ON public.tenant_users IS
    'Roles autorisés: root (super-admin global), admin (gérant tenant), assistant (legacy), user (utilisateur normal créé depuis la page Settings).';
