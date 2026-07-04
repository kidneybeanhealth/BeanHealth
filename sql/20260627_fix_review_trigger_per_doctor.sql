-- ============================================================================
-- Fix: prescription send fails with
--   "duplicate key value violates unique constraint idx_unique_active_review_per_doctor"
-- ============================================================================
-- Root cause
-- ----------
-- The AFTER INSERT/UPDATE trigger `sync_hospital_review_from_prescription` on
-- hospital_prescriptions inserts a follow-up review row keyed only on
--   ON CONFLICT (source_prescription_id)
-- But a second rule, idx_unique_active_review_per_doctor, allows only ONE active
-- (pending/rescheduled) review per (hospital_id, patient_id, doctor_id).
--
-- When a patient already has an ACTIVE review from an EARLIER prescription under
-- the same doctor, saving a new dated prescription makes the trigger INSERT a new
-- review (new source_prescription_id, so the ON CONFLICT clause does not fire),
-- which then collides with the per-doctor active-review index. That unhandled
-- collision aborts the whole prescription-send transaction.
--
-- Fix
-- ----------
-- Before inserting, reuse (repoint) the patient+doctor's existing active review to
-- the latest prescription. Only insert a brand-new review when none is active.
-- This respects idx_unique_active_review_per_doctor and mirrors what the working
-- edit-and-resend path already does on the client.
--
-- Safe to run once; no data cleanup required (failed sends rolled back cleanly).
-- Only the function body changes — the existing trigger keeps pointing at it.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_hospital_review_from_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_id UUID;
BEGIN
    -- Review date removed → cancel this prescription's own review cycle (unchanged).
    IF NEW.next_review_date IS NULL THEN
        UPDATE public.hospital_patient_reviews
        SET
            next_review_date = NULL,
            tests_to_review = NEW.tests_to_review,
            specialists_to_review = NEW.specialists_to_review,
            status = 'cancelled',
            cancelled_at = COALESCE(cancelled_at, now()),
            updated_at = now()
        WHERE source_prescription_id = NEW.id;
        RETURN NEW;
    END IF;

    -- Reuse the existing ACTIVE review for this (hospital, patient, doctor), if any.
    -- Repoints it to the latest prescription instead of inserting a colliding row.
    UPDATE public.hospital_patient_reviews
    SET
        source_prescription_id = NEW.id,
        source_queue_id = NEW.queue_id,
        next_review_date = NEW.next_review_date,
        tests_to_review = NEW.tests_to_review,
        specialists_to_review = NEW.specialists_to_review,
        status = CASE WHEN status = 'rescheduled' THEN 'rescheduled' ELSE 'pending' END,
        cancelled_at = NULL,
        completed_at = NULL,
        updated_at = now()
    WHERE hospital_id = NEW.hospital_id
      AND patient_id = NEW.patient_id
      AND doctor_id = NEW.doctor_id
      AND status IN ('pending', 'rescheduled')
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- No active review for this patient+doctor → create one. Kept idempotent on
    -- source_prescription_id so re-processing the same prescription updates in place.
    INSERT INTO public.hospital_patient_reviews (
        hospital_id,
        patient_id,
        doctor_id,
        source_prescription_id,
        source_queue_id,
        next_review_date,
        tests_to_review,
        specialists_to_review,
        status
    )
    VALUES (
        NEW.hospital_id,
        NEW.patient_id,
        NEW.doctor_id,
        NEW.id,
        NEW.queue_id,
        NEW.next_review_date,
        NEW.tests_to_review,
        NEW.specialists_to_review,
        'pending'
    )
    ON CONFLICT (source_prescription_id)
    DO UPDATE SET
        hospital_id = EXCLUDED.hospital_id,
        patient_id = EXCLUDED.patient_id,
        doctor_id = EXCLUDED.doctor_id,
        source_queue_id = EXCLUDED.source_queue_id,
        next_review_date = EXCLUDED.next_review_date,
        tests_to_review = EXCLUDED.tests_to_review,
        specialists_to_review = EXCLUDED.specialists_to_review,
        status = CASE
            WHEN public.hospital_patient_reviews.status IN ('completed', 'cancelled') THEN public.hospital_patient_reviews.status
            ELSE CASE
                WHEN public.hospital_patient_reviews.status = 'rescheduled' THEN 'rescheduled'
                ELSE 'pending'
            END
        END,
        updated_at = now();

    RETURN NEW;
END;
$$;
