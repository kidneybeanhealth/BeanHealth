-- ====================================================================
-- PHARMACY QUEUE CLEANUP - Run this to clear old pharmacy queue data
-- ====================================================================
-- Copy this entire script and paste it into Supabase SQL Editor
-- Then click "Run" or press Ctrl/Cmd + Enter
-- ====================================================================

-- Step 1: Mark all old pending/in_progress pharmacy queue records as completed
UPDATE public.hospital_pharmacy_queue 
SET status = 'completed'
WHERE created_at < CURRENT_DATE 
  AND status IN ('pending', 'in_progress');

-- Step 2: Verify the fix - check counts
SELECT 
    'TODAY' as period,
    DATE(created_at)::text as date,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_pharmacy_queue
WHERE created_at >= CURRENT_DATE
GROUP BY DATE(created_at)

UNION ALL

SELECT 
    'YESTERDAY & BEFORE' as period,
    'older' as date,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_pharmacy_queue
WHERE created_at < CURRENT_DATE;

-- ====================================================================
-- Expected Result:
-- - TODAY: Shows only today's pharmacy queue records
-- - YESTERDAY & BEFORE: pending and in_progress should be 0
-- ====================================================================

-- ====================================================================
-- OPTIONAL: If you want to COMPLETELY DELETE old pharmacy queue records
-- Uncomment the line below (remove the -- at the start)
-- ====================================================================
-- DELETE FROM public.hospital_pharmacy_queue WHERE created_at < CURRENT_DATE;
