-- Fix 1: Enable realtime on hospital_patient_reviews
-- Required for TrackPatientsPage realtime subscription to work
ALTER PUBLICATION supabase_realtime ADD TABLE hospital_patient_reviews;

-- Fix 2: Update pharmacy_mark_dispensed to auto-complete overdue reviews (not just today's)
-- Change: next_review_date = CURRENT_DATE  →  next_review_date <= CURRENT_DATE
CREATE OR REPLACE FUNCTION public.pharmacy_mark_dispensed(
    p_prescription_id UUID,
    p_dispensing_days INTEGER DEFAULT 0
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- 1. Update prescription status
    UPDATE public.hospital_prescriptions
    SET status = 'dispensed',
        dispensed_days = CASE WHEN p_dispensing_days > 0 THEN p_dispensing_days ELSE NULL END,
        dispensed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_prescription_id;

    -- 2. Update pharmacy queue status
    UPDATE public.hospital_pharmacy_queue
    SET status = 'dispensed'
    WHERE prescription_id = p_prescription_id;

    -- 3. Auto-complete any pending/rescheduled review due today or overdue for this patient
    UPDATE public.hospital_patient_reviews r
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    FROM public.hospital_prescriptions p
    WHERE p.id = p_prescription_id
        AND r.hospital_id = p.hospital_id
        AND r.patient_id = p.patient_id
        AND r.next_review_date <= CURRENT_DATE   -- was: = CURRENT_DATE
        AND r.status IN ('pending', 'rescheduled');
END;
$$;
