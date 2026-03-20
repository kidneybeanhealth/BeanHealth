-- FINAL CORRECTED SCRIPT
-- Run this EXACT script. It includes the data cleanup that was missing.

-- 1. Remove the strict rule temporarily
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. FIX THE BAD DATA (This is the critical step)
-- Convert 'hospital' role (from old attempts) to 'enterprise'
UPDATE public.users SET role = 'enterprise' WHERE role = 'hospital';

-- Fix any other invalid roles by setting them to 'patient'
UPDATE public.users 
SET role = 'patient' 
WHERE role IS NULL 
   OR role NOT IN ('patient', 'doctor', 'admin', 'enterprise');

-- 3. Re-apply the strict rule (Now it will succeed)
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('patient', 'doctor', 'admin', 'enterprise'));

-- 4. Create the Hospital Table
CREATE TABLE IF NOT EXISTS public.hospital_profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    hospital_name TEXT NOT NULL,
    address TEXT,
    contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Set up Permissions
ALTER TABLE public.hospital_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hospitals can insert their own profile" ON public.hospital_profiles;
CREATE POLICY "Hospitals can insert their own profile" 
ON public.hospital_profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Hospitals can view/update their own profile" ON public.hospital_profiles;
CREATE POLICY "Hospitals can view/update their own profile" 
ON public.hospital_profiles FOR ALL 
USING (auth.uid() = id);

-- 6. Reset your specific User (So you can see the Setup Screen)
DELETE FROM public.hospital_profiles WHERE id = '9618d88d-9e52-4cc4-afee-387b1f295498';
DELETE FROM public.users WHERE id = '9618d88d-9e52-4cc4-afee-387b1f295498';
