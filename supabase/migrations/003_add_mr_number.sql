-- Migration: Add MR Number field to hospital_patients
-- Run this in Supabase SQL Editor

-- Add mr_number column to hospital_patients table
ALTER TABLE hospital_patients 
ADD COLUMN IF NOT EXISTS mr_number TEXT;

-- Create index for faster MR number lookups
CREATE INDEX IF NOT EXISTS idx_hospital_patients_mr_number ON hospital_patients(mr_number);

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hospital_patients' 
AND column_name = 'mr_number';
