-- FIX: hospital_doctor_drugs Foreign Key Constraint Error
-- Issue: The hospital_id column references 'profiles' table, but hospital accounts are in 'users' table
-- Error: "Key is not present in table profiles" when adding drugs
-- Date: 2026-02-02

-- Step 1: Drop the incorrect foreign key constraint
ALTER TABLE hospital_doctor_drugs
DROP CONSTRAINT IF EXISTS hospital_doctor_drugs_hospital_id_fkey;

-- Step 2 (Optional): If you want to add a correct foreign key to users table, uncomment below:
-- ALTER TABLE hospital_doctor_drugs
-- ADD CONSTRAINT hospital_doctor_drugs_hospital_id_fkey
-- FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE;

-- Verify the fix worked - this should return no constraints referencing 'profiles'
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conrelid = 'hospital_doctor_drugs'::regclass
AND contype = 'f';
