-- ====================================================================
-- BeanHealth Queue Cleanup Script
-- ====================================================================
-- This script clears old queue data (yesterday and earlier) from the
-- hospital queue system. Run this in your Supabase SQL Editor.
-- ====================================================================

-- OPTION 1: Delete all queue records from yesterday and earlier
-- WARNING: This permanently deletes old queue records
-- Uncomment the line below to execute
-- DELETE FROM public.hospital_queues WHERE created_at < CURRENT_DATE;

-- OPTION 2: Mark old queue records as 'completed' instead of deleting
-- This preserves the data but removes them from the active queue
UPDATE public.hospital_queues 
SET status = 'completed'
WHERE created_at < CURRENT_DATE 
  AND status IN ('pending', 'in_progress');

-- OPTION 3: Delete only 'pending' and 'in_progress' from yesterday
-- This keeps completed records for historical purposes
-- DELETE FROM public.hospital_queues 
-- WHERE created_at < CURRENT_DATE 
--   AND status IN ('pending', 'in_progress');

-- ====================================================================
-- Verify the cleanup
-- ====================================================================

-- Check today's queue count
SELECT 
    COUNT(*) as today_total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_queues
WHERE created_at >= CURRENT_DATE;

-- Check yesterday's queue count (should be 0 pending after cleanup)
SELECT 
    COUNT(*) as yesterday_total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_queues
WHERE created_at < CURRENT_DATE;

-- ====================================================================
-- ADDITIONAL: Archive old patient records (Optional)
-- ====================================================================
-- If you want to also clean up old patient records that don't have
-- any queue entries today, you can run this:

-- DELETE FROM public.hospital_patients
-- WHERE id NOT IN (
--     SELECT DISTINCT patient_id 
--     FROM public.hospital_queues 
--     WHERE created_at >= CURRENT_DATE
-- );
