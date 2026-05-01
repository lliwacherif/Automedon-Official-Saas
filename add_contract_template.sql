-- ─────────────────────────────────────────────────────────────────────────────
-- Contract template selector + company RIB
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Per-tenant contract template selector.
--    'default' = the original 1-page contract.
--    'v2'      = the new "Tesla style" template (assigned per tenant from the Root dashboard).
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS contract_template TEXT NOT NULL DEFAULT 'default';

-- Backfill any pre-existing NULLs (defensive — column was added with default but old rows might still need it).
UPDATE public.tenants
SET contract_template = 'default'
WHERE contract_template IS NULL;

-- Soft validation: only the two known values are allowed today, but we add it as
-- a NOT VALID constraint so existing rows are accepted as-is.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_contract_template_check'
    ) THEN
        ALTER TABLE public.tenants
            ADD CONSTRAINT tenants_contract_template_check
            CHECK (contract_template IN ('default', 'v2'));
    END IF;
END $$;

-- 2) Add RIB column to tenant_invoice_settings (used by the new contract header).
ALTER TABLE public.tenant_invoice_settings
    ADD COLUMN IF NOT EXISTS company_rib TEXT;
