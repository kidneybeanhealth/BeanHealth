-- Fix RLS for Referral Code Lookup
-- Run this in Supabase SQL Editor to allow patients to look up doctors by referral code

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Allow referral code lookup" ON public.users;
DROP POLICY IF EXISTS "Allow read doctor by referral code" ON public.users;

-- Create a policy that allows anyone authenticated to lookup doctors by referral code
-- This is needed for patients to search for doctors to link with
CREATE POLICY "Allow referral code lookup" ON public.users
  FOR SELECT
  USING (
    -- Users can always see their own record
    auth.uid() = id
    OR 
    -- Anyone authenticated can see doctors (for referral code lookup)
    (role = 'doctor')
    OR
    -- Doctors can see their patients
    (role = 'patient' AND EXISTS (
      SELECT 1 FROM patient_doctor_relationships pdr 
      WHERE pdr.doctor_id = auth.uid() AND pdr.patient_id = users.id
    ))
  );

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'users';
