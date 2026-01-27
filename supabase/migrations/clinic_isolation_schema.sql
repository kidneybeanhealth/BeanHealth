-- Migration for Clinic Multi-tenancy (Idempotent Version)

-- 1. Create Clinics Table (Only if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.clinics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    location TEXT,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Ensure columns exist if table was created previously
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='location') THEN
        ALTER TABLE public.clinics ADD COLUMN location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='address') THEN
        ALTER TABLE public.clinics ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='phone') THEN
        ALTER TABLE public.clinics ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='logo_url') THEN
        ALTER TABLE public.clinics ADD COLUMN logo_url TEXT;
    END IF;
END $$;

-- 2. Add clinic_id to users (Safe check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='clinic_id') THEN
        ALTER TABLE public.users 
        ADD COLUMN clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Add clinic_id to relationships (Safe check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_doctor_relationships' AND column_name='clinic_id') THEN
        ALTER TABLE public.patient_doctor_relationships
        ADD COLUMN clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Enable RLS (Safe to run repeatedly)
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Drop first to avoid "policy already exists" error)

-- Clinic View Policy
DROP POLICY IF EXISTS "View own clinic" ON public.clinics;
CREATE POLICY "View own clinic" ON public.clinics
FOR SELECT USING (
  id IN (
    SELECT clinic_id FROM public.users WHERE id = auth.uid()
  )
);

-- Allow creating a clinic (INSERT)
DROP POLICY IF EXISTS "Allow clinic creation" ON public.clinics;
CREATE POLICY "Allow clinic creation" ON public.clinics
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- Allow updating own clinic (UPDATE)
DROP POLICY IF EXISTS "Allow updating own clinic" ON public.clinics;
CREATE POLICY "Allow updating own clinic" ON public.clinics
FOR UPDATE USING (
  id IN (
    SELECT clinic_id FROM public.users WHERE id = auth.uid()
  )
);

-- User Visibility Policy
DROP POLICY IF EXISTS "Clinic isolation policy" ON public.users;
-- Note: You might need to drop conflicting policies like "Staff can view all users" first manually if they exist, 
-- but we will try creating the new one.
CREATE POLICY "Clinic isolation policy" ON public.users
FOR SELECT USING (
  auth.uid() = id
  OR 
  (clinic_id IS NOT NULL AND clinic_id = (
    SELECT clinic_id FROM public.users WHERE id = auth.uid()
  ))
);

-- Relationship Visibility Policy
DROP POLICY IF EXISTS "Clinic relationship isolation" ON public.patient_doctor_relationships;
CREATE POLICY "Clinic relationship isolation" ON public.patient_doctor_relationships
FOR SELECT USING (
  clinic_id = (
    SELECT clinic_id FROM public.users WHERE id = auth.uid()
  )
);
