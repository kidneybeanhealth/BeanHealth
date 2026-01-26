-- Migration: Add extended patient fields
-- Run this in Supabase SQL Editor

-- Add new columns to hospital_patients table
ALTER TABLE hospital_patients 
ADD COLUMN IF NOT EXISTS father_husband_name TEXT,
ADD COLUMN IF NOT EXISTS place TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create index for faster phone lookups
CREATE INDEX IF NOT EXISTS idx_hospital_patients_phone ON hospital_patients(phone);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hospital_patients' 
AND column_name IN ('father_husband_name', 'place', 'phone');
