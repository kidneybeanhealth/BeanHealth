-- Patient Onboarding Schema Extension
-- This adds support for patient IDs, onboarding flow, and doctor referral codes
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. EXTEND USERS TABLE WITH ONBOARDING FIELDS
-- ====================================================================================================

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS patient_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE, -- For doctors only
  ADD COLUMN IF NOT EXISTS specialty TEXT; -- For doctors

-- Add index for faster referral code lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_patient_id ON public.users(patient_id) WHERE patient_id IS NOT NULL;

-- ============================================
-- 2. CREATE PATIENT ID SEQUENCE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.patient_id_sequence (
  date DATE PRIMARY KEY,
  last_sequence INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.patient_id_sequence ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read, system functions can write
CREATE POLICY "Anyone can read patient ID sequence" ON public.patient_id_sequence
  FOR SELECT USING (true);

-- ============================================
-- 3. PATIENT ID GENERATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION generate_patient_id()
RETURNS TEXT AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  date_str TEXT := TO_CHAR(today_date, 'YYYYMMDD');
  next_seq INTEGER;
  new_patient_id TEXT;
BEGIN
  -- Get and increment sequence for today
  INSERT INTO public.patient_id_sequence (date, last_sequence)
  VALUES (today_date, 1)
  ON CONFLICT (date) DO UPDATE
  SET last_sequence = patient_id_sequence.last_sequence + 1
  RETURNING last_sequence INTO next_seq;
  
  -- Format: P-YYYYMMDD-XXXX
  new_patient_id := 'P-' || date_str || '-' || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN new_patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. DOCTOR REFERRAL CODE GENERATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION generate_doctor_referral_code(specialty_input TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  specialty_code TEXT;
  random_code TEXT;
  new_referral_code TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Map specialties to codes
  specialty_code := CASE
    WHEN specialty_input ILIKE '%nephrolog%' OR specialty_input ILIKE '%kidney%' THEN 'NEPH'
    WHEN specialty_input ILIKE '%cardiolog%' OR specialty_input ILIKE '%heart%' THEN 'CARD'
    WHEN specialty_input ILIKE '%endocrinolog%' THEN 'ENDO'
    WHEN specialty_input ILIKE '%diabet%' THEN 'DIAB'
    WHEN specialty_input ILIKE '%urol%' THEN 'UROL'
    ELSE 'GMED'
  END;
  
  -- Generate unique referral code
  LOOP
    -- Generate random 4-character alphanumeric code
    random_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || RANDOM()::TEXT) FROM 1 FOR 4));
    new_referral_code := 'DR-' || specialty_code || '-' || random_code;
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = new_referral_code) THEN
      EXIT; -- Code is unique, exit loop
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique referral code after 100 attempts';
    END IF;
  END LOOP;
  
  RETURN new_referral_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. AUTO-GENERATE REFERRAL CODE FOR DOCTORS
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_doctor_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if this is a doctor and doesn't have a referral code yet
  IF NEW.role = 'doctor' AND NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_doctor_referral_code(NEW.specialty);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_doctor_referral_code ON public.users;

-- Create trigger on users table for new doctors
CREATE TRIGGER trigger_doctor_referral_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_doctor_code();

-- ============================================
-- 6. HELPER FUNCTION: Get Patient by Referral Code
-- ============================================

CREATE OR REPLACE FUNCTION get_doctor_by_referral_code(code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  specialty TEXT,
  referral_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.name, u.specialty, u.referral_code
  FROM public.users u
  WHERE u.referral_code = UPPER(code)
  AND u.role = 'doctor';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. SAMPLE DATA (For Testing)
-- ============================================

-- Update existing doctors with referral codes
UPDATE public.users
SET referral_code = generate_doctor_referral_code(specialty)
WHERE role = 'doctor' AND referral_code IS NULL;

-- Display generated referral codes for existing doctors
DO $$
DECLARE
  doctor_record RECORD;
BEGIN
  RAISE NOTICE '=== Generated Referral Codes for Existing Doctors ===';
  FOR doctor_record IN 
    SELECT name, specialty, referral_code 
    FROM public.users 
    WHERE role = 'doctor' AND referral_code IS NOT NULL
  LOOP
    RAISE NOTICE 'Dr. %: % (Code: %)', doctor_record.name, COALESCE(doctor_record.specialty, 'General'), doctor_record.referral_code;
  END LOOP;
END $$;

-- ============================================
-- 8. VERIFICATION QUERIES
-- ============================================

-- Check if table and columns were created
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('patient_id', 'full_name', 'gender', 'onboarding_completed', 'referral_code', 'specialty')
ORDER BY column_name;

-- Test patient ID generation (generates 5 sample IDs)
SELECT generate_patient_id() as sample_patient_id
FROM generate_series(1, 5);

-- Display all doctor referral codes
SELECT 
  name as doctor_name,
  COALESCE(specialty, 'General Practice') as specialty, 
  referral_code
FROM public.users
WHERE role = 'doctor' AND referral_code IS NOT NULL
ORDER BY name;
