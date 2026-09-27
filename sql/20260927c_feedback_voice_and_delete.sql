-- ═══════════════════════════════════════════════════════════════════════════
-- Patient feedback: voice notes, desk mode, and deletion
-- Date: 2026-09-27 · Run after 20260927_patient_feedback.sql · Safe to re-run
--
-- Voice notes. Most patients will not type a paragraph on a phone, and many who
-- would are more comfortable speaking Tamil than typing it. So the comment box
-- gains a record button, and the recording reaches the dashboards for the
-- hospital to listen to and then delete.
--
-- ── Who can do what with a recording ─────────────────────────────────────
-- The person recording is not signed in, so the bucket has to accept an upload
-- from anyone — and that is ALL anyone gets:
--   · anon/authenticated may INSERT, only into `incoming/`, only audio, ≤ 3 MB,
--     and never overwrite (there is no UPDATE policy)
--   · nobody may list or read the bucket except the hospital, and the hospital
--     only for a file that one of ITS feedback rows points at
--   · the same rule governs DELETE
-- The submit RPC then refuses to attach a path unless the object really exists,
-- sits in incoming/, was uploaded in the last two hours, and is not already
-- attached to another response — so a typed-in path cannot claim somebody
-- else's recording.
--
-- A voice is more identifying than a rating. The form says so next to the
-- button; "anonymous" here still means no name and no MR number is attached.
--
-- ── Deletion ─────────────────────────────────────────────────────────────
-- The hospital deletes a response once it has been dealt with, instead of
-- marking it seen. The existing RLS policy on hospital_feedback is FOR ALL, so
-- DELETE is already allowed for the owning hospital; the service removes the
-- recording BEFORE the row, because the storage policy needs the row to exist
-- to authorise deleting the file. Reversed, a failed file delete would strand a
-- voice recording nothing points at and nobody can reach.
--
-- ── Desk mode ────────────────────────────────────────────────────────────
-- The form can be opened from the dashboards on a clinic tablet and handed to
-- patient after patient. The per-phone daily throttle would swallow every
-- response after the first, so desk submissions send no device key, and are
-- tagged source = 'desk' so they can be told apart from poster scans.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.hospital_feedback
    ADD COLUMN IF NOT EXISTS audio_path    TEXT,
    ADD COLUMN IF NOT EXISTS audio_seconds INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_audio_path
    ON public.hospital_feedback (audio_path) WHERE audio_path IS NOT NULL;

-- ── Bucket ────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-audio', 'feedback-audio', false, 3145728, ARRAY['audio/*'])
ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "feedback_audio_upload" ON storage.objects;
CREATE POLICY "feedback_audio_upload"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
    bucket_id = 'feedback-audio'
    AND (storage.foldername(name))[1] = 'incoming'
);

DROP POLICY IF EXISTS "feedback_audio_hospital_read" ON storage.objects;
CREATE POLICY "feedback_audio_hospital_read"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'feedback-audio'
    AND EXISTS (
        SELECT 1 FROM public.hospital_feedback f
         WHERE f.audio_path = storage.objects.name
           AND f.hospital_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "feedback_audio_hospital_delete" ON storage.objects;
CREATE POLICY "feedback_audio_hospital_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'feedback-audio'
    AND EXISTS (
        SELECT 1 FROM public.hospital_feedback f
         WHERE f.audio_path = storage.objects.name
           AND f.hospital_id = auth.uid()
    )
);

-- ── Submit, now with a recording and a source ─────────────────────────────
-- The argument list changes, so the old function is dropped and recreated.
-- The new arguments all have defaults, so a page still calling with the old
-- eight named arguments keeps working while the new build rolls out.
DROP FUNCTION IF EXISTS public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT);

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
    p_source            TEXT    DEFAULT 'qr'
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

    -- Desk submissions skip the throttle: one tablet, many patients.
    IF v_source <> 'desk' AND COALESCE(TRIM(p_device_key), '') <> '' THEN
        v_key := md5(TRIM(p_device_key) || ':' || v_loc.id::TEXT || ':' || CURRENT_DATE::TEXT);
    END IF;

    BEGIN
        INSERT INTO public.hospital_feedback (
            hospital_id, location_id, visit_type, ratings, comment,
            patient_id, shared_with_doctor, doctor_id,
            language, source, submission_key, audio_path, audio_seconds
        ) VALUES (
            v_loc.hospital_id, v_loc.id, NULLIF(TRIM(COALESCE(p_visit_type, '')), ''),
            v_ratings, NULLIF(TRIM(COALESCE(p_comment, '')), ''),
            v_patient.id,
            COALESCE(p_share_with_doctor, FALSE) AND v_patient.id IS NOT NULL,
            v_doctor,
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

REVOKE ALL ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_hospital_feedback(TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Housekeeping, occasionally: recordings uploaded but never attached (a phone
-- that lost signal between upload and submit). Nobody can reach them, but they
-- are still somebody's voice. List them here, then delete them from the
-- Supabase dashboard (Storage ▸ feedback-audio ▸ incoming) or the Storage API —
-- a plain DELETE on storage.objects is blocked, and would not remove the file.
--   SELECT o.name, o.created_at
--     FROM storage.objects o
--    WHERE o.bucket_id = 'feedback-audio'
--      AND o.created_at < NOW() - INTERVAL '1 day'
--      AND NOT EXISTS (SELECT 1 FROM public.hospital_feedback f WHERE f.audio_path = o.name);
