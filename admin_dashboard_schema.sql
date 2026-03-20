-- Admin Dashboard Schema Setup
-- Run this in your Supabase SQL Editor to enable admin functionality

-- ============================================
-- 1. UPDATE ROLE CONSTRAINT TO INCLUDE 'admin'
-- ============================================

-- First, drop the existing constraint
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint including 'admin' role
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('patient', 'doctor', 'admin'));

-- ============================================
-- 2. CREATE ADMIN USER
-- ============================================

-- Insert admin user (run this to create your first admin)
-- Note: The admin needs to first sign up through the app, then run this to update their role
-- Or you can insert directly with a generated UUID

-- Option A: Update existing user to admin (if already signed up)
-- UPDATE public.users 
-- SET role = 'admin' 
-- WHERE email = 'harish@beanhealth.in';

-- Option B: Insert new admin user (replace 'your-uuid-here' with actual UUID from auth.users)
-- INSERT INTO public.users (id, email, name, role) 
-- VALUES ('your-uuid-here', 'harish@beanhealth.in', 'Admin', 'admin');

-- ============================================
-- 3. ADMIN RLS POLICIES
-- ============================================

-- Allow admins to view all users
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = id
  );

-- Allow admins to update all users
CREATE POLICY "Admins can update all users" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = id
  );

-- Allow admins to delete all users
CREATE POLICY "Admins can delete all users" ON public.users
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admins to view all vitals
DROP POLICY IF EXISTS "Patients can view own vitals" ON public.vitals;
CREATE POLICY "Users and admins can view vitals" ON public.vitals
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.patient_doctor_relationships WHERE patient_id = vitals.patient_id AND doctor_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admins to view all medications
DROP POLICY IF EXISTS "Patients can view own medications" ON public.medications;
CREATE POLICY "Users and admins can view medications" ON public.medications
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.patient_doctor_relationships WHERE patient_id = medications.patient_id AND doctor_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admins to view all medical records
DROP POLICY IF EXISTS "Patients can view own records" ON public.medical_records;
CREATE POLICY "Users and admins can view records" ON public.medical_records
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.patient_doctor_relationships WHERE patient_id = medical_records.patient_id AND doctor_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admins to view and manage all relationships
DROP POLICY IF EXISTS "View own relationships" ON public.patient_doctor_relationships;
CREATE POLICY "View relationships" ON public.patient_doctor_relationships
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    doctor_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage relationships" ON public.patient_doctor_relationships
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 4. VERIFICATION
-- ============================================

-- Check if admin role is now allowed
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'users_role_check';

-- List all policies on users table
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Sign up as harish@beanhealth.in through the app (Patient or Doctor)
-- 3. Run: UPDATE public.users SET role = 'admin' WHERE email = 'harish@beanhealth.in';
-- 4. Log out and log back in - you should see the Admin Dashboard
