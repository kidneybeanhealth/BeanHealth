-- =============================================================================
-- Normalized WhatsApp-dialable phone number on hospital_patients
-- =============================================================================
-- Phase 1 of the WhatsApp review-reminder work. Nothing here sends anything —
-- this only makes "can we reach this patient?" a question the database can
-- answer, which is the gate everything else sits behind.
--
-- WHY A GENERATED COLUMN RATHER THAN APP-SIDE NORMALIZATION
-- ---------------------------------------------------------
-- Four separate code paths write hospital_patients.phone today:
--     ReceptionDashboard  past-registration insert   (~line 1451)
--     ReceptionDashboard  walk-in update             (~line 1596)
--     ReceptionDashboard  walk-in insert             (~line 1621)
--     ReceptionDashboard  edit-patient modal update  (~line 1851)
-- All four store whatever reception typed. Normalizing in the app means getting
-- it right in four places and in every path added later — the same drift that
-- produced two Past Records cards and two copies of getReviewFilterLabel.
--
-- GENERATED ALWAYS ... STORED cannot be bypassed or forgotten. The app keeps
-- writing raw `phone` exactly as it does now; `phone_e164` is derived. No code
-- change is required for correctness, and a future write path gets it free.
--
-- CAVEAT worth knowing: Postgres does NOT recompute stored generated columns
-- when the underlying function is redefined. If normalize_indian_mobile ever
-- changes, force a recompute:
--     UPDATE public.hospital_patients SET phone = phone;
--
-- COUNTRY ASSUMPTION: India (+91) only, which is every current site. The rule
-- lives in one function so a second country is a change in one place — but note
-- the recompute caveat above when that happens.
--
-- LOCKING: ADD COLUMN ... STORED rewrites the table and takes ACCESS EXCLUSIVE.
-- On clinic-sized data this is seconds, but run it outside consulting hours.
--
-- MIRRORED IN: src/utils/phoneUtils.ts — the client needs the same verdict to
-- warn at the point of typing. If you change the rules here, change them there.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The rule, in one place
--
--    Accepts the shapes reception actually types:
--      9876543210      +91 98765 43210     09876543210
--      919876543210    +919876543210       0919876543210
--
--    Returns NULL for anything else — including two numbers crammed into one
--    field ("98765 43210 / 91234 56789"), which is a real habit and genuinely
--    needs a human to split. NULL means "not dialable", never "probably fine".
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_indian_mobile(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
    SELECT CASE
        -- bare 10-digit mobile
        WHEN d ~ '^[6-9][0-9]{9}$'    THEN '+91' || d
        -- STD-prefixed
        WHEN d ~ '^0[6-9][0-9]{9}$'   THEN '+91' || substring(d FROM 2)
        -- country code, with or without a leading zero
        WHEN d ~ '^91[6-9][0-9]{9}$'  THEN '+91' || substring(d FROM 3)
        WHEN d ~ '^091[6-9][0-9]{9}$' THEN '+91' || substring(d FROM 4)
        ELSE NULL
    END
    FROM (SELECT regexp_replace(raw, '\D', '', 'g')) AS t(d);
$$;

COMMENT ON FUNCTION public.normalize_indian_mobile(text) IS
    'Indian mobile -> E.164 (+91XXXXXXXXXX), or NULL if not dialable. '
    'Mirrored in src/utils/phoneUtils.ts. Redefining this does NOT recompute '
    'hospital_patients.phone_e164 — run UPDATE hospital_patients SET phone = phone;';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The derived column. Backfill is implicit — STORED computes for every
--    existing row as part of the ADD.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hospital_patients
    ADD COLUMN IF NOT EXISTS phone_e164 text
    GENERATED ALWAYS AS (public.normalize_indian_mobile(phone)) STORED;

COMMENT ON COLUMN public.hospital_patients.phone_e164 IS
    'Derived from phone. NULL = not reachable on WhatsApp. Never write directly.';

-- Partial index: the reminder planner only ever asks for reachable patients
-- within one hospital, so the NULLs are dead weight in the index.
CREATE INDEX IF NOT EXISTS idx_hospital_patients_phone_e164
    ON public.hospital_patients (hospital_id, phone_e164)
    WHERE phone_e164 IS NOT NULL;

COMMIT;

-- PostgREST caches the schema; without this the new column 404s from the client.
NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- Verification — run after applying. Expect the reachable count to match
-- A1 in sql/whatsapp_readiness_audit.sql.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT
--     COUNT(*)                                        AS patients,
--     COUNT(phone)                                    AS has_some_phone,
--     COUNT(phone_e164)                               AS dialable,
--     COUNT(phone) - COUNT(phone_e164)                AS phone_present_but_unusable,
--     ROUND(100.0 * COUNT(phone_e164) / NULLIF(COUNT(*), 0), 1) AS reachable_pct
-- FROM public.hospital_patients;
--
-- The unusable ones, worst first — this is the list reception can actually fix:
-- SELECT id, name, mr_number, phone
-- FROM public.hospital_patients
-- WHERE phone IS NOT NULL AND phone_e164 IS NULL
-- ORDER BY name;
