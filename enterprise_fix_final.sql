-- Enterprise Fix Final
-- Run this script to resolve the "check constraint violated" error.
-- It fixes the mismatch between 'hospital' and 'enterprise' roles.

-- 1. DATA CLEANUP: Convert 'hospital' role to 'enterprise'
-- The error happens because existing data might have 'hospital' role, blocking our new rule.
UPDATE public.users 
SET role = 'enterprise' 
WHERE role = 'hospital';

-- Default any other weird roles to 'patient' to ensure the constraint applies successfully
UPDATE public.users 
SET role = 'patient' 
WHERE role NOT IN ('patient', 'doctor', 'admin', 'enterprise');

-- 2. UPDATE CONSTRAINT
-- Now that data is clean, we can enforce the new rule.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('patient', 'doctor', 'admin', 'enterprise'));

-- 3. CREATE HOSPITAL TABLES
CREATE TABLE IF NOT EXISTS public.hospital_profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    hospital_name TEXT NOT NULL,
    address TEXT,
    contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. SETUP PERMISSIONS
ALTER TABLE public.hospital_profiles ENABLE ROW LEVEL SECURITY;

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

-- 5. INSERT ENTERPRISE USER
INSERT INTO public.users (id, email, name, role)
VALUES (
  '9618d88d-9e52-4cc4-afee-387b1f295498', 
  'chitti@beanhealth.com', 
  'Enterprise Hospital', 
  'enterprise'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'enterprise';
