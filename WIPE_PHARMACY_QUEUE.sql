-- ====================================================================
-- WIPE PHARMACY QUEUE COMPLETELY - Deletes ALL records
-- ====================================================================
-- Run this in Supabase SQL Editor
-- This will completely clear the pharmacy display
-- ====================================================================

-- DELETE ALL PHARMACY QUEUE RECORDS (regardless of date)
DELETE FROM public.hospital_pharmacy_queue;

-- Verify it's empty
SELECT COUNT(*) as remaining_records FROM public.hospital_pharmacy_queue;

-- ====================================================================
-- Result should show: remaining_records = 0
-- The pharmacy display will now be completely empty
-- New patients added today will show up as they are registered
-- ====================================================================
