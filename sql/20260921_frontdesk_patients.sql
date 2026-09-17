-- Frontdesk tenants add patients by CSV or by hand, without a reception desk
-- in front of them. The follow-up machinery needs more than a name and a
-- number to work a call round honestly:
--
--   attender    the son, daughter or carer who actually answers the phone for
--               an elderly chronic patient. Half of KKC's answered calls were
--               family, not the patient. Without a place to record who that is,
--               the agent's "spoke to: family" has nowhere to land.
--   call_hold   "not now" — admitted elsewhere, travelling, grieving, or simply
--               asked to be left alone for a while. Distinct from do_not_call
--               (permanent, set by the patient on a call) and from stopping
--               follow-up (they have left the programme). place-review-call
--               refuses to dial while it is set.
--
-- attender_phone_e164 is GENERATED like phone_e164, so the dial gate can fall
-- back to it without a second normaliser drifting from the first.

BEGIN;

ALTER TABLE public.hospital_patients
    ADD COLUMN IF NOT EXISTS attender_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS attender_relation TEXT NULL,
    ADD COLUMN IF NOT EXISTS attender_phone TEXT NULL,
    ADD COLUMN IF NOT EXISTS call_hold BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS call_hold_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS call_hold_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS source TEXT NULL;

-- Same normaliser as phone_e164 (sql/20260814_phone_e164.sql).
ALTER TABLE public.hospital_patients
    ADD COLUMN IF NOT EXISTS attender_phone_e164 TEXT
        GENERATED ALWAYS AS (public.normalize_indian_mobile(attender_phone)) STORED;

COMMENT ON COLUMN public.hospital_patients.call_hold IS
    'Temporary: do not dial while true. Cleared by reception. Not the same as do_not_call (permanent) or continuity_status (left the programme).';
COMMENT ON COLUMN public.hospital_patients.source IS
    'How the row arrived: reception | csv_import | frontdesk_manual. NULL for rows that predate the column.';

COMMIT;

NOTIFY pgrst, 'reload schema';
