-- =============================================================================
-- A visit supersedes every review assigned before it
-- =============================================================================
-- Supersedes sql/20260817_close_superseded_reviews.sql, which compared the
-- review's DATE against the visit date. That missed reviews scheduled earlier the
-- same day for a FUTURE date and then overtaken by the doctor's actual decision.
--
-- CONSEQUENCE WORTH KNOWING: this also closes the OTHER doctor's open review when
-- a patient is seen. At KKC that is intended — two doctors, cross-referrals
-- finished the same day, and the last doctor to see the patient sets the plan. It
-- would be wrong at a site where departments book independently months ahead.
--
-- Built on 20260627 (per-doctor repoint) and 20260817. Do NOT rebuild from
-- supabase/migrations/20260213_*, which inserts a colliding row and was replaced.
--
-- Safe to re-run.
-- Date: 2026-08-19
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

    -- The visit supersedes every review ASSIGNED BEFORE IT.
    --
    -- This previously closed only reviews whose DATE had already passed, which left
    -- a whole class untouched: KNH/26/017766 was discharged at 11:20 with a
    -- placeholder review for 20 Aug, then seen by the doctor at 14:44 who set
    -- 08 Sept. The 20 Aug row survived — its date was in the future — and dragged
    -- him into Due Tomorrow while the badge showed the real 08 Sept date.
    --
    -- The doctor who saw the patient last has the full picture, so anything
    -- scheduled before that consultation is stale, whatever date it carried.
    -- Compared on created_at, not on next_review_date.
    --
    -- 'completed' when the review's own date had already arrived (the visit
    -- genuinely satisfied it); 'cancelled' when it had not (the visit replaced a
    -- plan that never came due). Identical effect on every list, but the record
    -- then reads truthfully.
    UPDATE public.hospital_patient_reviews r
    SET
        status = CASE
            WHEN r.next_review_date IS NOT NULL AND r.next_review_date <= v_visit_date
                THEN 'completed' ELSE 'cancelled' END,
        completed_at = CASE
            WHEN r.next_review_date IS NOT NULL AND r.next_review_date <= v_visit_date
                THEN COALESCE(r.completed_at, NEW.created_at, now()) ELSE r.completed_at END,
        cancelled_at = CASE
            WHEN r.next_review_date IS NULL OR r.next_review_date > v_visit_date
                THEN COALESCE(r.cancelled_at, NEW.created_at, now()) ELSE r.cancelled_at END,
        updated_at = now()
    WHERE r.hospital_id = NEW.hospital_id
      AND r.patient_id = NEW.patient_id
      AND r.source_prescription_id IS DISTINCT FROM NEW.id
      AND r.status IN ('pending', 'rescheduled')
      -- Strictly before. Equal timestamps mean the row IS the one this visit just
      -- created or repointed in the branch above.
      AND r.created_at < COALESCE(NEW.created_at, now());

    RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── VERIFY ───────────────────────────────────────────────────────────────────
-- Send ONE test prescription right after applying, then confirm its review row
-- carries the new date and no older review for that patient is still pending:
--
-- SELECT r.next_review_date, r.status, r.created_at
-- FROM public.hospital_patient_reviews r
-- JOIN public.hospital_patients hp ON hp.id = r.patient_id
-- WHERE hp.mr_number = '<test patient>' ORDER BY r.created_at DESC;
