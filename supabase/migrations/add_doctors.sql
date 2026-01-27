-- Add Doctors to Enterprise Account
-- Hospital ID: 50ae939b-8a54-47a4-99bc-88ccb24ef459
-- Run this in Supabase SQL Editor

-- Step 1: Remove ALL existing doctors for this hospital
DELETE FROM public.hospital_doctors 
WHERE hospital_id = '50ae939b-8a54-47a4-99bc-88ccb24ef459';

-- Step 2: Add new doctors
INSERT INTO public.hospital_doctors (hospital_id, name, specialty, access_code, is_active)
VALUES 
  -- Add your doctors below. Change names, specialties, and access codes as needed.
  ('50ae939b-8a54-47a4-99bc-88ccb24ef459', 'Dr.A.Prabhakar', 'Nephrology', 'Prabhakar123', true),
  ('50ae939b-8a54-47a4-99bc-88ccb24ef459', 'Dr.A.Divakar', 'Urology', 'Divakar123', true);


-- To verify the doctors were added:
-- SELECT * FROM public.hospital_doctors WHERE hospital_id = '50ae939b-8a54-47a4-99bc-88ccb24ef459';
