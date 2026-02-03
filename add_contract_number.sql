-- Add contract_number column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS contract_number VARCHAR(4);

-- Add comment
COMMENT ON COLUMN public.reservations.contract_number IS 'Short contract identifier (max 4 chars)';
