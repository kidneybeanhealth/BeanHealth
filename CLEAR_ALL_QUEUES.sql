-- ====================================================================
-- COMPLETE QUEUE CLEANUP - Clears BOTH Reception AND Pharmacy Queues
-- ====================================================================
-- This script clears old data from BOTH:
-- 1. hospital_queues (Reception Queue)
-- 2. hospital_pharmacy_queue (Pharmacy Queue)
-- ====================================================================

-- ============================================================
-- PART 1: Clean Reception Queue (hospital_queues)
-- ============================================================

-- Mark old reception queue records as completed
UPDATE public.hospital_queues 
SET status = 'completed',
    updated_at = NOW()
WHERE created_at < CURRENT_DATE 
  AND status IN ('pending', 'in_progress');

-- ============================================================
-- PART 2: Clean Pharmacy Queue (hospital_pharmacy_queue)
-- ============================================================

-- Mark old pharmacy queue records as completed
UPDATE public.hospital_pharmacy_queue 
SET status = 'completed'
WHERE created_at < CURRENT_DATE 
  AND status IN ('pending', 'in_progress');

-- ============================================================
-- VERIFICATION - Check both queues
-- ============================================================

-- Reception Queue Status
SELECT 
    'RECEPTION - Today' as queue_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_queues
WHERE created_at >= CURRENT_DATE

UNION ALL

SELECT 
    'RECEPTION - Old' as queue_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_queues
WHERE created_at < CURRENT_DATE

UNION ALL

SELECT 
    'PHARMACY - Today' as queue_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_pharmacy_queue
WHERE created_at >= CURRENT_DATE

UNION ALL

SELECT 
    'PHARMACY - Old' as queue_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_pharmacy_queue
WHERE created_at < CURRENT_DATE;

-- ============================================================
-- Expected Results:
-- - All "Old" queues should have 0 pending and 0 in_progress
-- - Only "Today" queues should have active pending/in_progress
-- ============================================================
