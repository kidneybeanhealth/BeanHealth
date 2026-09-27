-- Stage 0 of the custom voice stack: make the provider a fact on the row, not
-- a name baked into the schema.
--
-- Two vendor-named columns are renamed (RENAME keeps every existing KKC row and
-- its call history intact) and a `provider` column is added so an attempt says
-- who placed it. That is what makes the Stage 1 side-by-side — Sarvam dials
-- patient A, our own stack dials patient B, same campaign — a query rather than
-- a guess.
--
-- Per-hospital voice config moves onto hospital_profiles. Until now the front
-- desk number and address the agent reads out on a red-flag call were GLOBAL
-- secrets: a second hospital's breathless patient would have been given the
-- first hospital's phone number. That is a safety bug regardless of whether the
-- product line ships.

BEGIN;

-- ── Attempts: provider-neutral ────────────────────────────────────────────
ALTER TABLE public.hospital_voice_call_attempts
    RENAME COLUMN sarvam_attempt_id TO provider_call_id;
ALTER TABLE public.hospital_voice_call_attempts
    RENAME COLUMN sarvam_status TO provider_status;
ALTER TABLE public.hospital_voice_call_attempts
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'sarvam';

COMMENT ON COLUMN public.hospital_voice_call_attempts.provider IS
    'Which voice stack placed this call: sarvam | livekit. Drives the Stage 1 side-by-side comparison.';
COMMENT ON COLUMN public.hospital_voice_call_attempts.provider_status IS
    'Carrier result as the provider reports it, normalised to: connected | no_answer | busy | failed.';

-- ── Hospital: what product they are on, and how their calls are configured ─
ALTER TABLE public.hospital_profiles
    ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'kidney_os'
        CHECK (product IN ('kidney_os', 'frontdesk')),
    ADD COLUMN IF NOT EXISTS voice_provider TEXT NOT NULL DEFAULT 'sarvam'
        CHECK (voice_provider IN ('sarvam', 'livekit')),
    ADD COLUMN IF NOT EXISTS voice_front_desk_number TEXT NULL,
    ADD COLUMN IF NOT EXISTS voice_hospital_address TEXT NULL,
    ADD COLUMN IF NOT EXISTS default_call_language TEXT NOT NULL DEFAULT 'Tamil';

COMMENT ON COLUMN public.hospital_profiles.product IS
    'kidney_os = the full desk (queue, prescriptions, pharmacy). frontdesk = follow-up calling only: patients, follow-up lists, campaigns.';
COMMENT ON COLUMN public.hospital_profiles.voice_front_desk_number IS
    'Read out digit by digit by the agent when a patient reports a red-flag symptom. Per hospital — never a global secret.';
COMMENT ON COLUMN public.hospital_profiles.default_call_language IS
    'Opening language for outbound calls: Tamil | Hindi | English | ... The agent mirrors the patient from there.';

-- KKC carries on exactly as before: seed its per-hospital values from what the
-- global secrets held, so nothing changes on the day the function is redeployed.
UPDATE public.hospital_profiles
SET voice_front_desk_number = COALESCE(voice_front_desk_number, '0422 2494333'),
    voice_hospital_address  = COALESCE(voice_hospital_address, 'Kongunad Kidney Centre, Coimbatore'),
    default_call_language   = 'Tamil',
    product                 = 'kidney_os'
WHERE id = '1fd98796-61ac-4fdb-bd4e-607b7e35e9b1';

COMMIT;

NOTIFY pgrst, 'reload schema';
