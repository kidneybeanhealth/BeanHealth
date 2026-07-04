-- ============================================================================
-- Early-visit review resolution
-- ============================================================================
-- Problem
-- -------
-- A patient due for review on e.g. 06.07 who walks in early on 04.07 stayed
-- flagged as "due 06.07": if the doctor's new prescription carried no review
-- date, nothing touched the outstanding pending review. The receptionist then
-- calls a patient who already visited, and after the due date the patient
-- shows up as a false "missed follow-up".
--
-- This migration makes the visit itself the ground truth:
--   1. Prescription with NO review date → auto-complete that same doctor's
--      outstanding active review (the visit satisfied it). Per-doctor scoped,
--      so a deliberate two-doctor patient keeps the other doctor's cycle.
--   2. Any queue registration → mark the patient's recent follow-up calls
--      attended=true (calls led to a visit; report stops inferring).
--   3. One-time backfill: complete stale pending reviews where the same
--      doctor already issued a newer prescription after the review was set.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Trigger: prescription without review date completes the doctor's
--    outstanding active review for that patient.
--    (Extends the 20260627 per-doctor fix — WITH-date repointing unchanged.)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_hospital_review_from_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_id UUID;
BEGIN
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

        -- The patient visited: complete this doctor's OTHER outstanding review.
        -- (Early visit satisfies the pending due date — stops false "missed".)
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
-- 2) Trigger: a queue registration marks the patient's recent follow-up
--    calls as attended (call → visit outcome becomes first-class data).
--    30-day window: older calls are unrelated to this visit.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_followup_attended_on_visit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.hospital_patient_followups f
    SET attended = true,
        updated_at = now()
    WHERE f.hospital_id = NEW.hospital_id
      AND f.patient_id = NEW.patient_id
      AND f.attended IS DISTINCT FROM true
      AND f.called_at >= now() - INTERVAL '30 days';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_followup_attended_on_visit ON public.hospital_queues;
CREATE TRIGGER trg_mark_followup_attended_on_visit
AFTER INSERT ON public.hospital_queues
FOR EACH ROW
EXECUTE FUNCTION public.mark_followup_attended_on_visit();

-- ────────────────────────────────────────────────────────────────────────────
-- 3) One-time backfill: close stale pending reviews already satisfied by a
--    newer same-doctor prescription. completed_at = that visit's timestamp,
--    so reports date the completion to the actual early visit.
--    Excludes reviews touched AFTER the newest prescription (deliberate
--    call-log reschedules stay open).
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.hospital_patient_reviews r
SET status = 'completed',
    completed_at = px.created_at,
    updated_at = now()
FROM (
    SELECT DISTINCT ON (p.hospital_id, p.patient_id, p.doctor_id)
           p.hospital_id, p.patient_id, p.doctor_id, p.id, p.created_at
    FROM public.hospital_prescriptions p
    WHERE p.doctor_id IS NOT NULL AND p.patient_id IS NOT NULL
    ORDER BY p.hospital_id, p.patient_id, p.doctor_id, p.created_at DESC
) px
WHERE r.status IN ('pending', 'rescheduled')
  AND r.hospital_id = px.hospital_id
  AND r.patient_id = px.patient_id
  AND r.doctor_id = px.doctor_id
  AND px.id IS DISTINCT FROM r.source_prescription_id
  AND px.created_at > COALESCE(r.updated_at, r.created_at);
