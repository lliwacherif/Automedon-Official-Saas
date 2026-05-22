-- ─────────────────────────────────────────────────────────────────────────────
-- ADD created_by_tenant_user_id TO reservations
--
-- Purpose:
--   Track which tenant_user (admin / assistant / user / sub_office) created
--   each reservation. This powers the sous-bureau scoping rule: a
--   sub_office user only sees the reservations they typed in themselves
--   (the admin always sees everything).
--
--   The column is nullable so that:
--     - Legacy reservations don't need backfilling.
--     - If the creator gets deleted later, the reservation row survives
--       with NULL (ON DELETE SET NULL) and remains visible to the admin.
--
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.reservations
    ADD COLUMN IF NOT EXISTS created_by_tenant_user_id uuid
        REFERENCES public.tenant_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_created_by
    ON public.reservations (created_by_tenant_user_id);

COMMENT ON COLUMN public.reservations.created_by_tenant_user_id IS
    'tenant_users.id of the staff member who created this reservation. Used to scope visibility for sub_office users (they only see what they created). NULL = legacy / admin-created / creator was deleted.';
