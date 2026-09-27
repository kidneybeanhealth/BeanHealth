-- Let a hospital delete its own voice-call attempts.
--
-- 20260817 granted SELECT only, so the Placed Call List could show a call but
-- never remove it — the delete failed silently under RLS, which reads to the
-- operator as the button not working.
--
-- Deleting is the reset for "call this patient again from scratch": the row is
-- the ONLY record of the call, so removing it clears the campaign entry and the
-- patient's AI Call History together. That is intended — both surfaces read
-- this table, and a summary the operator has judged wrong should not survive on
-- the clinical card after they cleared it from the campaign.
--
-- Scoped to the caller's own hospital, same boundary as the read policy.

BEGIN;

DROP POLICY IF EXISTS "voice_call_attempts_hospital_delete" ON public.hospital_voice_call_attempts;
CREATE POLICY "voice_call_attempts_hospital_delete"
    ON public.hospital_voice_call_attempts
    FOR DELETE
    USING (hospital_id = auth.uid());

COMMIT;

NOTIFY pgrst, 'reload schema';
