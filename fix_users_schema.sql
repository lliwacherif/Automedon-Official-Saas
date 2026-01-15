-- FIX Script: Update the Check Constraint on tenant_users
-- The previous script only created the table if it didn't exist.
-- Your table likely already existed with a stricter constraint (Admin/Assistant only).
-- This script will remove the old constraint and add the correct one.

-- 1. Drop existing constraint (name might vary, trying common defaults)
alter table public.tenant_users drop constraint if exists "tenant_users_role_check";

-- 2. Add the correct constraint
alter table public.tenant_users 
  add constraint "tenant_users_role_check" 
  check (role in ('admin', 'assistant', 'user', 'root'));

-- 3. (Optional) Ensure username uniqueness constraint exists
-- Because sometimes unique constraints have auto-generated names, we try to add it only if missing.
-- Safest way is to attempt to add and ignore if fails, or just rely on the user interface checks for now.
-- But let's try to add strict uniqueness if not present.
alter table public.tenant_users 
  drop constraint if exists "tenant_users_tenant_id_username_key";

alter table public.tenant_users
  add constraint "tenant_users_tenant_id_username_key" 
  unique (tenant_id, username);
