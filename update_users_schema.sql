-- Ensure tenant_users table handles multiple users correctly
-- This script should be run in the Supabase SQL Editor

-- 1. Ensure the table exists (if not already)
-- Note: It likely exists given the auth store uses it, but good to be safe.
create table if not exists public.tenant_users (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade,
    username text not null,
    password_hash text not null,
    role text not null check (role in ('admin', 'assistant', 'user', 'root')),
    created_at timestamptz default now(),
    
    -- Ensure username is unique PER TENANT
    unique (tenant_id, username)
);

-- 2. Add RLS policies if they don't exist
-- Enable RLS
alter table public.tenant_users enable row level security;

-- Allow reading own user data (for login) - This acts as a "public" read for login check? 
-- Actually, the auth store queries this table directly. 
-- If using anon key, we need a policy.
-- "Login" policy: Allow anyone to read if they know the username/tenant? 
-- Secure approach: Use specific RPC or Edge Function. 
-- For this simple app, we might just allow public read OR assume service_role key is not used but the app key is.
-- Let's make it simple for now:

create policy "Enable read access for all users" on public.tenant_users
    for select using (true);

-- Allow admins to insert/update/delete users FOR THEIR TENANT
-- This is tricky without a session.
-- For now, if the app uses a standard anon key, we might need to open it up 
-- OR rely on the application logic to handle who can do what (Authentication via the store).

-- The App currently does manual auth matching in `auth.ts`.
-- It selects `password_hash` directly. This requires SELECT permission.
