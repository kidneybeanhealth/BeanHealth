-- Hospital Management System Schema
-- Run these commands in your Supabase SQL editor

-- 1. Create a function to add 'hospital' to the role constraint if needed
-- Actually, it's easier to just drop and recreate the constraint if it exists
DO $$ 
BEGIN
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'doctor', 'admin', 'hospital'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update users_role_check constraint';
END $$;

-- 2. Create Hospitals table
CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  license_number TEXT,
  details_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. Add hospital_id to users table for Doctors
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id);

-- 4. Create Hospital Patients (Walk-in)
CREATE TABLE IF NOT EXISTS public.hospital_patients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  token_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Hospital Queues / Assignments
CREATE TABLE IF NOT EXISTS public.hospital_queues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  queue_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'working', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable RLS
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_queues ENABLE ROW LEVEL SECURITY;

-- 7. Policies

-- Hospitals can see and update their own data
CREATE POLICY "Hospitals can view own record" ON public.hospitals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Hospitals can update own record" ON public.hospitals
  FOR UPDATE USING (auth.uid() = user_id);

-- Hospital data (patients/queues) visible to the hospital user AND doctors assigned to that hospital
CREATE POLICY "View hospital patients" ON public.hospital_patients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = hospital_id AND h.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.hospital_id = hospital_patients.hospital_id)
  );

CREATE POLICY "Manage hospital patients" ON public.hospital_patients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = hospital_id AND h.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.hospital_id = hospital_patients.hospital_id)
  );

CREATE POLICY "View hospital queues" ON public.hospital_queues
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = hospital_id AND h.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.hospital_id = hospital_queues.hospital_id)
  );

CREATE POLICY "Manage hospital queues" ON public.hospital_queues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = hospital_id AND h.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.hospital_id = hospital_queues.hospital_id)
  );

-- Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_patients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_queues;
