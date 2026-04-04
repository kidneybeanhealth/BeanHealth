-- Enterprise FORCE FIX
-- This script changes the order of operations to ensure the Insertion succeeds.
-- Run this entire script in Supabase SQL Editor.

-- 1. DROP the blocking constraint immediately
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Insert the Enterprise User
-- This should now succeed because there is no constraint checking the role.
INSERT INTO public.users (id, email, name, role)
VALUES (
  '9618d88d-9e52-4cc4-afee-387b1f295498', 
  'chitti@beanhealth.com', 
  'Enterprise Hospital', 
  'enterprise'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'enterprise';

-- 3. Cleanup any other invalid data in the table
-- Ensure all other users are valid before we re-enable the rule.
UPDATE public.users 
SET role = 'patient' 
WHERE role NOT IN ('patient', 'doctor', 'admin', 'enterprise');

-- 4. Re-apply the Constraint
-- Now that our data is clean and our enterprise user is in, we lock it down.
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('patient', 'doctor', 'admin', 'enterprise'));

-- 5. Ensure Hospital Profile Table Exists (Just in case)
CREATE TABLE IF NOT EXISTS public.hospital_profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    hospital_name TEXT NOT NULL,
    address TEXT,
    contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
