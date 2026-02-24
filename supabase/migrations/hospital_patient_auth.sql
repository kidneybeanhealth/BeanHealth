-- Hospital Patient Auth
-- Auto-confirms phone-based patient accounts (phantom emails ending in @p.beanhealth.app)
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. AUTO-CONFIRM TRIGGER FOR HOSPITAL PATIENTS
-- ============================================
-- Hospital patients login via phone+name verification. 
-- We create Supabase auth accounts with phantom emails like 9876543210@p.beanhealth.app
-- This trigger auto-confirms them so they can sign in immediately.

CREATE OR REPLACE FUNCTION auto_confirm_hospital_patients()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email LIKE '%@p.beanhealth.app' THEN
    NEW.email_confirmed_at = NOW();
    NEW.confirmation_sent_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_confirm_hospital_patients ON auth.users;

CREATE TRIGGER trigger_auto_confirm_hospital_patients
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_hospital_patients();

-- ============================================
-- 2. HELPER: VERIFY HOSPITAL PATIENT IDENTITY
-- ============================================
-- Called from frontend to verify phone + name before creating auth account

CREATE OR REPLACE FUNCTION verify_hospital_patient(
  p_phone TEXT,
  p_name TEXT
)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  hospital_name TEXT,
  beanhealth_id TEXT,
  mr_number TEXT,
  age INTEGER,
  father_husband_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hp.id AS patient_id,
    hp.name AS patient_name,
    u.name AS hospital_name,
    hp.beanhealth_id,
    hp.mr_number,
    hp.age,
    hp.father_husband_name
  FROM public.hospital_patients hp
  JOIN public.users u ON u.id = hp.hospital_id
  WHERE hp.phone = p_phone
  AND LOWER(TRIM(hp.name)) = LOWER(TRIM(p_name))
  ORDER BY hp.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. HELPER: FIND PATIENTS BY PHONE (for step 1)
-- ============================================
-- Returns patient records matching a phone number (shows name for verification)

CREATE OR REPLACE FUNCTION find_patients_by_phone(p_phone TEXT)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  hospital_name TEXT,
  age INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hp.id AS patient_id,
    hp.name AS patient_name,
    u.name AS hospital_name,
    hp.age,
    hp.created_at
  FROM public.hospital_patients hp
  JOIN public.users u ON u.id = hp.hospital_id
  WHERE hp.phone = p_phone
  ORDER BY hp.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
