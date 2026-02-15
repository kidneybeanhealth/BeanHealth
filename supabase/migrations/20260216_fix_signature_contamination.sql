-- IMMEDIATE FIX: Remove test signature from real hospital's doctor
-- This removes the signature that leaked from the test account

-- Step 1: Clear the test signature from the REAL hospital's Dr.A.Prabhakar
UPDATE public.hospital_doctors
SET signature_url = NULL
WHERE id = '15bfa890-0377-48fa-b736-e04c4c4097b9'  -- Real hospital's Prabhakar
  AND hospital_id = '1fd98796-61ac-4fdb-bd4e-607b7e35e9b1';

-- Verify
SELECT id, hospital_id, name, signature_url
FROM public.hospital_doctors
WHERE hospital_id = '1fd98796-61ac-4fdb-bd4e-607b7e35e9b1';
