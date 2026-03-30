-- ====================================================================
-- Automatic Daily Queue Cleanup Function
-- ====================================================================
-- This creates a PostgreSQL function that automatically marks old
-- queue records as completed at midnight every day
-- ====================================================================

-- Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_queue_records()
RETURNS void AS $$
BEGIN
    -- Mark all pending/in_progress records from previous days as completed
    UPDATE public.hospital_queues
    SET status = 'completed',
        updated_at = NOW()
    WHERE created_at < CURRENT_DATE
      AND status IN ('pending', 'in_progress');
    
    -- Log the cleanup
    RAISE NOTICE 'Queue cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- Optional: Create a cron job to run this daily at midnight
-- ====================================================================
-- Note: This requires the pg_cron extension
-- You may need to enable it in Supabase dashboard first
-- Uncomment the following lines if you want automatic daily cleanup:

-- Enable pg_cron extension (run this in Supabase SQL editor)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at midnight UTC
-- SELECT cron.schedule(
--     'daily-queue-cleanup',
--     '0 0 * * *',  -- Runs at midnight UTC every day
--     $$SELECT cleanup_old_queue_records()$$
-- );

-- ====================================================================
-- Manual execution
-- ====================================================================
-- To run the cleanup manually, execute:
SELECT cleanup_old_queue_records();

-- ====================================================================
-- Verify cleanup
-- ====================================================================
SELECT 
    'Today' as period,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_queues
WHERE created_at >= CURRENT_DATE

UNION ALL

SELECT 
    'Yesterday & Earlier' as period,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_queues
WHERE created_at < CURRENT_DATE;
