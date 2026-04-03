-- Migration to add Clinic Roles (Receptionist, Pharmacy)
-- and ensure Doctor/Patient relationship support

-- 1. Update User Roles
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('patient', 'doctor', 'admin', 'receptionist', 'pharmacy', 'clinic'));

-- 1.1 Add missing columns for patient details
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));

-- 2. Ensure patient_doctor_relationships exists (it should, but for safety)
CREATE TABLE IF NOT EXISTS public.patient_doctor_relationships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, doctor_id)
);

-- 3. Add RLS policies for Clinic/Staff access if not present
-- Allow doctors/receptionists/pharmacy to view users (patients/doctors)
CREATE POLICY "Staff can view all users" ON public.users
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.users 
      WHERE role IN ('doctor', 'admin', 'receptionist', 'pharmacy', 'clinic')
    )
  );

-- Allow Staff to view all relationships
CREATE POLICY "Staff can view relationships" ON public.patient_doctor_relationships
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.users 
      WHERE role IN ('doctor', 'admin', 'receptionist', 'pharmacy', 'clinic')
    )
  );

-- Allow Staff to insert relationships (Add Patient)
CREATE POLICY "Staff can manage relationships" ON public.patient_doctor_relationships
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.users 
      WHERE role IN ('doctor', 'admin', 'receptionist', 'pharmacy', 'clinic')
    )
  );
