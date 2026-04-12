-- Migration: Add Patient App Access Control
-- Run this script in your Supabase SQL Editor to enable explicit app access control

-- 1. Add app_access_enabled column to hospital_patients (default false)
ALTER TABLE public.hospital_patients 
ADD COLUMN IF NOT EXISTS app_access_enabled BOOLEAN DEFAULT false;

-- 2. Update find_patients_by_phone to return app_access_enabled
DROP FUNCTION IF EXISTS find_patients_by_phone(TEXT);

CREATE OR REPLACE FUNCTION find_patients_by_phone(p_phone TEXT)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  hospital_name TEXT,
  age INTEGER,
  created_at TIMESTAMPTZ,
  app_access_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hp.id AS patient_id,
    hp.name AS patient_name,
    u.name AS hospital_name,
    hp.age,
    hp.created_at,
    hp.app_access_enabled
  FROM public.hospital_patients hp
  JOIN public.users u ON u.id = hp.hospital_id
  WHERE hp.phone = p_phone
  ORDER BY hp.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update verify_hospital_patient to return app_access_enabled
DROP FUNCTION IF EXISTS verify_hospital_patient(TEXT, TEXT);

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
  father_husband_name TEXT,
  app_access_enabled BOOLEAN
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
    hp.father_husband_name,
    hp.app_access_enabled
  FROM public.hospital_patients hp
  JOIN public.users u ON u.id = hp.hospital_id
  WHERE hp.phone = p_phone
  AND LOWER(TRIM(hp.name)) = LOWER(TRIM(p_name))
  ORDER BY hp.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
