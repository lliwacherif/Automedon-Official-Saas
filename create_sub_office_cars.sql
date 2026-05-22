-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE sub_office_cars JUNCTION TABLE
--
-- Purpose:
--   Map a sub_office tenant_user to the cars they are allowed to operate.
--   Car assignment is exclusive: one car can be assigned to at most ONE
--   sub_office at a time (enforced by UNIQUE(car_id)). The tenant admin
--   can still create reservations / services on the car independently.
--
--   Cascade rules:
--     - Deleting a tenant_user (sous-bureau) frees up all their cars.
--     - Deleting a car removes any related assignment row.
--
--   Mirrors the existing permissive RLS style used by other tables in the
--   schema (see supabase_fix_rls_policies.sql) — isolation is enforced
--   client-side until we move to a backend API.
--
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sub_office_cars (
    tenant_user_id uuid NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
    car_id bigint NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_user_id, car_id),
    UNIQUE (car_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_office_cars_user
    ON public.sub_office_cars (tenant_user_id);

CREATE INDEX IF NOT EXISTS idx_sub_office_cars_tenant
    ON public.sub_office_cars (tenant_id);

ALTER TABLE public.sub_office_cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_office_cars_all_access" ON public.sub_office_cars;
CREATE POLICY "sub_office_cars_all_access"
    ON public.sub_office_cars
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.sub_office_cars IS
    'Junction table: links a tenant_users.id (role=sub_office) to the cars assigned to them. UNIQUE(car_id) enforces exclusive assignment.';
