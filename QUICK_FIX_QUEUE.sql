-- ====================================================================
-- QUICK FIX: Run this immediately to clear yesterday's patients
-- ====================================================================
-- Copy this entire script and paste it into Supabase SQL Editor
-- Then click "Run" or press Ctrl/Cmd + Enter
-- ====================================================================

-- Step 1: Mark all old pending/in_progress records as completed
UPDATE public.hospital_queues 
SET status = 'completed',
    updated_at = NOW()
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
FROM public.hospital_queues
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
FROM public.hospital_queues
WHERE created_at < CURRENT_DATE;

-- ====================================================================
-- Expected Result:
-- - TODAY: Shows only today's queue records
-- - YESTERDAY & BEFORE: pending and in_progress should be 0
-- ====================================================================
