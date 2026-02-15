-- Migration: Sync hospital patient reviews on status change and ensure cleanup
-- Created: 2026-02-15
-- Objectives: 
-- 1. Automatically mark review as 'completed' when prescription is marked 'dispensed'.
-- 2. Automatically mark 'pending' or 'rescheduled' reviews as 'completed' when a NEW prescription is created for the same patient.

BEGIN;

-- 1. Update the trigger function
CREATE OR REPLACE FUNCTION public.sync_hospital_review_from_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If review date is removed, cancel existing review cycle for this prescription.
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

    -- Scenario: Prescription is being dispensed
    IF NEW.status = 'dispensed' THEN
        UPDATE public.hospital_patient_reviews
        SET
            status = 'completed',
            completed_at = now(),
            updated_at = now()
        WHERE source_prescription_id = NEW.id;
        -- We continue to update/insert the review details below to keep them in sync
    END IF;

    -- Scenario: NEW prescription is created (Insert)
    -- We want to "close" any older pending reviews for this patient so they don't stay in "Track Patients" list.
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.hospital_patient_reviews
        SET 
            status = 'completed',
            completed_at = now(),
            updated_at = now()
        WHERE patient_id = NEW.patient_id
          AND id != id -- Safety for recursive trigger logic (though we use source_prescription_id for current)
          AND source_prescription_id != NEW.id
          AND status IN ('pending', 'rescheduled');
    END IF;

    INSERT INTO public.hospital_patient_reviews (
        hospital_id,
        patient_id,
        doctor_id,
        source_prescription_id,
        source_queue_id,
        next_review_date,
        tests_to_review,
        specialists_to_review,
        status,
        completed_at
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
        CASE 
            WHEN NEW.status = 'dispensed' THEN 'completed'::text
            ELSE 'pending'::text
        END,
        CASE 
            WHEN NEW.status = 'dispensed' THEN now()
            ELSE NULL
        END
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
            WHEN NEW.status = 'dispensed' THEN 'completed'
            WHEN public.hospital_patient_reviews.status IN ('completed', 'cancelled') THEN public.hospital_patient_reviews.status
            ELSE CASE
                WHEN public.hospital_patient_reviews.status = 'rescheduled' THEN 'rescheduled'
                ELSE 'pending'
            END
        END,
        completed_at = CASE 
            WHEN NEW.status = 'dispensed' THEN now()
            ELSE public.hospital_patient_reviews.completed_at
        END,
        updated_at = now();

    RETURN NEW;
END;
$$;

-- 2. Re-create the trigger to also listen for status changes
DROP TRIGGER IF EXISTS trg_sync_hospital_review_from_prescription ON public.hospital_prescriptions;
CREATE TRIGGER trg_sync_hospital_review_from_prescription
AFTER INSERT OR UPDATE OF queue_id, status, next_review_date, tests_to_review, specialists_to_review
ON public.hospital_prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_hospital_review_from_prescription();

COMMIT;
