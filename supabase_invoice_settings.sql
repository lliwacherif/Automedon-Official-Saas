-- Run this in the Supabase SQL Editor
-- Creates a table to store invoice company settings per tenant (one row per tenant)

CREATE TABLE IF NOT EXISTS tenant_invoice_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_address TEXT NOT NULL DEFAULT '',
  company_mf TEXT NOT NULL DEFAULT '',
  company_email TEXT NOT NULL DEFAULT '',
  company_gsm TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE tenant_invoice_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching the pattern of the rest of this app which uses anon key)
CREATE POLICY "Allow all access to tenant_invoice_settings"
  ON tenant_invoice_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
