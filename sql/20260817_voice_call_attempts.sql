-- =============================================================================
-- Voice call attempts — Sarvam outbound agent calls to review patients
-- =============================================================================
-- Phase 2 of the review-reminder work. Phase 1 (sql/20260814_phone_e164.sql)
-- answered "can we reach this patient?"; this records what happened when we did.
--
-- WHY A SEPARATE TABLE RATHER THAN WRITING STRAIGHT INTO hospital_patient_followups
-- --------------------------------------------------------------------------------
-- Two reasons, both about the gap between placing a call and learning its outcome:
--
--   1. CORRELATION. Sarvam answers the create-call request with only an
--      `attempt_id`, then POSTs the outcome to a webhook some minutes later. We
--      need a row in between holding who we called, about which review, and on
--      whose authority — none of which the webhook payload carries.
--
--   2. AUTHENTICATION. Sarvam's docs describe no webhook signature or shared
--      secret, so the receiving endpoint is open to anyone who learns the URL.
--      Each attempt therefore carries a random `webhook_token`; the webhook is
--      only honoured when the token matches a row that is still awaiting an
--      outcome. Without this, a stranger could POST fabricated call outcomes
--      into patient records.
--
-- A followup row (the thing reception's Call History reads) is written by the
-- webhook only once a real outcome arrives, so an unanswered API call never
-- leaves a phantom "we called them" entry on the card.
--
-- Safe to re-run.
-- Date: 2026-08-17
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.hospital_voice_call_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    doctor_id UUID NULL,
    review_id UUID NULL REFERENCES public.hospital_patient_reviews(id) ON DELETE SET NULL,

    -- The number actually dialled, resolved from phone_e164 at placement time.
    -- Stored rather than re-derived: the patient's phone may be corrected later,
    -- and this must remain a record of what happened, not what is true now.
    dialed_number TEXT NOT NULL,

    -- Sarvam's identifier for the attempt, from the create-call response.
    sarvam_attempt_id TEXT NULL,

    -- Secret carried in webhook metadata and echoed back to us. See header.
    webhook_token TEXT NOT NULL,

    -- 'placing'   — request sent, no attempt_id back yet
    -- 'placed'    — Sarvam accepted it, waiting on the webhook
    -- 'completed' — outcome received and a followup row written
    -- 'failed'    — the create-call request itself failed
    status TEXT NOT NULL DEFAULT 'placing'
        CHECK (status IN ('placing', 'placed', 'completed', 'failed')),

    -- Sarvam's outcome, stored raw alongside the mapped call_status so a future
    -- status value we don't yet map is still recoverable from the record.
    sarvam_status TEXT NULL,
    duration_seconds INTEGER NULL,
    failure_reason TEXT NULL,
    interaction_id TEXT NULL,
    transcript JSONB NULL,
    final_agent_variables JSONB NULL,

    -- Who asked for this call. Reception shares one login, so this is the
    -- surface/profile name, not an individual — same limitation as
    -- hospital_patient_followups.created_by_name.
    requested_by_name TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL
);

-- The webhook looks a row up by token; must be fast and unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_call_attempts_webhook_token
    ON public.hospital_voice_call_attempts(webhook_token);

CREATE INDEX IF NOT EXISTS idx_voice_call_attempts_patient
    ON public.hospital_voice_call_attempts(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_call_attempts_hospital
    ON public.hospital_voice_call_attempts(hospital_id, created_at DESC);

-- Guards the "one call in flight per patient" rule the placing function relies
-- on. Partial, so completed/failed history never blocks a fresh attempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_call_attempts_one_in_flight
    ON public.hospital_voice_call_attempts(patient_id)
    WHERE status IN ('placing', 'placed');

-- ── Do-not-call ──────────────────────────────────────────────────────────────
-- The agent's DO_NOT_CALL disposition has to land somewhere the dialler checks,
-- or the patient gets called again next week and the promise made on the call is
-- broken. continuity_status is the wrong home: 'transferred_out' means they moved
-- care elsewhere, which is a different fact with different clinical meaning.
ALTER TABLE public.hospital_patients
    ADD COLUMN IF NOT EXISTS do_not_call BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS do_not_call_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS do_not_call_source TEXT NULL;

ALTER TABLE public.hospital_voice_call_attempts ENABLE ROW LEVEL SECURITY;

-- Only the owning hospital can read its own call history. Writes come from the
-- Edge Functions using the service role, which bypasses RLS — the browser is
-- never allowed to write here, because that is what makes the outcome
-- trustworthy as a record.
DROP POLICY IF EXISTS "voice_call_attempts_hospital_read" ON public.hospital_voice_call_attempts;
CREATE POLICY "voice_call_attempts_hospital_read"
    ON public.hospital_voice_call_attempts
    FOR SELECT
    USING (hospital_id = auth.uid());

COMMIT;

NOTIFY pgrst, 'reload schema';
