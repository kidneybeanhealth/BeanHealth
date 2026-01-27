-- Enterprise Setup RESET & FIX
-- Run this script to PROPERLY fix the database rules AND reset your user
-- so you can test the "Complete Profile" flow from the UI.

-- 1. FIX CONSTRAINTS (The Root Cause of errors)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('patient', 'doctor', 'admin', 'enterprise'));

-- 2. CREATE HOSPITAL TABLE
CREATE TABLE IF NOT EXISTS public.hospital_profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    hospital_name TEXT NOT NULL,
    address TEXT,
    contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. ENABLE PERMISSIONS
ALTER TABLE public.hospital_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hospitals can insert their own profile" ON public.hospital_profiles;
CREATE POLICY "Hospitals can insert their own profile" 
ON public.hospital_profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Hospitals can view/update their own profile" ON public.hospital_profiles;
CREATE POLICY "Hospitals can view/update their own profile" 
ON public.hospital_profiles FOR ALL 
USING (auth.uid() = id);

-- 4. RESET USER FOR SETUP
-- We DELETE the user from public.users so you are forced to go through the 
-- "Complete Profile" screen again. This allows you to verify the logic 
-- and enter your Hospital Name/Address manually.
DELETE FROM public.hospital_profiles WHERE id = '9618d88d-9e52-4cc4-afee-387b1f295498';
DELETE FROM public.users WHERE id = '9618d88d-9e52-4cc4-afee-387b1f295498';

-- Done! Now go to the app and Log In. You will see the Setup Screen.
-- Submit the form, and it will work this time!
