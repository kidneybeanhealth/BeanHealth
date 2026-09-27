-- ═══════════════════════════════════════════════════════════════════════════
-- BeanHealth Connect
-- Date: 2026-09-27 · Safe to re-run
-- Requires: 20260921_voice_provider_abstraction.sql, 20260921_frontdesk_patients.sql,
--           20260817_voice_call_attempts.sql (all already applied in production)
--
-- Connect is the follow-up product for a centre that keeps its own hospital
-- system. The pipeline:
--
--   patient list in (CSV / Excel / WhatsApp paste)
--     → protocol engine (dialysis schedule, labs due, missed-session rules)
--     → voice agent calls in the patient's language
--     → response captured → red flag? → alert the doctor or coordinator
--     → dashboard + monthly outcome report
--
-- A Connect centre is an ordinary hospital account on a different product,
-- exactly as Frontdesk was on v12: same `enterprise` role, same hospital_id
-- tenancy, same patient table. One patient model, not a second one.
--
-- ── What this adds ───────────────────────────────────────────────────────
--   hospital_profiles.product      gains 'connect'
--   hospital_profiles.connect_settings   the centre's protocol rules (JSONB,
--                                  read with defaults in the app — see
--                                  src/connect/protocol/engine.ts)
--   hospital_patients              programme, dialysis days/shift, preferred
--                                  call language (all nullable; KKC unaffected)
--   connect_dialysis_sessions      attended / missed, one row per patient-day
--   connect_lab_records            when each test was last done
--   connect_alerts                 red flags and callback requests, raised by a
--                                  TRIGGER on the call-attempt row
--   hospital_voice_call_attempts.purpose   why each call was made
--
-- ── Why alerts come from a trigger ───────────────────────────────────────
-- sarvam-call-webhook already writes the agent's final variables onto
-- hospital_voice_call_attempts, including `disposition = RED_FLAG_REPORTED`
-- and `callback_requested = yes`. Raising the alert in the database, off that
-- write, means no change to — and no redeploy of — the live webhook, and any
-- future provider that writes the same row raises the same alert. An alert
-- that depends on a second code path remembering to insert it is an alert that
-- one day does not fire.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Product ───────────────────────────────────────────────────────────────
ALTER TABLE public.hospital_profiles
    DROP CONSTRAINT IF EXISTS hospital_profiles_product_check;
ALTER TABLE public.hospital_profiles
    ADD CONSTRAINT hospital_profiles_product_check
    CHECK (product IN ('kidney_os', 'frontdesk', 'connect'));

ALTER TABLE public.hospital_profiles
    ADD COLUMN IF NOT EXISTS connect_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hospital_profiles.connect_settings IS
    'BeanHealth Connect protocol rules and alert routing. Missing keys fall back to defaults in src/connect/protocol/engine.ts.';

-- ── Patient programme ─────────────────────────────────────────────────────
ALTER TABLE public.hospital_patients
    ADD COLUMN IF NOT EXISTS programme TEXT NULL,
    -- ISO weekdays, 1 = Monday … 7 = Sunday. {1,3,5} is a Mon/Wed/Fri patient.
    ADD COLUMN IF NOT EXISTS dialysis_days SMALLINT[] NULL,
    ADD COLUMN IF NOT EXISTS dialysis_shift TEXT NULL,
    -- 'Tamil', 'English', 'Hindi' … the opening language for calls. NULL means
    -- the centre's default_call_language.
    ADD COLUMN IF NOT EXISTS preferred_language TEXT NULL;

ALTER TABLE public.hospital_patients
    DROP CONSTRAINT IF EXISTS hospital_patients_programme_check;
ALTER TABLE public.hospital_patients
    ADD CONSTRAINT hospital_patients_programme_check
    CHECK (programme IS NULL OR programme IN ('dialysis', 'ckd', 'transplant', 'general'));

ALTER TABLE public.hospital_patients
    DROP CONSTRAINT IF EXISTS hospital_patients_dialysis_days_check;
ALTER TABLE public.hospital_patients
    ADD CONSTRAINT hospital_patients_dialysis_days_check
    CHECK (dialysis_days IS NULL OR dialysis_days <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]);

-- ── Why each call was made ────────────────────────────────────────────────
-- 'review' | 'missed_session' | 'lab_due'. NULL on every call placed before
-- this column existed — all of those were review reminders, and the app reads
-- NULL as 'review'. The monthly report needs it to say which reason a call
-- served and whether it worked.
ALTER TABLE public.hospital_voice_call_attempts
    ADD COLUMN IF NOT EXISTS purpose TEXT NULL;

-- ── Dialysis sessions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.connect_dialysis_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    session_date    DATE NOT NULL,
    -- attended | missed | cancelled. "cancelled" is the centre calling it off
    -- (machine down, holiday) — never counted against the patient.
    status          TEXT NOT NULL CHECK (status IN ('attended', 'missed', 'cancelled')),
    note            TEXT NULL,
    marked_by_name  TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_connect_sessions_hospital_date
    ON public.connect_dialysis_sessions (hospital_id, session_date DESC);

DROP TRIGGER IF EXISTS trg_connect_sessions_updated_at ON public.connect_dialysis_sessions;
CREATE TRIGGER trg_connect_sessions_updated_at
    BEFORE UPDATE ON public.connect_dialysis_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Lab records ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.connect_lab_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id   UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    -- A code from the centre's lab list in connect_settings (e.g. 'rft', 'cbc').
    test_code    TEXT NOT NULL,
    done_on      DATE NOT NULL,
    note         TEXT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, test_code, done_on)
);
CREATE INDEX IF NOT EXISTS idx_connect_labs_patient
    ON public.connect_lab_records (hospital_id, patient_id, test_code, done_on DESC);

-- ── Alerts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.connect_alerts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id           UUID NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    attempt_id           UUID NULL REFERENCES public.hospital_voice_call_attempts(id) ON DELETE SET NULL,
    -- red_flag  the agent heard a danger symptom
    -- callback  the patient asked for a human to ring back
    kind                 TEXT NOT NULL CHECK (kind IN ('red_flag', 'callback')),
    title                TEXT NOT NULL,
    detail               TEXT NULL,
    status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    acknowledged_at      TIMESTAMPTZ NULL,
    acknowledged_by_name TEXT NULL,
    resolved_at          TIMESTAMPTZ NULL,
    resolution_note      TEXT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One alert of each kind per call, however many times the webhook row is touched.
CREATE UNIQUE INDEX IF NOT EXISTS idx_connect_alerts_attempt_kind
    ON public.connect_alerts (attempt_id, kind) WHERE attempt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connect_alerts_open
    ON public.connect_alerts (hospital_id, status, created_at DESC);

-- ── RLS: a centre sees only its own rows ──────────────────────────────────
ALTER TABLE public.connect_dialysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_lab_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_alerts            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connect_sessions_own" ON public.connect_dialysis_sessions;
CREATE POLICY "connect_sessions_own" ON public.connect_dialysis_sessions FOR ALL TO authenticated
    USING (hospital_id = auth.uid()) WITH CHECK (hospital_id = auth.uid());

DROP POLICY IF EXISTS "connect_labs_own" ON public.connect_lab_records;
CREATE POLICY "connect_labs_own" ON public.connect_lab_records FOR ALL TO authenticated
    USING (hospital_id = auth.uid()) WITH CHECK (hospital_id = auth.uid());

DROP POLICY IF EXISTS "connect_alerts_own" ON public.connect_alerts;
CREATE POLICY "connect_alerts_own" ON public.connect_alerts FOR ALL TO authenticated
    USING (hospital_id = auth.uid()) WITH CHECK (hospital_id = auth.uid());

-- ── Raise alerts from the call outcome ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.connect_raise_call_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vars        JSONB := NEW.final_agent_variables;
    v_disposition TEXT;
    v_reason      TEXT;
    v_spoke_to    TEXT;
    v_callback    TEXT;
    v_day         TEXT;
    v_name        TEXT;
BEGIN
    IF v_vars IS NULL OR jsonb_typeof(v_vars) <> 'object' THEN
        RETURN NEW;
    END IF;
    -- Only once the outcome has actually changed, not on every touch of the row.
    IF TG_OP = 'UPDATE' AND OLD.final_agent_variables IS NOT DISTINCT FROM NEW.final_agent_variables THEN
        RETURN NEW;
    END IF;

    v_disposition := UPPER(TRIM(COALESCE(v_vars ->> 'disposition', '')));
    v_reason      := NULLIF(TRIM(COALESCE(v_vars ->> 'reason_text', v_vars ->> 'call_summary', '')), '');
    -- The agent reports who answered as an uppercase enum (PATIENT, FAMILY);
    -- it reads in a sentence, so lowercase it.
    v_spoke_to    := NULLIF(LOWER(TRIM(COALESCE(v_vars ->> 'spoke_to', ''))), '');
    -- The one lowercase enum the agent emits; compared case-insensitively, as
    -- the webhook does, so a normalisation on the provider's side cannot turn
    -- every callback request into a no.
    v_callback    := LOWER(TRIM(COALESCE(v_vars ->> 'callback_requested', '')));
    v_day         := NULLIF(TRIM(COALESCE(v_vars ->> 'preferred_day', '')), '');

    SELECT name INTO v_name FROM public.hospital_patients WHERE id = NEW.patient_id;

    IF v_disposition = 'RED_FLAG_REPORTED' THEN
        INSERT INTO public.connect_alerts (hospital_id, patient_id, attempt_id, kind, title, detail)
        VALUES (
            NEW.hospital_id, NEW.patient_id, NEW.id, 'red_flag',
            'Red flag on AI call — ' || COALESCE(v_name, 'patient'),
            CONCAT_WS(' · ', v_reason, CASE WHEN v_spoke_to IS NOT NULL THEN 'spoke to ' || v_spoke_to END)
        )
        ON CONFLICT (attempt_id, kind) WHERE attempt_id IS NOT NULL DO NOTHING;
    END IF;

    IF v_callback = 'yes' THEN
        INSERT INTO public.connect_alerts (hospital_id, patient_id, attempt_id, kind, title, detail)
        VALUES (
            NEW.hospital_id, NEW.patient_id, NEW.id, 'callback',
            'Callback requested — ' || COALESCE(v_name, 'patient'),
            CONCAT_WS(' · ', v_reason, CASE WHEN v_day IS NOT NULL THEN 'prefers ' || v_day END)
        )
        ON CONFLICT (attempt_id, kind) WHERE attempt_id IS NOT NULL DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connect_raise_call_alerts ON public.hospital_voice_call_attempts;
CREATE TRIGGER trg_connect_raise_call_alerts
    AFTER INSERT OR UPDATE OF final_agent_variables ON public.hospital_voice_call_attempts
    FOR EACH ROW EXECUTE FUNCTION public.connect_raise_call_alerts();

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Registering a centre ─────────────────────────────────────────────────
-- Onboarding is two steps:
--   1. Supabase → Authentication → Users → Add user (email + password,
--      auto-confirm). This is the centre's login.
--   2. In the SQL editor:
--        SELECT public.connect_register_centre(
--            'coordinator@centre.in', 'Sri Vaari Dialysis Centre',
--            '0422 400 1234', 'Tamil', 'Gandhipuram, Coimbatore');
--
-- The function REFUSES to convert an existing hospital on another product: run
-- with KKC's email by mistake, it would otherwise flip KKC to Connect and take
-- its reception and doctor dashboards away. It is callable only from the SQL
-- editor — no signed-in user can reach it from the app.
BEGIN;

CREATE OR REPLACE FUNCTION public.connect_register_centre(
    p_email             TEXT,
    p_centre_name       TEXT,
    p_front_desk_number TEXT,
    p_language          TEXT DEFAULT 'Tamil',
    p_address           TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id      UUID;
    v_product TEXT;
    v_name    TEXT := TRIM(COALESCE(p_centre_name, ''));
BEGIN
    IF v_name = '' THEN
        RAISE EXCEPTION 'A centre name is required.';
    END IF;
    IF TRIM(COALESCE(p_front_desk_number, '')) = '' THEN
        RAISE EXCEPTION 'A front-desk number is required — the voice agent reads it out when a patient reports a red flag.';
    END IF;

    SELECT id INTO v_id FROM auth.users WHERE LOWER(email) = LOWER(TRIM(p_email)) LIMIT 1;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'No login exists for %. Create it first: Authentication → Users → Add user.', p_email;
    END IF;

    SELECT product INTO v_product FROM public.hospital_profiles WHERE id = v_id;
    IF v_product IS NOT NULL AND v_product NOT IN ('connect', 'frontdesk') THEN
        RAISE EXCEPTION '% is already a hospital on %. Use a separate email for the Connect centre.', p_email, v_product;
    END IF;

    INSERT INTO public.users (id, email, name, role)
    VALUES (v_id, LOWER(TRIM(p_email)), v_name, 'enterprise')
    ON CONFLICT (id) DO UPDATE SET role = 'enterprise', name = EXCLUDED.name;

    INSERT INTO public.hospital_profiles (id, hospital_name, product, default_call_language, voice_front_desk_number, voice_hospital_address)
    VALUES (v_id, v_name, 'connect', COALESCE(NULLIF(TRIM(p_language), ''), 'Tamil'), TRIM(p_front_desk_number), NULLIF(TRIM(COALESCE(p_address, '')), ''))
    ON CONFLICT (id) DO UPDATE SET
        hospital_name           = EXCLUDED.hospital_name,
        product                 = 'connect',
        default_call_language   = EXCLUDED.default_call_language,
        voice_front_desk_number = EXCLUDED.voice_front_desk_number,
        voice_hospital_address  = COALESCE(EXCLUDED.voice_hospital_address, public.hospital_profiles.voice_hospital_address);

    RETURN format('Connect centre ready: %s (%s). It signs in at beanhealth.in/connect with %s.', v_name, v_id, LOWER(TRIM(p_email)));
END;
$$;

REVOKE ALL ON FUNCTION public.connect_register_centre(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

COMMIT;
