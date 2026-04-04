-- Enterprise Fix Script
-- Run this to resolve the "check constraint violated" error.

-- 1. SANITIZE DATA: Fix any rows that would violate the new constraint
-- This ensures all existing users have a valid role before we enforce the rule.
UPDATE public.users 
SET role = 'patient' 
WHERE role IS NULL OR role NOT IN ('patient', 'doctor', 'admin', 'enterprise');

-- 2. Drop the old constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 3. Add the new constraint (Safe now because data is clean)
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('patient', 'doctor', 'admin', 'enterprise'));

-- 4. Create separate Hospital Tables
CREATE TABLE IF NOT EXISTS public.hospital_profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    hospital_name TEXT NOT NULL,
    address TEXT,
    contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Enable RLS
ALTER TABLE public.hospital_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Setup Policies
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

-- 7. Ensure Enterprise User Exists
INSERT INTO public.users (id, email, name, role)
VALUES (
  '9618d88d-9e52-4cc4-afee-387b1f295498', 
  'chitti@beanhealth.com', 
  'Enterprise Hospital', 
  'enterprise'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'enterprise';
