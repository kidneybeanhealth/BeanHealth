-- Enterprise Schema V2
-- Run this in Supabase SQL Editor to fix the constraint error and set up separate tables.

-- 1. Fix Role Constraint on public.users
-- We drop and re-add to ensure 'enterprise' is definitely allowed.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('patient', 'doctor', 'admin', 'enterprise'));

-- 2. Create Hospital Profile Table
-- This keeps hospital details separate from the main user profile
CREATE TABLE IF NOT EXISTS public.hospital_profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    hospital_name TEXT NOT NULL,
    address TEXT,
    contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Enable RLS on the new table
ALTER TABLE public.hospital_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Hospital Profiles
DROP POLICY IF EXISTS "Hospitals can insert their own profile" ON public.hospital_profiles;
CREATE POLICY "Hospitals can insert their own profile" 
ON public.hospital_profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Hospitals can update their own profile" ON public.hospital_profiles;
CREATE POLICY "Hospitals can update their own profile" 
ON public.hospital_profiles FOR UPDATE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Hospitals can view their own profile" ON public.hospital_profiles;
CREATE POLICY "Hospitals can view their own profile" 
ON public.hospital_profiles FOR SELECT 
USING (auth.uid() = id);

-- 5. Seed the initial Enterprise User (Safe Upsert)
INSERT INTO public.users (id, email, name, role)
VALUES (
  '9618d88d-9e52-4cc4-afee-387b1f295498', 
  'chitti@beanhealth.com', 
  'Enterprise Hospital', 
  'enterprise'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'enterprise';
