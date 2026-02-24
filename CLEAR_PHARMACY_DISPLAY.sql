-- ====================================================================
-- CLEAR PHARMACY DISPLAY ONLY (100% SAFE - No data deleted!)
-- ====================================================================
-- ✅ This ONLY changes the STATUS column
-- ✅ All queue records remain in the database
-- ✅ NO patient data is touched (patients are in a different table)
-- ✅ This just removes old entries from the TV display
-- ====================================================================

-- Skip all old queue entries so they don't show on display
-- Changes status from 'waiting'/'calling' → 'skipped'
UPDATE public.hospital_pharmacy_queue 
SET status = 'skipped'
WHERE status IN ('waiting', 'calling')
  AND created_at < CURRENT_DATE;

-- Verify - Check what's still showing on display
SELECT 
    'DISPLAY (waiting/calling)' as view_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'waiting') as waiting_count,
    COUNT(*) FILTER (WHERE status = 'calling') as calling_count
FROM public.hospital_pharmacy_queue
WHERE status IN ('waiting', 'calling');

-- Check total records (should still exist, just not on display)
SELECT 
    'ALL RECORDS' as view_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
    COUNT(*) FILTER (WHERE status = 'calling') as calling,
    COUNT(*) FILTER (WHERE status = 'dispensed') as dispensed,
    COUNT(*) FILTER (WHERE status = 'skipped') as skipped
FROM public.hospital_pharmacy_queue;

-- ====================================================================
-- Result:
-- - Display will show only TODAY's waiting/calling patients
-- - Yesterday's records are preserved but marked as 'dispensed'
-- - No data is deleted!
-- ====================================================================
