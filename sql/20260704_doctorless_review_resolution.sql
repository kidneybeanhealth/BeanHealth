-- ============================================================================
-- Doctor-less review resolution
-- ============================================================================
-- Problem
-- -------
-- Reviews created without a doctor_id (reception-side flows: past-records
-- registration, call-log entries with no doctor) are immune to every
-- visit-resolution mechanism: the prescription trigger completes/repoints
-- only rows matching doctor_id = NEW.doctor_id, and the 20260627 backfill
-- matched r.doctor_id = px.doctor_id. NULL never matches, so doctor-less
-- reviews stay "pending" forever and pollute Missed Followup as immortal
-- overdue entries.
--
-- Fix
-- ---
-- 1. Trigger: ANY new prescription visit also resolves the patient's
--    doctor-less active reviews (completed, dated to the visit).
-- 2. One-time backfill for existing doctor-less rows already satisfied by a
--    later visit.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_hospital_review_from_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_id UUID;
BEGIN
    -- The patient visited: doctor-less reviews (reception-created, no doctor
    -- attached) are satisfied by ANY visit. Runs for both branches below.
    UPDATE public.hospital_patient_reviews
    SET
        status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE hospital_id = NEW.hospital_id
      AND patient_id = NEW.patient_id
      AND doctor_id IS NULL
      AND status IN ('pending', 'rescheduled')
      AND source_prescription_id IS DISTINCT FROM NEW.id;

    IF NEW.next_review_date IS NULL THEN
        -- Review date removed from THIS prescription (edit-resend) → cancel its cycle.
        UPDATE public.hospital_patient_reviews
        SET
            next_review_date = NULL,
            tests_to_review = NEW.tests_to_review,
            specialists_to_review = NEW.specialists_to_review,
            status = 'cancelled',
            cancelled_at = COALESCE(cancelled_at, now()),
            updated_at = now()
        WHERE source_prescription_id = NEW.id;

        -- The visit satisfies this doctor's outstanding review.
        UPDATE public.hospital_patient_reviews
        SET
            status = 'completed',
            completed_at = now(),
            updated_at = now()
        WHERE hospital_id = NEW.hospital_id
          AND patient_id = NEW.patient_id
          AND doctor_id = NEW.doctor_id
          AND status IN ('pending', 'rescheduled')
          AND source_prescription_id IS DISTINCT FROM NEW.id;

        RETURN NEW;
    END IF;

    -- Reuse the existing ACTIVE review for this (hospital, patient, doctor), if any.
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

    -- No active review for this patient+doctor → create one.
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

-- ────────────────────────────────────────────────────────────────────────────
-- One-time backfill: complete doctor-less active reviews already satisfied
-- by a later visit (any doctor). completed_at = that visit's timestamp.
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.hospital_patient_reviews r
SET status = 'completed',
    completed_at = px.created_at,
    updated_at = now()
FROM (
    SELECT DISTINCT ON (p.hospital_id, p.patient_id)
           p.hospital_id, p.patient_id, p.id, p.created_at
    FROM public.hospital_prescriptions p
    WHERE p.patient_id IS NOT NULL
    ORDER BY p.hospital_id, p.patient_id, p.created_at DESC
) px
WHERE r.status IN ('pending', 'rescheduled')
  AND r.doctor_id IS NULL
  AND r.hospital_id = px.hospital_id
  AND r.patient_id = px.patient_id
  AND px.id IS DISTINCT FROM r.source_prescription_id
  AND px.created_at > COALESCE(r.updated_at, r.created_at);
