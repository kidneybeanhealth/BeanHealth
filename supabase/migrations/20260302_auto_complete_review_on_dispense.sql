-- Migration: Auto-complete patient review when prescription is dispensed on scheduled day
-- Purpose: When pharmacy dispenses a prescription on the patient's review date,
--          automatically mark that review as completed — no manual action needed.
-- Also backfills existing records where dispense already happened on the review date.

-- ============================================================================
-- STEP 1: Update pharmacy_mark_dispensed RPC to auto-complete reviews
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pharmacy_mark_dispensed(
    p_prescription_id UUID,
    p_dispensing_days INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Update prescription status
    UPDATE public.hospital_prescriptions
    SET
        status = 'dispensed',
        dispensed_days = CASE WHEN p_dispensing_days > 0 THEN p_dispensing_days ELSE NULL END,
        dispensed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_prescription_id;

    -- 2. Update pharmacy queue status
    UPDATE public.hospital_pharmacy_queue
    SET
        status = 'dispensed'
    WHERE prescription_id = p_prescription_id;

    -- 3. Auto-complete any pending/rescheduled review for this patient due today
    --    (patient came in on their scheduled review day and got their medicines)
    UPDATE public.hospital_patient_reviews r
    SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    FROM public.hospital_prescriptions p
    WHERE
        p.id = p_prescription_id
        AND r.hospital_id = p.hospital_id
        AND r.patient_id = p.patient_id
        AND r.next_review_date = CURRENT_DATE
        AND r.status IN ('pending', 'rescheduled');
END;
$$;

-- Grant permissions (same as original)
REVOKE ALL ON FUNCTION public.pharmacy_mark_dispensed(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_mark_dispensed(UUID, INTEGER) TO authenticated;


-- ============================================================================
-- STEP 2: Backfill — complete existing reviews where dispense already happened
--         on the patient's scheduled review date
-- ============================================================================
UPDATE public.hospital_patient_reviews r
SET
    status = 'completed',
    completed_at = p.dispensed_at,
    updated_at = NOW()
FROM public.hospital_prescriptions p
WHERE
    r.hospital_id = p.hospital_id
    AND r.patient_id = p.patient_id
    AND r.next_review_date = DATE(p.dispensed_at AT TIME ZONE 'UTC')
    AND r.status IN ('pending', 'rescheduled')
    AND p.status = 'dispensed'
    AND p.dispensed_at IS NOT NULL;
