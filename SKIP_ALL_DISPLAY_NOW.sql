-- ====================================================================
-- SKIP ALL PATIENTS ON DISPLAY RIGHT NOW (Safe - No data deleted!)
-- ====================================================================
-- ✅ This marks ALL 'waiting'/'calling' as 'skipped'
-- ✅ Clears the entire pharmacy display immediately
-- ✅ NO patient data is deleted - just status change
-- ====================================================================

-- Skip ALL queue entries currently on display (regardless of date)
UPDATE public.hospital_pharmacy_queue 
SET status = 'skipped'
WHERE status IN ('waiting', 'calling');

-- Verify display is now empty
SELECT 
    COUNT(*) as still_on_display 
FROM public.hospital_pharmacy_queue 
WHERE status IN ('waiting', 'calling');

-- ====================================================================
-- Result: still_on_display should be 0
-- The pharmacy display will now be completely clear
-- ====================================================================
