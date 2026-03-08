-- BeanHealth ID for Enterprise Patients
-- Adds BHID directly to hospital_patients since reception is the primary entry point
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. ADD BEANHEALTH_ID TO HOSPITAL_PATIENTS
-- ============================================

ALTER TABLE public.hospital_patients 
  ADD COLUMN IF NOT EXISTS beanhealth_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_hospital_patients_beanhealth_id 
  ON public.hospital_patients(beanhealth_id) WHERE beanhealth_id IS NOT NULL;

-- ============================================
-- 2. BHID GENERATION FOR HOSPITAL PATIENTS
-- ============================================
-- Reuses generate_beanhealth_id() but checks BOTH tables for uniqueness

CREATE OR REPLACE FUNCTION generate_hospital_beanhealth_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  i INTEGER;
  attempts INTEGER := 0;
BEGIN
  LOOP
    result := 'BH-';
    FOR i IN 1..6 LOOP
      result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    END LOOP;
    result := result || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    -- Check uniqueness across BOTH tables
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE beanhealth_id = result)
       AND NOT EXISTS (SELECT 1 FROM public.hospital_patients WHERE beanhealth_id = result) THEN
      EXIT;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique BeanHealth ID';
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. AUTO-GENERATE BHID ON NEW PATIENT INSERT
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_hospital_patient_bhid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.beanhealth_id IS NULL THEN
    NEW.beanhealth_id := generate_hospital_beanhealth_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_hospital_patient_bhid ON public.hospital_patients;

CREATE TRIGGER trigger_hospital_patient_bhid
  BEFORE INSERT ON public.hospital_patients
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_hospital_patient_bhid();

-- ============================================
-- 4. BACKFILL EXISTING HOSPITAL PATIENTS
-- ============================================

UPDATE public.hospital_patients
SET beanhealth_id = generate_hospital_beanhealth_id()
WHERE beanhealth_id IS NULL;

-- ============================================
-- 5. VERIFICATION
-- ============================================

SELECT name, mr_number, token_number, beanhealth_id 
FROM public.hospital_patients 
ORDER BY created_at DESC 
LIMIT 10;
