-- CRITICAL FIX: Restore missing doctor to Hospital 2
-- Root cause: 20260215_fix_doctor_duplication.sql merged doctors across hospitals
--
-- Current broken state:
--   Hospital 1 (1fd98796...) has: Dr.A.Prabhakar (15bfa890...) + Dr. A. Divakar (eb3e7817...)
--   Hospital 2 (50ae939b...) has: Dr.A.Divakar (5c4e411d...) ONLY — Prabhakar is MISSING
--
-- Expected state (per add_doctors.sql):
--   Hospital 2 (50ae939b...) should have BOTH: Dr.A.Prabhakar + Dr.A.Divakar

BEGIN;

-- Step 1: Restore Dr.A.Prabhakar to Hospital 2
-- Use the SAME access code as originally set in add_doctors.sql
INSERT INTO public.hospital_doctors (hospital_id, name, specialty, access_code, is_active)
VALUES (
    '50ae939b-8a54-47a4-99bc-88ccb24ef459',
    'Dr.A.Prabhakar',
    'Nephrology',
    'Prabhakar123',
    true
)
ON CONFLICT (hospital_id, name) DO NOTHING;  -- Safety: won't duplicate if already there

-- Step 2: Verify the restoration
-- (Run this SELECT after the INSERT to confirm)
-- SELECT id, hospital_id, name, specialty, is_active, signature_url
-- FROM public.hospital_doctors 
-- WHERE hospital_id = '50ae939b-8a54-47a4-99bc-88ccb24ef459';

COMMIT;
