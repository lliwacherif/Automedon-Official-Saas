-- ================================================================
-- ADD ALLOWED_PAGES COLUMN TO tenant_users
-- ================================================================
-- Purpose: Allow tenant admins to control which pages each user
-- they create can see and access. A NULL value means "use defaults"
-- (backward compatible). An empty array means "no restricted pages
-- allowed". A non-empty array is the explicit allow-list.
--
-- Admins ('admin' role) and the global 'root' user are NEVER affected
-- by this column on the client side — they always see everything.
-- ================================================================

ALTER TABLE public.tenant_users
    ADD COLUMN IF NOT EXISTS allowed_pages text[] DEFAULT NULL;

COMMENT ON COLUMN public.tenant_users.allowed_pages IS
'Optional allow-list of page keys (e.g. fleet, kpi, reservations) that this user can access. NULL = default behaviour (legacy). Only applies to non-admin roles.';
