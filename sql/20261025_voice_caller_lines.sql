-- ============================================================================
-- Which caller number placed each AI call
-- ============================================================================
-- BeanHealth can now ring from several Sarvam numbers (SARVAM_AGENT_LINES).
-- place-review-call picks a free number for each call, which means it has to
-- know which numbers have a call in progress, and spreads calls across them by
-- how often each has rung in the last hour. Both are read from this column.
--
-- Also the record of which number a patient saw ring, for when they call back.
--
-- Safe to run before or after the function deploy: without the column the
-- function rings from the first number and records nothing, as before.
-- ============================================================================

ALTER TABLE public.hospital_voice_call_attempts
    ADD COLUMN IF NOT EXISTS caller_line TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_voice_call_attempts_caller_line
    ON public.hospital_voice_call_attempts(caller_line, created_at DESC)
    WHERE caller_line IS NOT NULL;

NOTIFY pgrst, 'reload schema';
