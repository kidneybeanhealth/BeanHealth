-- ====================================================================
-- PHARMACY COMPLETE FIX - Run this ONCE in Supabase SQL Editor
-- ====================================================================

-- STEP 1: Clear all old/dispensed patients from display immediately
UPDATE public.hospital_pharmacy_queue 
SET status = 'dispensed'
WHERE status IN ('waiting', 'calling');

-- STEP 2: Verify display is now empty
SELECT 
    status, 
    COUNT(*) as count 
FROM public.hospital_pharmacy_queue 
GROUP BY status;

-- ====================================================================
-- EXPECTED RESULT: 'waiting' and 'calling' should show 0 count
-- The display queue is now empty and ready for today's patients!
-- 
-- CODE FIX APPLIED: The "Mark as Dispensed" button now also removes
-- patients from the display queue automatically.
-- No more stale patients tomorrow!
-- ====================================================================
