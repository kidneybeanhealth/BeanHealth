-- ====================================================================
-- FIX PHARMACY DISPLAY - Keep only waiting patients, sorted by token
-- ====================================================================
-- Run this in Supabase SQL Editor
-- ====================================================================

-- First, check what's currently in the queue
SELECT 
    token_number, 
    patient_name, 
    status, 
    created_at 
FROM public.hospital_pharmacy_queue 
WHERE status IN ('waiting', 'calling')
ORDER BY token_number::int ASC;

-- Mark any patients that have already been dispensed (if they're still showing as 'waiting')
-- If you know specific token numbers that were already dispensed, update them:
-- Example: UPDATE public.hospital_pharmacy_queue SET status = 'dispensed' WHERE token_number IN ('37');

-- To skip ALL currently displayed patients and start fresh:
-- UPDATE public.hospital_pharmacy_queue SET status = 'skipped' WHERE status IN ('waiting', 'calling');

-- ====================================================================
-- If you want to keep specific patients and skip others, tell me which
-- token numbers should remain in the queue, and I'll create the SQL
-- ====================================================================
