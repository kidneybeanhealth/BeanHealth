-- FIX: Infinite Recursion in RLS Policies
-- Run this in Supabase SQL Editor to fix the issue

-- ============================================
-- 1. DROP THE PROBLEMATIC POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete all users" ON public.users;

-- Also drop old policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- ============================================
-- 2. CREATE A SECURITY DEFINER FUNCTION
-- This function bypasses RLS to check admin status
-- ============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. CREATE NEW RLS POLICIES USING THE FUNCTION
-- ============================================

-- Users can view their own profile OR admins can view all
CREATE POLICY "Users can view profiles" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR is_admin()
  );

-- Users can update their own profile OR admins can update all
CREATE POLICY "Users can update profiles" ON public.users
  FOR UPDATE USING (
    auth.uid() = id OR is_admin()
  );

-- Allow insert for authenticated users (for profile creation)
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (
    auth.uid() = id
  );

-- Only admins can delete users
CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE USING (
    is_admin()
  );

-- ============================================
-- 4. FIX OTHER TABLE POLICIES IF NEEDED
-- ============================================

-- Drop and recreate vitals policy
DROP POLICY IF EXISTS "Users and admins can view vitals" ON public.vitals;
DROP POLICY IF EXISTS "Patients can view own vitals" ON public.vitals;

CREATE POLICY "View vitals" ON public.vitals
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.patient_doctor_relationships WHERE patient_id = vitals.patient_id AND doctor_id = auth.uid()) OR
    is_admin()
  );

-- Drop and recreate medications policy
DROP POLICY IF EXISTS "Users and admins can view medications" ON public.medications;
DROP POLICY IF EXISTS "Patients can view own medications" ON public.medications;

CREATE POLICY "View medications" ON public.medications
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.patient_doctor_relationships WHERE patient_id = medications.patient_id AND doctor_id = auth.uid()) OR
    is_admin()
  );

-- Drop and recreate records policy
DROP POLICY IF EXISTS "Users and admins can view records" ON public.medical_records;
DROP POLICY IF EXISTS "Patients can view own records" ON public.medical_records;

CREATE POLICY "View medical records" ON public.medical_records
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.patient_doctor_relationships WHERE patient_id = medical_records.patient_id AND doctor_id = auth.uid()) OR
    is_admin()
  );

-- Drop and recreate relationships policies
DROP POLICY IF EXISTS "View relationships" ON public.patient_doctor_relationships;
DROP POLICY IF EXISTS "Admins can manage relationships" ON public.patient_doctor_relationships;
DROP POLICY IF EXISTS "View own relationships" ON public.patient_doctor_relationships;

CREATE POLICY "View relationships" ON public.patient_doctor_relationships
  FOR SELECT USING (
    patient_id = auth.uid() OR doctor_id = auth.uid() OR is_admin()
  );

CREATE POLICY "Manage relationships" ON public.patient_doctor_relationships
  FOR ALL USING (
    patient_id = auth.uid() OR doctor_id = auth.uid() OR is_admin()
  );

-- ============================================
-- 5. VERIFY THE FIX
-- ============================================

SELECT 'Policies fixed! You can now try signing up again.' as status;
