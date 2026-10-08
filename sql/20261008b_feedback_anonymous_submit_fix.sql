-- ═══════════════════════════════════════════════════════════════════════════
-- Patient feedback: anonymous responses could not be saved
-- Date: 2026-10-08 · Safe to re-run · Run AFTER 20261008_feedback_places_and_doctors.sql
--
-- Every version of submit_hospital_feedback since 20260927 held the patient in
-- a RECORD variable that is filled only when the patient ticks "share with my
-- doctor" and types an MR number. With the box unticked — the default, and most
-- responses — nothing ever assigns it, and the INSERT reads v_patient.id
-- anyway: "record \"v_patient\" is not assigned yet" (55000). The patient sees
-- the error on Send and the response is lost.
--
-- The one response that did save (27 Sep) got through because the patient
-- ticked share with an MR number that matched nobody: the SELECT ran, found no
-- row, and that alone gave the record a shape.
--
-- Same signature as 20261008, so CREATE OR REPLACE keeps the grants.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

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
    -- A UUID, not a RECORD: a record that no SELECT INTO ever ran against has
    -- no structure, and reading .id off it raises 55000. That is exactly the
    -- anonymous case, which is most responses.
    v_patient   UUID;
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
        SELECT hp.id
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
                 WHERE r.patient_id = v_patient AND r.doctor_id IS NOT NULL
                 ORDER BY r.created_at DESC LIMIT 1;
            END IF;

            IF v_doctor IS NULL THEN
                SELECT pr.doctor_id INTO v_doctor
                  FROM public.hospital_prescriptions pr
                 WHERE pr.patient_id = v_patient AND pr.doctor_id IS NOT NULL
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
            v_patient,
            COALESCE(p_share_with_doctor, FALSE) AND v_patient IS NOT NULL,
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

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'identified', v_patient IS NOT NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
