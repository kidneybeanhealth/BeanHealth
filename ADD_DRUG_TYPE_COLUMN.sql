-- Add drug_type column for TAB/CAP/INJ/SYP classification
-- Run this in Supabase SQL Editor

ALTER TABLE hospital_doctor_drugs 
ADD COLUMN IF NOT EXISTS drug_type VARCHAR(10) DEFAULT 'TAB';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'hospital_doctor_drugs' AND column_name = 'drug_type';
