-- ═══════════════════════════════════════════════════════════════════════════
-- Patient feedback, collected by QR
-- Date: 2026-09-27
--
-- One poster, one QR, one link: beanhealth.in/f/<code>. The patient scans it,
-- rates the visit, and the doctor dashboard shows what came in.
--
-- ── Why a locations table when there is only one location ──────────────────
-- KKC wants a single hospital-wide review, not one per dialysis station. But
-- "which chair was this about" is the obvious next question once complaints
-- start arriving, and a schema that cannot answer it would need a migration,
-- a re-print and a code change to learn how. So the QR always points at a
-- location row; today exactly one row exists, labelled for the whole hospital.
-- Splitting later is INSERTing rows and printing more posters. No code moves.
--
-- ── Why ratings are JSONB and not columns ─────────────────────────────────
-- The question set is the part most likely to change after the hospital sees
-- the first month of answers. Columns would mean a migration per question and
-- a schema that drifts from the form. The questions live in one TypeScript
-- catalogue (src/components/feedback/feedbackQuestions.ts) and the answers land
-- here keyed by question id. Volume is a few hundred a month, so the panel
-- averages them client-side the way the dialysis register already counts
-- sessions client-side.
--
-- ── Why writes go through an RPC and not the table ─────────────────────────
-- The person filling this in is not signed in and never will be. Granting anon
-- INSERT on a table holding patient comments is not something to do for
-- convenience. submit_hospital_feedback is SECURITY DEFINER, resolves the code
-- itself, and is the only door. Same shape as patient_app_lookup_mr.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Locations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hospital_feedback_locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Globally unique: the URL carries only this, so it has to identify the
    -- hospital as well as the spot. Short, because every character is another
    -- QR module and the poster is read from across a waiting room.
    code        TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    -- hospital | dialysis | ward | opd | pharmacy | lab
    area        TEXT NOT NULL DEFAULT 'hospital',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_locations_hospital
    ON public.hospital_feedback_locations (hospital_id, is_active);

-- ── Responses ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hospital_feedback (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    location_id   UUID REFERENCES public.hospital_feedback_locations(id) ON DELETE SET NULL,

    -- What the visit was, which is what makes a hospital-wide QR still useful:
    -- the branch that decides which extra questions were asked, and the axis
    -- the dashboard groups by until stations get their own codes.
    visit_type    TEXT,

    -- { "<question id>": 1..5 }. Validated in the RPC, not by a constraint,
    -- because the catalogue of ids lives in the application.
    ratings       JSONB NOT NULL DEFAULT '{}'::jsonb,
    comment       TEXT,

    -- NULL patient_id IS the anonymity guarantee. Never backfilled, never
    -- inferred from timing. A response is identified only because the patient
    -- typed their MR number and ticked the box.
    patient_id    UUID REFERENCES public.hospital_patients(id) ON DELETE SET NULL,
    shared_with_doctor BOOLEAN NOT NULL DEFAULT FALSE,
    doctor_id     UUID,

    language      TEXT NOT NULL DEFAULT 'en',
    source        TEXT NOT NULL DEFAULT 'qr',

    -- Throttle only: a hash of a random per-browser id, the location and the
    -- date. No IP, no user agent, no geolocation — none of it helps and all of
    -- it is re-identification material.
    submission_key TEXT,

    status          TEXT NOT NULL DEFAULT 'new',   -- new | acknowledged | actioned
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    action_note     TEXT,

    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_hospital_time
    ON public.hospital_feedback (hospital_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_location_time
    ON public.hospital_feedback (hospital_id, location_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_patient
    ON public.hospital_feedback (patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_doctor
    ON public.hospital_feedback (doctor_id, submitted_at DESC) WHERE doctor_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_submission_key
    ON public.hospital_feedback (submission_key) WHERE submission_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_feedback_updated_at ON public.hospital_feedback;
CREATE TRIGGER trg_feedback_updated_at
    BEFORE UPDATE ON public.hospital_feedback
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Deliberately NO insert policy. Every write arrives through the RPC below.
ALTER TABLE public.hospital_feedback           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_feedback_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hospital_feedback_own" ON public.hospital_feedback;
CREATE POLICY "hospital_feedback_own" ON public.hospital_feedback FOR ALL TO authenticated
    USING (hospital_id = auth.uid()) WITH CHECK (hospital_id = auth.uid());

DROP POLICY IF EXISTS "hospital_feedback_locations_own" ON public.hospital_feedback_locations;
CREATE POLICY "hospital_feedback_locations_own" ON public.hospital_feedback_locations FOR ALL TO authenticated
    USING (hospital_id = auth.uid()) WITH CHECK (hospital_id = auth.uid());

-- Note for whoever adds per-doctor scoping later: it cannot live here.
-- Enterprise doctors are rows in hospital_doctors, not auth users — the doctor
-- dashboard is signed in as the hospital. Doctor scoping is applied in the
-- panel, the same way DoctorPastRecordsPanel already scopes reviews.

-- ── Resolve a poster code, for the public form ────────────────────────────
CREATE OR REPLACE FUNCTION public.feedback_resolve_location(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_loc     RECORD;
    v_profile JSONB;
    v_name    TEXT;
BEGIN
    SELECT l.id, l.hospital_id, l.label, l.area, l.is_active
      INTO v_loc
      FROM public.hospital_feedback_locations l
     WHERE UPPER(TRIM(l.code)) = UPPER(TRIM(COALESCE(p_code, '')))
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    IF v_loc.is_active IS NOT TRUE THEN
        RETURN jsonb_build_object('found', true, 'active', false);
    END IF;

    SELECT u.name INTO v_name FROM public.users u WHERE u.id = v_loc.hospital_id;
    -- to_jsonb rather than naming the columns: hospital_logo was added to this
    -- table outside the migration files, so a site that has it and a site that
    -- does not must both resolve a poster rather than erroring on a logo.
    SELECT to_jsonb(p) INTO v_profile
      FROM public.hospital_profiles p WHERE p.id = v_loc.hospital_id;

    RETURN jsonb_build_object(
        'found', true,
        'active', true,
        'location_id', v_loc.id,
        'location_label', v_loc.label,
        'area', v_loc.area,
        'hospital_name', COALESCE(v_profile ->> 'hospital_name', v_name, 'Hospital'),
        'hospital_logo', v_profile ->> 'hospital_logo'
    );
END;
$$;

-- ── Accept a response ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_hospital_feedback(
    p_code           TEXT,
    p_visit_type     TEXT,
    p_ratings        JSONB,
    p_comment        TEXT,
    p_mr_number      TEXT,
    p_share_with_doctor BOOLEAN,
    p_language       TEXT,
    p_device_key     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_loc       RECORD;
    v_patient   RECORD;
    v_doctor    UUID;
    v_key       TEXT;
    v_ratings   JSONB := '{}'::jsonb;
    v_k         TEXT;
    v_v         INT;
    v_id        UUID;
BEGIN
    SELECT l.id, l.hospital_id, l.is_active
      INTO v_loc
      FROM public.hospital_feedback_locations l
     WHERE UPPER(TRIM(l.code)) = UPPER(TRIM(COALESCE(p_code, '')))
     LIMIT 1;

    IF NOT FOUND OR v_loc.is_active IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code');
    END IF;

    -- Keep only integer 1..5. A malformed payload loses the bad answer, not
    -- the whole response — somebody in a dialysis chair does not get a second
    -- go at this.
    IF p_ratings IS NOT NULL AND jsonb_typeof(p_ratings) = 'object' THEN
        FOR v_k IN SELECT jsonb_object_keys(p_ratings) LOOP
            BEGIN
                v_v := (p_ratings ->> v_k)::INT;
                IF v_v BETWEEN 1 AND 5 THEN
                    v_ratings := v_ratings || jsonb_build_object(left(v_k, 60), v_v);
                END IF;
            EXCEPTION WHEN others THEN
                NULL;
            END;
        END LOOP;
    END IF;

    IF v_ratings = '{}'::jsonb AND COALESCE(TRIM(p_comment), '') = '' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'empty');
    END IF;

    -- Identity is opt-in and needs both halves: an MR number AND the tick.
    IF p_share_with_doctor IS TRUE AND COALESCE(TRIM(p_mr_number), '') <> '' THEN
        SELECT hp.id, hp.hospital_id
          INTO v_patient
          FROM public.hospital_patients hp
         WHERE hp.hospital_id = v_loc.hospital_id
           AND UPPER(TRIM(hp.mr_number)) = UPPER(TRIM(p_mr_number))
         ORDER BY hp.created_at DESC
         LIMIT 1;

        IF FOUND THEN
            -- Their treating doctor: latest review first, else latest Rx.
            SELECT r.doctor_id INTO v_doctor
              FROM public.hospital_patient_reviews r
             WHERE r.patient_id = v_patient.id AND r.doctor_id IS NOT NULL
             ORDER BY r.created_at DESC LIMIT 1;

            IF v_doctor IS NULL THEN
                SELECT pr.doctor_id INTO v_doctor
                  FROM public.hospital_prescriptions pr
                 WHERE pr.patient_id = v_patient.id AND pr.doctor_id IS NOT NULL
                 ORDER BY pr.created_at DESC LIMIT 1;
            END IF;
        END IF;
    END IF;

    IF COALESCE(TRIM(p_device_key), '') <> '' THEN
        v_key := md5(TRIM(p_device_key) || ':' || v_loc.id::TEXT || ':' || CURRENT_DATE::TEXT);
    END IF;

    BEGIN
        INSERT INTO public.hospital_feedback (
            hospital_id, location_id, visit_type, ratings, comment,
            patient_id, shared_with_doctor, doctor_id,
            language, source, submission_key
        ) VALUES (
            v_loc.hospital_id, v_loc.id, NULLIF(TRIM(COALESCE(p_visit_type, '')), ''),
            v_ratings, NULLIF(TRIM(COALESCE(p_comment, '')), ''),
            v_patient.id,
            COALESCE(p_share_with_doctor, FALSE) AND v_patient.id IS NOT NULL,
            v_doctor,
            COALESCE(NULLIF(TRIM(COALESCE(p_language, '')), ''), 'en'),
            'qr', v_key
        )
        RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
        -- Already answered from this browser today. Thank them anyway; a
        -- scolding error on a hospital poster helps nobody.
        RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'identified', v_patient.id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.feedback_resolve_location(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feedback_resolve_location(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated;

-- ── One poster for KKC, covering the whole hospital ───────────────────────
INSERT INTO public.hospital_feedback_locations (hospital_id, code, label, area)
VALUES ('1fd98796-61ac-4fdb-bd4e-607b7e35e9b1', 'KKC', 'Kongunad Kidney Centre', 'hospital')
ON CONFLICT (code) DO NOTHING;

-- Splitting by station later is this, and a re-print. Nothing in the app changes:
--   INSERT INTO public.hospital_feedback_locations (hospital_id, code, label, area)
--   VALUES ('1fd98796-…', 'KKC-D1', 'Dialysis Station 1', 'dialysis'),
--          ('1fd98796-…', 'KKC-W1', 'Ward 1',             'ward');

NOTIFY pgrst, 'reload schema';

COMMIT;
