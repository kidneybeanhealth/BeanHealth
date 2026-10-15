-- ═══════════════════════════════════════════════════════════════════════════
-- Patient feedback: the inpatient's room number, and "Other" doctor by name
-- Date: 2026-10-15 · Safe to re-run · Run AFTER 20261008b_feedback_anonymous_submit_fix.sql
--
-- 1. room_number — every KKC ward room carries the same generic IP sticker, so
--    a response cannot say which room it came from. The inpatient form asks
--    for the room (required there, enforced by the form); this stores it.
--    The response stays anonymous unless the patient also shares their MR.
--
-- 2. rated_doctor_other — "Which doctor did you see?" offers the hospital's
--    doctors and "Others", which opens an optional box for a name. A picked
--    doctor goes in rated_doctor_id as before; a typed name goes here, and only
--    when no listed doctor was picked.
--
-- The argument list changes, so BOTH earlier versions (12 and 13 arguments) are
-- dropped first: versions differing only by defaulted arguments make PostgREST
-- refuse every call as ambiguous. The client sends the new arguments only when
-- it has them, so a plain response still matches if the frontend ships first.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.hospital_feedback
    ADD COLUMN IF NOT EXISTS room_number TEXT,
    ADD COLUMN IF NOT EXISTS rated_doctor_other TEXT;

DROP FUNCTION IF EXISTS public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT);

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
    p_rated_doctor_id   UUID    DEFAULT NULL,
    p_room_number       TEXT    DEFAULT NULL,
    p_rated_doctor_other TEXT   DEFAULT NULL
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
    -- "  ward 2 / 14 " -> "WARD 2 / 14". Free text, because rooms are not all
    -- numbers (ICU, A12); capped so a pasted paragraph cannot land here.
    v_room      TEXT := NULLIF(left(upper(regexp_replace(trim(COALESCE(p_room_number, '')), '\s+', ' ', 'g')), 20), '');
    -- A doctor not on the list, by the name the patient typed (optional).
    v_rated_other TEXT := NULLIF(left(regexp_replace(trim(COALESCE(p_rated_doctor_other, '')), '\s+', ' ', 'g'), 60), '');
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
            patient_id, shared_with_doctor, doctor_id, rated_doctor_id, rated_doctor_other, room_number,
            language, source, submission_key, audio_path, audio_seconds
        ) VALUES (
            v_loc.hospital_id, v_loc.id, NULLIF(TRIM(COALESCE(p_visit_type, '')), ''),
            v_ratings, NULLIF(TRIM(COALESCE(p_comment, '')), ''),
            v_patient,
            COALESCE(p_share_with_doctor, FALSE) AND v_patient IS NOT NULL,
            v_doctor,
            v_rated,
            -- Only when no listed doctor was picked: one answer, never two.
            CASE WHEN v_rated IS NULL THEN v_rated_other END,
            v_room,
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

REVOKE ALL ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
