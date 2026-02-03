-- Migration V2 for Supabase
-- Run this in the Supabase SQL Editor

-- Admin Settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id integer NOT NULL DEFAULT 1,
  password_hash text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  username text UNIQUE,
  role text DEFAULT 'admin'::text,
  CONSTRAINT admin_settings_pkey PRIMARY KEY (id)
);

-- Cars
CREATE TABLE IF NOT EXISTS public.cars (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  make text,
  model text NOT NULL,
  brand text CHECK (brand = ANY (ARRAY['Renault'::text, 'Dacia'::text, 'Skoda'::text, 'Hyundai'::text, 'Seat'::text, 'MG'::text, 'Mahindra'::text, 'Kia'::text, 'Honda'::text, 'Peugeot'::text, 'Cherry'::text, 'Geely'::text])),
  year integer,
  license_plate text NOT NULL UNIQUE,
  color text,
  price_per_day numeric,
  mileage integer NOT NULL DEFAULT 0,
  transmission text,
  seats integer,
  fuel_type text,
  description text,
  status text DEFAULT 'disponible'::text CHECK (status = ANY (ARRAY['disponible'::text, 'loue'::text, 'maintenance'::text])),
  image_url text,
  auto_manage_status boolean DEFAULT true,
  CONSTRAINT cars_pkey PRIMARY KEY (id)
);

-- Maintenance Records
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  car_id bigint NOT NULL,
  maintenance_type text NOT NULL CHECK (maintenance_type = ANY (ARRAY['OIL_CHANGE'::text, 'BRAKE_SERVICE'::text, 'REPAIR'::text, 'ROUTINE_CHECK'::text, 'LAVAGE'::text, 'ASSURANCE'::text, 'VIGNETTE'::text, 'LEASING'::text])),
  cost numeric NOT NULL DEFAULT 0,
  odometer integer NOT NULL,
  next_due_mileage integer,
  maintenance_date date NOT NULL,
  notes text,
  provider text,
  CONSTRAINT maintenance_records_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_records_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id)
);

-- Reservations (Create first because documents reference it)
CREATE TABLE IF NOT EXISTS public.reservations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  reservation_number character varying NOT NULL UNIQUE,
  user_id uuid,
  client_name character varying NOT NULL,
  client_cin character varying NOT NULL,
  client_phone character varying NOT NULL,
  client_email character varying,
  car_id bigint NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  pickup_time time without time zone,
  return_time time without time zone,
  pickup_location character varying,
  return_location character varying,
  duration_days integer NOT NULL,
  price_per_day numeric NOT NULL,
  total_price numeric NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'confirmed'::character varying::text, 'active'::character varying::text, 'completed'::character varying::text, 'cancelled'::character varying::text])),
  notes text,
  cancellation_reason text,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  advance_payment numeric NOT NULL DEFAULT 0,
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT reservations_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id)
);

-- Reservation Documents
CREATE TABLE IF NOT EXISTS public.reservation_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id bigint NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservation_documents_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_documents_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id)
);
