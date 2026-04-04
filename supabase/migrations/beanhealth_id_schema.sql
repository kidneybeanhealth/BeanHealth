-- BeanHealth ID Schema Migration
-- This creates the unified patient identity system across all hospitals
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. ADD BEANHEALTH_ID TO USERS TABLE
-- ============================================

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS beanhealth_id TEXT UNIQUE;

-- Index for fast BHID lookups
CREATE INDEX IF NOT EXISTS idx_users_beanhealth_id 
  ON public.users(beanhealth_id) WHERE beanhealth_id IS NOT NULL;

-- ============================================
-- 2. ADD LINKING COLUMN TO HOSPITAL_PATIENTS
-- ============================================

ALTER TABLE public.hospital_patients 
  ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Index for cross-hospital patient lookups
CREATE INDEX IF NOT EXISTS idx_hospital_patients_linked_user 
  ON public.hospital_patients(linked_user_id) WHERE linked_user_id IS NOT NULL;

-- Ensure phone column exists with index
ALTER TABLE public.hospital_patients 
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_hospital_patients_phone 
  ON public.hospital_patients(phone) WHERE phone IS NOT NULL;

-- ============================================
-- 3. BEANHEALTH ID GENERATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION generate_beanhealth_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- No confusing chars (0,O,1,I,L)
  result TEXT := 'BH-';
  i INTEGER;
  attempts INTEGER := 0;
BEGIN
  LOOP
    result := 'BH-';
    -- Generate 6-char random code
    FOR i IN 1..6 LOOP
      result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    END LOOP;
    
    result := result || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE beanhealth_id = result) THEN
      EXIT;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique BeanHealth ID after 100 attempts';
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. AUTO-GENERATE BHID FOR NEW PATIENTS
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_beanhealth_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate for patients who don't have a BHID yet
  IF NEW.role = 'patient' AND NEW.beanhealth_id IS NULL THEN
    NEW.beanhealth_id := generate_beanhealth_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_beanhealth_id ON public.users;

-- Create trigger for new patient signups
CREATE TRIGGER trigger_beanhealth_id
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_beanhealth_id();

-- ============================================
-- 5. PATIENT-HOSPITAL LINKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.patient_hospital_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_patient_id UUID REFERENCES public.hospital_patients(id) ON DELETE SET NULL,
  local_mr_number TEXT,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  consent_given BOOLEAN DEFAULT FALSE,
  consent_given_at TIMESTAMPTZ,
  UNIQUE(user_id, hospital_id)
);

-- Enable RLS
ALTER TABLE public.patient_hospital_links ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_hospital_links_user 
  ON public.patient_hospital_links(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_hospital_links_hospital 
  ON public.patient_hospital_links(hospital_id);

-- ============================================
-- 6. RLS POLICIES FOR PATIENT_HOSPITAL_LINKS
-- ============================================

-- Patients can view their own links
DROP POLICY IF EXISTS "Patients can view own hospital links" ON public.patient_hospital_links;
CREATE POLICY "Patients can view own hospital links"
  ON public.patient_hospital_links FOR SELECT
  USING (user_id = auth.uid());

-- Hospitals can view links where they are the hospital
DROP POLICY IF EXISTS "Hospitals can view own patient links" ON public.patient_hospital_links;
CREATE POLICY "Hospitals can view own patient links"
  ON public.patient_hospital_links FOR SELECT
  USING (hospital_id = auth.uid());

-- Hospitals can create links for their patients
DROP POLICY IF EXISTS "Hospitals can create patient links" ON public.patient_hospital_links;
CREATE POLICY "Hospitals can create patient links"
  ON public.patient_hospital_links FOR INSERT
  WITH CHECK (hospital_id = auth.uid());

-- Patients can update consent on their own links
DROP POLICY IF EXISTS "Patients can update consent" ON public.patient_hospital_links;
CREATE POLICY "Patients can update consent"
  ON public.patient_hospital_links FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 7. HELPER FUNCTION: LOOKUP PATIENT BY PHONE
-- ============================================

CREATE OR REPLACE FUNCTION find_patient_by_phone(phone_number TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  beanhealth_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.name, u.email, u.beanhealth_id
  FROM public.users u
  WHERE u.role = 'patient'
  AND EXISTS (
    -- Check if phone matches in users table or any hospital_patients record
    SELECT 1 FROM public.hospital_patients hp 
    WHERE hp.linked_user_id = u.id 
    AND hp.phone = phone_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. BACKFILL EXISTING PATIENTS WITH BHID
-- ============================================

-- Generate BHIDs for existing patients who don't have one
UPDATE public.users
SET beanhealth_id = generate_beanhealth_id()
WHERE role = 'patient' 
AND beanhealth_id IS NULL;

-- ============================================
-- 9. VERIFICATION
-- ============================================

-- Check that columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'beanhealth_id';

-- Check patient_hospital_links table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'patient_hospital_links';

-- Show sample BHIDs generated
SELECT name, email, beanhealth_id 
FROM public.users 
WHERE role = 'patient' 
AND beanhealth_id IS NOT NULL 
LIMIT 5;
