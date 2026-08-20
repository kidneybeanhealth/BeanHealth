-- =============================================================================
-- A reason on every follow-up, and on every stop
-- =============================================================================
-- Two gaps the PA hit in production:
--
--   1. "Add to Follow-up" captured WHO and WHEN but never WHY. Reception then
--      rings a patient with no idea what the call is about, which makes the call
--      vaguer and easier for the patient to brush off.
--
--   2. "Stop Follow-up" already stores a reason (followup_stop_reason), but only
--      Reception ever asked for one — the doctor dashboard hardcoded
--      'external_hospital_transfer' behind a window.confirm(). So a meaningful
--      share of stops are recorded as transfers that were nothing of the kind,
--      and there was no screen anywhere that listed who had been stopped.
--
-- This migration covers (1). The columns for (2) already exist; what was missing
-- was the UI, which is in the app change alongside this.
--
-- tests_to_review / specialists_to_review already exist and stay as they are —
-- they answer "what to check at the visit", which is a different question from
-- "why are we bringing them back".
--
-- Safe to re-run.
-- Date: 2026-08-19
-- =============================================================================

ALTER TABLE public.hospital_patient_reviews
    ADD COLUMN IF NOT EXISTS review_reason TEXT NULL;

COMMENT ON COLUMN public.hospital_patient_reviews.review_reason IS
    'Why this patient is being brought back, in the words of whoever scheduled it. '
    'Shown on the Past Records card and read by reception before calling.';

NOTIFY pgrst, 'reload schema';
