-- ============================================================================
-- hospital_pharmacy_queue.token_number must accept NULL
-- ============================================================================
-- 004_pharmacy_queue.sql declared the column TEXT NOT NULL back when every
-- pharmacy row came from the OP queue and therefore always had a token.
--
-- Three document types no longer do, by design:
--
--   • Discharge cards   — an in-patient discharge is not an OP-queue visit
--   • In-patient Rx     — same; the patient is admitted, not queued
--   • Dialysis Rx       — dialysis patients never enter the OP queue at all
--
-- These used to be stamped with the patient's token from an *earlier* visit,
-- which collided with today's live tokens on the public display board and got
-- announced aloud, pulling the wrong patient to the counter. That was fixed on
-- 2026-08-08 by writing NULL instead — but the NOT NULL constraint was never
-- dropped, so the write now fails outright:
--
--   null value in column "token_number" of relation "hospital_pharmacy_queue"
--   violates not-null constraint
--
-- Every display surface is already NULL-safe: PharmacyQueueDisplay falls back
-- to '—' and skips the voice announcement when the token is empty, and the
-- pharmacy dashboard renders DC / DIA / IP from the document type instead.
-- Neither the display board nor the dashboard ever orders by token_number, so
-- dropping the constraint changes no sort order.
--
-- Safe to re-run.
-- Date: 2026-08-10
-- ============================================================================

ALTER TABLE public.hospital_pharmacy_queue
    ALTER COLUMN token_number DROP NOT NULL;

-- PostgREST caches the schema; without this the API keeps rejecting the write.
NOTIFY pgrst, 'reload schema';
