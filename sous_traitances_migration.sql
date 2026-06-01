-- ============================================================
-- Sous-Traitances Module — Migration Script
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. sous_traitances — Main entity
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sous_traitances (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    -- Contract ID range (stored as text to preserve leading zeros, e.g. '002888')
    contract_range_start TEXT,
    contract_range_end   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant queries
CREATE INDEX IF NOT EXISTS idx_sous_traitances_tenant
    ON sous_traitances(tenant_id);

-- ────────────────────────────────────────────────
-- 2. sous_traitance_vehicles — Join table
--    Links a car to a sous-traitance with financial rules
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sous_traitance_vehicles (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sous_traitance_id   BIGINT NOT NULL REFERENCES sous_traitances(id) ON DELETE CASCADE,
    car_id              BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    -- Monthly payment amount (cambiale)
    monthly_payment     NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Day of the month the payment is due (1-28 to avoid month-length issues)
    due_day             INTEGER NOT NULL DEFAULT 1 CHECK (due_day >= 1 AND due_day <= 28),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Each car can only be assigned to one sous-traitance at a time
    CONSTRAINT uq_sous_traitance_car UNIQUE (car_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stv_tenant
    ON sous_traitance_vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stv_sous_traitance
    ON sous_traitance_vehicles(sous_traitance_id);
CREATE INDEX IF NOT EXISTS idx_stv_car
    ON sous_traitance_vehicles(car_id);

-- ────────────────────────────────────────────────
-- 3. sous_traitance_payments — Monthly payment records
--    One record per vehicle per month
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sous_traitance_payments (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sous_traitance_vehicle_id   BIGINT NOT NULL REFERENCES sous_traitance_vehicles(id) ON DELETE CASCADE,
    -- Period in YYYY-MM format (e.g. '2026-06')
    period_month                TEXT NOT NULL,
    -- The actual amount due for this period (copied from monthly_payment at generation time)
    amount                      NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Computed due date = period year-month + due_day
    due_date                    DATE NOT NULL,
    -- Status: 'pending', 'paid', 'overdue'
    status                      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    -- When the payment was marked as paid
    paid_at                     TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One payment record per vehicle per month
    CONSTRAINT uq_payment_vehicle_month UNIQUE (sous_traitance_vehicle_id, period_month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stp_tenant
    ON sous_traitance_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stp_vehicle
    ON sous_traitance_payments(sous_traitance_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_stp_status
    ON sous_traitance_payments(status);
CREATE INDEX IF NOT EXISTS idx_stp_due_date
    ON sous_traitance_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_stp_period
    ON sous_traitance_payments(period_month);

-- ────────────────────────────────────────────────
-- 4. RLS Policies
-- ────────────────────────────────────────────────

-- Enable RLS on all three tables
ALTER TABLE sous_traitances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sous_traitance_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sous_traitance_payments ENABLE ROW LEVEL SECURITY;

-- sous_traitances: full access for authenticated + anon (matching existing app pattern)
CREATE POLICY "Allow all access to sous_traitances"
    ON sous_traitances FOR ALL
    USING (true)
    WITH CHECK (true);

-- sous_traitance_vehicles: full access
CREATE POLICY "Allow all access to sous_traitance_vehicles"
    ON sous_traitance_vehicles FOR ALL
    USING (true)
    WITH CHECK (true);

-- sous_traitance_payments: full access
CREATE POLICY "Allow all access to sous_traitance_payments"
    ON sous_traitance_payments FOR ALL
    USING (true)
    WITH CHECK (true);

-- ────────────────────────────────────────────────
-- 5. Updated_at trigger (reuse pattern from other tables)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all three tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_sous_traitances') THEN
        CREATE TRIGGER set_updated_at_sous_traitances
            BEFORE UPDATE ON sous_traitances
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_sous_traitance_vehicles') THEN
        CREATE TRIGGER set_updated_at_sous_traitance_vehicles
            BEFORE UPDATE ON sous_traitance_vehicles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_sous_traitance_payments') THEN
        CREATE TRIGGER set_updated_at_sous_traitance_payments
            BEFORE UPDATE ON sous_traitance_payments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- DONE — You now have:
--   • sous_traitances           (name, desc, contract range)
--   • sous_traitance_vehicles   (car ↔ sous-traitance + cambiale)
--   • sous_traitance_payments   (monthly payment tracking)
-- ============================================================
