-- Fix RLS policies for patient_doctor_relationships table
-- This allows patients to view their own relationships

-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "Patients can view their relationships" ON public.patient_doctor_relationships;

-- Create policy for patients to view their own relationships
CREATE POLICY "Patients can view their relationships" ON public.patient_doctor_relationships
  FOR SELECT
  USING (
    auth.uid() = patient_id OR 
    auth.uid() = doctor_id
  );

-- Also ensure patients can read doctor info from users table
DROP POLICY IF EXISTS "Anyone can view doctors" ON public.users;

CREATE POLICY "Anyone can view doctors" ON public.users
  FOR SELECT
  USING (
    role = 'doctor' OR 
    auth.uid() = id
  );

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('patient_doctor_relationships', 'users');
