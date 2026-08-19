-- =============================================================================
-- Give every ownerless review an owner, and merge the duplicates that creates
-- =============================================================================
-- Reviews with doctor_id NULL belong to nobody. No visit closes them, they never
-- appear under a doctor's own list, and they drift into false Missed Followups.
-- Four paths created them: the discharge modal, the call-log insert branch, past
-- registration, and Track Patients. All four are fixed in the app alongside this.
--
-- This assigns the existing ones to Dr. A. Prabhakar (the nephrologist, who owns
-- the overwhelming majority of the review workload at KKC).
--
-- THE COLLISION
-- -------------
-- idx_unique_active_review_per_doctor permits ONE active review per
-- (hospital, patient, doctor). A patient with an ownerless review AND a live
-- Prabhakar review would violate it the moment we set the doctor. So this is a
-- MERGE, not an update: the surviving row keeps the LATER of the two dates —
-- the later date is the more recent clinical intent — and the other is cancelled.
--
-- WHAT IS DELIBERATELY LEFT ALONE
-- -------------------------------
-- Reviews owned by the OTHER doctor (Dr. A. Divakar, urology). Those have an
-- owner, a real clinical meaning, and a patient can legitimately be booked with
-- both. Collapsing them into Prabhakar would delete a genuine appointment. Only
-- the ownerless rows move.
--
-- Date: 2026-08-19
-- =============================================================================

-- ── PREVIEW (run first, on its own) ──────────────────────────────────────────
-- How many ownerless reviews exist, and how many will merge rather than move:
--
-- SELECT
--   COUNT(*)                                              AS ownerless_active,
--   COUNT(*) FILTER (WHERE has_prabhakar)                 AS will_merge,
--   COUNT(*) FILTER (WHERE NOT has_prabhakar)             AS will_simply_move
-- FROM (
--   SELECT r.id, EXISTS (
--     SELECT 1 FROM public.hospital_patient_reviews p
--     WHERE p.patient_id = r.patient_id
--       AND p.doctor_id = '15bfa890-0377-48fa-b736-e04c4c4097b9'
--       AND p.status IN ('pending','rescheduled')
--   ) AS has_prabhakar
--   FROM public.hospital_patient_reviews r
--   WHERE r.doctor_id IS NULL AND r.status IN ('pending','rescheduled')
-- ) t;

BEGIN;

-- 1) Where the patient ALREADY has a live Prabhakar review, push the later date
--    onto it. MAX() across both rows, so a later ownerless date is not lost.
WITH merge_targets AS (
    SELECT
        p.id                                            AS keep_id,
        GREATEST(
            COALESCE(p.next_review_date, r.next_review_date),
            COALESCE(r.next_review_date, p.next_review_date)
        )                                               AS winning_date
    FROM public.hospital_patient_reviews r
    JOIN public.hospital_patient_reviews p
      ON p.patient_id  = r.patient_id
     AND p.hospital_id = r.hospital_id
     AND p.doctor_id   = '15bfa890-0377-48fa-b736-e04c4c4097b9'
     AND p.status IN ('pending', 'rescheduled')
    WHERE r.doctor_id IS NULL
      AND r.status IN ('pending', 'rescheduled')
)
UPDATE public.hospital_patient_reviews t
SET next_review_date = m.winning_date,
    updated_at       = now()
FROM merge_targets m
WHERE t.id = m.keep_id
  AND t.next_review_date IS DISTINCT FROM m.winning_date;

-- 2) Cancel the ownerless rows whose date has just been folded into a live
--    Prabhakar review. Cancelled rather than deleted: the history of what was
--    scheduled, and by which broken path, stays auditable.
UPDATE public.hospital_patient_reviews r
SET status       = 'cancelled',
    cancelled_at = now(),
    updated_at   = now()
WHERE r.doctor_id IS NULL
  AND r.status IN ('pending', 'rescheduled')
  AND EXISTS (
      SELECT 1 FROM public.hospital_patient_reviews p
      WHERE p.patient_id  = r.patient_id
        AND p.hospital_id = r.hospital_id
        AND p.doctor_id   = '15bfa890-0377-48fa-b736-e04c4c4097b9'
        AND p.status IN ('pending', 'rescheduled')
  );

-- 3) The rest have no Prabhakar review to merge into, so they simply become his.
--    DISTINCT ON keeps one row per patient (the latest-dated) and cancels the
--    others first, so step 4 cannot violate the uniqueness index.
UPDATE public.hospital_patient_reviews r
SET status       = 'cancelled',
    cancelled_at = now(),
    updated_at   = now()
WHERE r.doctor_id IS NULL
  AND r.status IN ('pending', 'rescheduled')
  AND r.id NOT IN (
      SELECT DISTINCT ON (patient_id) id
      FROM public.hospital_patient_reviews
      WHERE doctor_id IS NULL AND status IN ('pending', 'rescheduled')
      ORDER BY patient_id, next_review_date DESC NULLS LAST, updated_at DESC
  );

-- 4) Assign the survivors.
UPDATE public.hospital_patient_reviews
SET doctor_id  = '15bfa890-0377-48fa-b736-e04c4c4097b9',
    updated_at = now()
WHERE doctor_id IS NULL
  AND status IN ('pending', 'rescheduled');

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── VERIFY (run after) ───────────────────────────────────────────────────────
-- Must return zero:
-- SELECT COUNT(*) FROM public.hospital_patient_reviews
-- WHERE doctor_id IS NULL AND status IN ('pending','rescheduled');
--
-- And no patient should hold two active reviews with the same doctor:
-- SELECT patient_id, doctor_id, COUNT(*) FROM public.hospital_patient_reviews
-- WHERE status IN ('pending','rescheduled')
-- GROUP BY 1,2 HAVING COUNT(*) > 1;
