-- ================================================================
-- AUTOMEDON SaaS — COMPLETE DATABASE SETUP
-- ================================================================
-- Generated from deep analysis of codebase + all migrations
-- Run this in a fresh Supabase project SQL Editor
-- ================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. TENANTS
-- ================================================================
CREATE TABLE public.tenants (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    logo_url text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    payment_alert boolean DEFAULT false
);

-- ================================================================
-- 2. TENANT USERS (Auth for Root, Admin, Assistant)
-- ================================================================
CREATE TABLE public.tenant_users (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('root', 'admin', 'assistant')),
    CONSTRAINT unique_user_per_tenant UNIQUE NULLS NOT DISTINCT (tenant_id, username)
);

-- ================================================================
-- 3. CARS
-- ================================================================
CREATE TABLE public.cars (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    brand text CHECK (brand = ANY (ARRAY[
        'Renault'::text, 'Dacia'::text, 'Skoda'::text, 'Hyundai'::text,
        'Seat'::text, 'MG'::text, 'Mahindra'::text, 'Kia'::text,
        'Honda'::text, 'Peugeot'::text, 'Cherry'::text, 'Geely'::text,
        'Volkswagen'::text, 'Suzuki'::text, 'Chevrolet'::text, 'Fiat'::text
    ])),
    model text NOT NULL,
    make text,
    year integer,
    license_plate text NOT NULL,
    color text,
    price_per_day numeric,
    mileage integer DEFAULT 0 NOT NULL,
    transmission text,
    seats integer,
    fuel_type text,
    description text,
    status text DEFAULT 'disponible' CHECK (status IN ('disponible', 'loue', 'maintenance')),
    image_url text,
    auto_manage_status boolean DEFAULT true,
    purchase_price numeric,
    leasing_advance numeric,
    UNIQUE (tenant_id, license_plate)
);

-- ================================================================
-- 4. RESERVATIONS
-- ================================================================
CREATE TABLE public.reservations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reservation_number text NOT NULL,
    user_id uuid,
    client_name text NOT NULL,
    client_cin text NOT NULL,
    client_phone text NOT NULL,
    client_email text,
    client_permit_number text,
    second_driver_name text,
    second_driver_cin text,
    second_driver_phone text,
    second_driver_email text,
    second_driver_permit_number text,
    car_id bigint NOT NULL REFERENCES public.cars(id),
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    pickup_location text,
    return_location text,
    duration_days integer NOT NULL,
    price_per_day numeric NOT NULL,
    total_price numeric NOT NULL,
    advance_payment numeric DEFAULT 0 NOT NULL,
    caution numeric DEFAULT 0,
    caution_currency text DEFAULT 'DT' CHECK (caution_currency IN ('DT', 'EUR', 'USD')),
    contract_number text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled')),
    notes text,
    cancellation_reason text,
    cancelled_at timestamp with time zone,
    UNIQUE (tenant_id, reservation_number)
);

-- ================================================================
-- 5. RESERVATION DOCUMENTS
-- ================================================================
CREATE TABLE public.reservation_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    reservation_id bigint NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    file_name text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ================================================================
-- 6. SERVICES (Transfert / Excursion)
-- ================================================================
CREATE TABLE public.services (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    service_type text NOT NULL CHECK (service_type IN ('transfert', 'excursion')),
    car_id bigint NOT NULL REFERENCES public.cars(id),
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    chauffeur_name text NOT NULL,
    chauffeur_cin text NOT NULL,
    chauffeur_permit text,
    client_name text,
    client_cin text,
    price numeric NOT NULL,
    payment_method text DEFAULT 'cash',
    advance_payment numeric DEFAULT 0,
    contract_number text,
    notes text
);

-- ================================================================
-- 7. MAINTENANCE RECORDS
-- ================================================================
CREATE TABLE public.maintenance_records (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    car_id bigint NOT NULL REFERENCES public.cars(id),
    maintenance_type text NOT NULL CHECK (maintenance_type IN (
        'OIL_CHANGE', 'BRAKE_SERVICE', 'REPAIR', 'ROUTINE_CHECK',
        'LAVAGE', 'ASSURANCE', 'VIGNETTE', 'LEASING', 'TIRES', 'BATTERY'
    )),
    cost numeric DEFAULT 0 NOT NULL,
    odometer integer NOT NULL,
    next_due_mileage integer,
    maintenance_date date NOT NULL,
    notes text,
    provider text,
    damage_type text,
    damage_date date,
    responsible_client_name text,
    responsible_client_cin text,
    responsible_client_permit text,
    linked_reservation_id integer REFERENCES public.reservations(id) ON DELETE SET NULL,
    damage_images text[]
);

-- ================================================================
-- 8. FAITHFUL CLIENTS
-- ================================================================
CREATE TABLE public.faithful_clients (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    full_name text NOT NULL,
    cin text NOT NULL,
    phone text,
    email text,
    UNIQUE (tenant_id, cin)
);

-- ================================================================
-- 9. REPORTED CLIENTS
-- ================================================================
CREATE TABLE public.reported_clients (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_name text NOT NULL,
    client_cin text NOT NULL,
    client_phone text,
    description text
);

-- ================================================================
-- 10. STORE APPS
-- ================================================================
CREATE TABLE public.store_apps (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10, 2) DEFAULT 0,
    icon_url text,
    is_active boolean DEFAULT true
);

-- ================================================================
-- 11. APP ASSIGNMENTS (Store App <-> Tenant)
-- ================================================================
CREATE TABLE public.app_assignments (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    app_id bigint NOT NULL REFERENCES public.store_apps(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    status text DEFAULT 'active',
    UNIQUE (app_id, tenant_id)
);

-- ================================================================
-- 12. TENANT INVOICE SETTINGS
-- ================================================================
CREATE TABLE public.tenant_invoice_settings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    company_address text,
    company_mf text,
    company_email text,
    company_gsm text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- 13. TRIGGERS
-- ================================================================

-- Auto-generate reservation number
CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reservation_number IS NULL OR NEW.reservation_number = '' THEN
        NEW.reservation_number := 'RES-' || to_char(now(), 'YYYYMMDD') || '-' ||
                                  lpad(floor(random() * 10000)::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_reservation_number
BEFORE INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION generate_reservation_number();

-- ================================================================
-- 14. ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faithful_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reported_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invoice_settings ENABLE ROW LEVEL SECURITY;

-- Public access policies (app uses custom auth, not Supabase Auth for tenant users)
CREATE POLICY "public_all" ON public.tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.tenant_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.cars FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.reservation_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.maintenance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.faithful_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.reported_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.store_apps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.app_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.tenant_invoice_settings FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- 15. STORAGE BUCKETS
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
    ('car-images', 'car-images', true, 10485760),
    ('contracts', 'contracts', true, 10485760),
    ('store-icons', 'store-icons', true, 5242880)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies (public access for all buckets)
CREATE POLICY "public_select_storage" ON storage.objects FOR SELECT USING (true);
CREATE POLICY "public_insert_storage" ON storage.objects FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_storage" ON storage.objects FOR UPDATE USING (true);
CREATE POLICY "public_delete_storage" ON storage.objects FOR DELETE USING (true);

-- ================================================================
-- 16. DEFAULT ROOT USER
-- ================================================================
-- Password: root (SHA-256 hash)
-- CHANGE THIS after first login!
INSERT INTO public.tenant_users (id, tenant_id, username, password_hash, role)
VALUES (
    uuid_generate_v4(),
    NULL,
    'root',
    '4813494d137e1631bba301d5acab6e7bb7aa74ce1185d456565ef51d737677b2',
    'root'
);

-- ================================================================
-- DONE. Your Automedon SaaS database is ready.
-- 
-- Tables created: 12
--   tenants, tenant_users, cars, reservations, reservation_documents,
--   services, maintenance_records, faithful_clients, reported_clients,
--   store_apps, app_assignments, tenant_invoice_settings
--
-- Storage buckets: 3
--   car-images, contracts, store-icons
--
-- Default root login:
--   Username: root
--   Password: root  (change immediately!)
-- ================================================================
