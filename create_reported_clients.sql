-- Create reported_clients table
CREATE TABLE IF NOT EXISTS public.reported_clients (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_name text NOT NULL,
    client_cin text NOT NULL,
    client_phone text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.reported_clients ENABLE ROW LEVEL SECURITY;

-- Create Public Access Policy (Read/Write for everyone as per request "common section")
-- Although "common section" implies shared data, we might want to track WHO reported them.
-- But for now, simple public access.
CREATE POLICY "Public Access Reported Clients" ON public.reported_clients FOR ALL USING (true) WITH CHECK (true);

-- Index on CIN for fast lookup
CREATE INDEX IF NOT EXISTS idx_reported_clients_cin ON public.reported_clients(client_cin);
