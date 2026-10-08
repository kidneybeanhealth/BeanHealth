-- ═══════════════════════════════════════════════════════════════════════════
-- Patient feedback: a QR per place, and feedback about a named doctor
-- Date: 2026-10-08 · Safe to re-run · Needs 20260927 + 20260927b + 20260927c
--
-- 1. hospital_feedback.rated_doctor_id — the doctor the patient says they saw.
--    Deliberately NOT doctor_id: that column means "the treating doctor of a
--    patient who identified themselves", set by the server from their MR
--    number, and drives the "shared with me" filter. A patient can rate
--    Dr. Divakar anonymously; conflating the two would either un-anonymise
--    them or file the rating under the wrong doctor.
-- 2. feedback_resolve_location also returns the hospital's active doctors, as
--    id + name ONLY, for the "Which doctor did you see?" picker. Never select
--    `*` from hospital_doctors here: it holds each doctor's access_code, and
--    this function is callable by anyone holding a poster.
-- 3. submit_hospital_feedback gains p_rated_doctor_id, validated against the
--    poster's own hospital so a crafted request cannot attach another
--    hospital's doctor.
-- 4. KKC gets four place QRs. The original hospital-wide 'KKC' poster stays.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.hospital_feedback
    ADD COLUMN IF NOT EXISTS rated_doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_rated_doctor
    ON public.hospital_feedback (rated_doctor_id, submitted_at DESC) WHERE rated_doctor_id IS NOT NULL;

-- ── Resolve: now with the doctor list ─────────────────────────────────────
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
    v_doctors JSONB;
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
    SELECT to_jsonb(p) INTO v_profile
      FROM public.hospital_profiles p WHERE p.id = v_loc.hospital_id;

    -- id and name only. See the header: access_code lives on this table.
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) ORDER BY d.name), '[]'::jsonb)
      INTO v_doctors
      FROM public.hospital_doctors d
     WHERE d.hospital_id = v_loc.hospital_id
       AND d.is_active IS NOT FALSE;

    RETURN jsonb_build_object(
        'found', true,
        'active', true,
        'location_id', v_loc.id,
        'location_label', v_loc.label,
        'area', v_loc.area,
        'hospital_name', COALESCE(v_profile ->> 'hospital_name', v_name, 'Hospital'),
        'hospital_logo', COALESCE(NULLIF(v_profile ->> 'hospital_logo', ''), NULLIF(v_profile ->> 'avatar_url', '')),
        'doctors', v_doctors
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.feedback_resolve_location(TEXT) TO anon, authenticated;

-- ── Submit: now with the rated doctor ─────────────────────────────────────
-- Dropped and recreated rather than overloaded: two versions differing only by
-- a defaulted argument make PostgREST refuse every call as ambiguous.
DROP FUNCTION IF EXISTS public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.submit_hospital_feedback(
    p_code              TEXT,
    p_visit_type        TEXT,
    p_ratings           JSONB,
    p_comment           TEXT,
    p_mr_number         TEXT,
    p_share_with_doctor BOOLEAN,
    p_language          TEXT,
    p_device_key        TEXT,
    p_audio_path        TEXT    DEFAULT NULL,
    p_audio_seconds     INTEGER DEFAULT NULL,
    p_source            TEXT    DEFAULT 'qr',
    p_rated_doctor_id   UUID    DEFAULT NULL
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
    v_rated     UUID;
    v_key       TEXT;
    v_ratings   JSONB := '{}'::jsonb;
    v_k         TEXT;
    v_v         INT;
    v_id        UUID;
    v_audio     TEXT;
    v_source    TEXT := CASE WHEN p_source = 'desk' THEN 'desk' ELSE 'qr' END;
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
    -- the whole response.
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

    -- Attach a recording only if it is real, fresh, in incoming/, and unclaimed.
    IF COALESCE(TRIM(p_audio_path), '') <> '' THEN
        SELECT o.name INTO v_audio
          FROM storage.objects o
         WHERE o.bucket_id = 'feedback-audio'
           AND o.name = TRIM(p_audio_path)
           AND o.name LIKE 'incoming/%'
           AND o.created_at > NOW() - INTERVAL '2 hours'
           AND NOT EXISTS (SELECT 1 FROM public.hospital_feedback f WHERE f.audio_path = o.name)
         LIMIT 1;
    END IF;

    IF v_ratings = '{}'::jsonb AND COALESCE(TRIM(p_comment), '') = '' AND v_audio IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'empty');
    END IF;

    -- The doctor they picked, only if that doctor belongs to this poster's
    -- hospital. Anything else is dropped silently: the ratings still count.
    IF p_rated_doctor_id IS NOT NULL THEN
        SELECT d.id INTO v_rated
          FROM public.hospital_doctors d
         WHERE d.id = p_rated_doctor_id
           AND d.hospital_id = v_loc.hospital_id;
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
            -- A named patient who also picked a doctor is sharing with THAT
            -- doctor; otherwise fall back to their treating doctor as before.
            v_doctor := v_rated;

            IF v_doctor IS NULL THEN
                SELECT r.doctor_id INTO v_doctor
                  FROM public.hospital_patient_reviews r
                 WHERE r.patient_id = v_patient.id AND r.doctor_id IS NOT NULL
                 ORDER BY r.created_at DESC LIMIT 1;
            END IF;

            IF v_doctor IS NULL THEN
                SELECT pr.doctor_id INTO v_doctor
                  FROM public.hospital_prescriptions pr
                 WHERE pr.patient_id = v_patient.id AND pr.doctor_id IS NOT NULL
                 ORDER BY pr.created_at DESC LIMIT 1;
            END IF;
        END IF;
    END IF;

    -- Desk submissions skip the throttle: one tablet, many patients.
    IF v_source <> 'desk' AND COALESCE(TRIM(p_device_key), '') <> '' THEN
        v_key := md5(TRIM(p_device_key) || ':' || v_loc.id::TEXT || ':' || CURRENT_DATE::TEXT);
    END IF;

    BEGIN
        INSERT INTO public.hospital_feedback (
            hospital_id, location_id, visit_type, ratings, comment,
            patient_id, shared_with_doctor, doctor_id, rated_doctor_id,
            language, source, submission_key, audio_path, audio_seconds
        ) VALUES (
            v_loc.hospital_id, v_loc.id, NULLIF(TRIM(COALESCE(p_visit_type, '')), ''),
            v_ratings, NULLIF(TRIM(COALESCE(p_comment, '')), ''),
            v_patient.id,
            COALESCE(p_share_with_doctor, FALSE) AND v_patient.id IS NOT NULL,
            v_doctor,
            v_rated,
            COALESCE(NULLIF(TRIM(COALESCE(p_language, '')), ''), 'en'),
            v_source, v_key,
            v_audio,
            CASE WHEN v_audio IS NULL THEN NULL ELSE LEAST(GREATEST(COALESCE(p_audio_seconds, 0), 0), 600) END
        )
        RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'identified', v_patient.id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID) TO anon, authenticated;

-- ── KKC: one QR per place ─────────────────────────────────────────────────
-- `area` decides the form (see fixedVisitTypeFor in feedbackQuestions.ts):
-- opd → OP questions, ward → admitted, reception / restroom → their own short
-- forms. The label is printed on the poster and shown at the top of the form.
INSERT INTO public.hospital_feedback_locations (hospital_id, code, label, area)
VALUES
    ('1fd98796-61ac-4fdb-bd4e-607b7e35e9b1', 'KKC-OP',  'Outpatients (OP)',    'opd'),
    ('1fd98796-61ac-4fdb-bd4e-607b7e35e9b1', 'KKC-IP',  'Inpatient wards (IP)', 'ward'),
    ('1fd98796-61ac-4fdb-bd4e-607b7e35e9b1', 'KKC-REC', 'Reception',           'reception'),
    ('1fd98796-61ac-4fdb-bd4e-607b7e35e9b1', 'KKC-RR',  'Restroom',            'restroom')
ON CONFLICT (code) DO NOTHING;

-- More places later are the same INSERT and a print, e.g.
--   ('1fd98796-…', 'KKC-DIA', 'Dialysis unit', 'dialysis'),
--   ('1fd98796-…', 'KKC-PH',  'Pharmacy',      'pharmacy')

NOTIFY pgrst, 'reload schema';

COMMIT;
