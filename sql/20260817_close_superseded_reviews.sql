-- =============================================================================
-- A visit closes every review it satisfies, not just the prescribing doctor's
-- =============================================================================
-- THE BUG
-- -------
-- hospital_patient_reviews rows are per doctor, and the review-sync trigger only
-- ever touches the row for the prescribing doctor. Every OTHER open review for
-- that patient is left untouched — so a second doctor's review, or a
-- reception-created unassigned one, sits 'pending' forever and quietly ages into
-- overdue while the patient attends perfectly normally.
--
--   KNH/26/012858  live 16 Oct (Dr A) · stale 06 Jul (Dr B), never closed
--                  — seen 13 Jul and twice on 17 Aug
--   KNH/26/009448  live 19 Aug (Dr A) · stale 05 Jun (unassigned, reception)
--                  — admitted and discharged 17 Aug
--
-- Both showed an "Upcoming" badge while sitting in the Missed Followup list: the
-- badge reads the collapsed per-patient category, the list matches any doctor's.
--
-- THE RULE
-- --------
-- A visit completes every open review whose date it has already reached:
--
--     next_review_date <= the visit's local date
--
-- The bound matters. Closing ALL open reviews would erase a genuine future
-- appointment — a patient can legitimately see Dr A today and still be booked
-- with Dr B next month. Only reviews already due are satisfied by walking in.
--
-- Compared in Asia/Kolkata. Prescriptions are written in the afternoon and
-- evening IST, which is already the NEXT day in UTC; comparing raw would close
-- reviews a day early.
--
-- BASED ON sql/20260627_fix_review_trigger_per_doctor.sql, which is the CURRENT
-- definition of this function — not the original in
-- supabase/migrations/20260213_enterprise_review_tracking.sql. That earlier
-- version inserts a colliding row and was already replaced; re-applying it would
-- bring back "duplicate key value violates idx_unique_active_review_per_doctor"
-- on every prescription send.
--
-- Restructured to IF/ELSE so the new close runs on BOTH paths — a prescription
-- written without a review date is still a visit, and still satisfies whatever
-- was already due. The original had two early RETURNs that would have skipped it.
--
-- Safe to re-run: CREATE OR REPLACE, and the backfill only touches open rows.
-- Date: 2026-08-17
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_hospital_review_from_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_id UUID;
    v_visit_date DATE := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
    IF NEW.next_review_date IS NULL THEN
        -- Review date removed → cancel this prescription's own review cycle.
        UPDATE public.hospital_patient_reviews
        SET
            next_review_date = NULL,
            tests_to_review = NEW.tests_to_review,
            specialists_to_review = NEW.specialists_to_review,
            status = 'cancelled',
            cancelled_at = COALESCE(cancelled_at, now()),
            updated_at = now()
        WHERE source_prescription_id = NEW.id;
    ELSE
        -- Reuse the existing ACTIVE review for this (hospital, patient, doctor).
        -- Repoints it to the latest prescription instead of inserting a row that
        -- would collide with idx_unique_active_review_per_doctor.
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

        IF v_updated_id IS NULL THEN
            -- No active review for this patient+doctor → create one. Idempotent on
            -- source_prescription_id so reprocessing updates in place.
            INSERT INTO public.hospital_patient_reviews (
                hospital_id, patient_id, doctor_id, source_prescription_id, source_queue_id,
                next_review_date, tests_to_review, specialists_to_review, status
            )
            VALUES (
                NEW.hospital_id, NEW.patient_id, NEW.doctor_id, NEW.id, NEW.queue_id,
                NEW.next_review_date, NEW.tests_to_review, NEW.specialists_to_review, 'pending'
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
        END IF;
    END IF;

    -- NEW: the visit satisfies every OTHER review already due — the second
    -- doctor's, and reception-created unassigned ones (source_prescription_id
    -- NULL, which IS DISTINCT FROM NEW.id, so they are included).
    -- Only ever sets 'completed', which removes rows from the partial active-review
    -- index rather than adding to it, so this can never cause a unique violation.
    UPDATE public.hospital_patient_reviews r
    SET
        status = 'completed',
        completed_at = COALESCE(r.completed_at, NEW.created_at, now()),
        updated_at = now()
    WHERE r.hospital_id = NEW.hospital_id
      AND r.patient_id = NEW.patient_id
      AND r.source_prescription_id IS DISTINCT FROM NEW.id
      AND r.status IN ('pending', 'rescheduled')
      AND r.next_review_date IS NOT NULL
      AND r.next_review_date <= v_visit_date;

    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Backfill: close the stale reviews already sitting in the table
-- -----------------------------------------------------------------------------
-- Same rule applied to history. completed_at is set to the visit that actually
-- satisfied the review, not now() — so the record reads truthfully, and the
-- "Review Completed" chip (which shows completions from the last two days) isn't
-- flooded with months-old reviews the moment this runs.
UPDATE public.hospital_patient_reviews r
SET
    status = 'completed',
    completed_at = COALESCE(r.completed_at, satisfying_visit.visited_at),
    updated_at = now()
FROM (
    SELECT
        rev.id AS review_id,
        MIN(p.created_at) AS visited_at
    FROM public.hospital_patient_reviews rev
    JOIN public.hospital_prescriptions p
      ON p.patient_id = rev.patient_id
     AND p.hospital_id = rev.hospital_id
     AND (p.created_at AT TIME ZONE 'Asia/Kolkata')::date >= rev.next_review_date
    WHERE rev.status IN ('pending', 'rescheduled')
      AND rev.next_review_date IS NOT NULL
    GROUP BY rev.id
) satisfying_visit
WHERE r.id = satisfying_visit.review_id;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- BEFORE / AFTER (run these separately, around the migration)
-- =============================================================================
-- How many stale reviews exist, and who they belong to:
--
-- SELECT hp.name, hp.mr_number, r.next_review_date, r.status,
--        COALESCE(d.name, 'Unassigned') AS doctor
-- FROM public.hospital_patient_reviews r
-- JOIN public.hospital_patients hp ON hp.id = r.patient_id
-- LEFT JOIN public.hospital_doctors d ON d.id = r.doctor_id
-- WHERE r.status IN ('pending','rescheduled')
--   AND r.next_review_date IS NOT NULL
--   AND EXISTS (
--       SELECT 1 FROM public.hospital_prescriptions p
--       WHERE p.patient_id = r.patient_id
--         AND (p.created_at AT TIME ZONE 'Asia/Kolkata')::date >= r.next_review_date
--   )
-- ORDER BY r.next_review_date;
--
-- Run it again afterwards: it must return ZERO rows.
