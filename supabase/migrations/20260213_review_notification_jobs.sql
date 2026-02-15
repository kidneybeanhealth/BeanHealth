-- WhatsApp reminder infrastructure for hospital review tracking
-- Manual reminder button support + worker claim queue

BEGIN;

CREATE TABLE IF NOT EXISTS public.hospital_whatsapp_settings (
    hospital_id UUID PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT false,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    meta_phone_number_id TEXT NULL,
    template_review_d7 TEXT NULL,
    template_review_d1 TEXT NULL,
    template_review_d0 TEXT NULL,
    template_review_manual TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_review_notification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.hospital_patient_reviews(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    linked_user_id UUID NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('review_d_minus_7', 'review_d_minus_1', 'review_day', 'manual_reminder')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'retrying', 'failed', 'skipped', 'cancelled')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    provider_message_id TEXT NULL,
    error_message TEXT NULL,
    sent_at TIMESTAMPTZ NULL,
    created_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active scheduled job per reminder type per review.
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_notification_jobs_active
ON public.hospital_review_notification_jobs(review_id, notification_type)
WHERE status IN ('pending', 'processing', 'retrying');

CREATE INDEX IF NOT EXISTS idx_review_notification_jobs_due
ON public.hospital_review_notification_jobs(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_review_notification_jobs_hospital
ON public.hospital_review_notification_jobs(hospital_id, status, scheduled_for);

-- Queue a manual reminder from reception.
CREATE OR REPLACE FUNCTION public.queue_manual_review_reminder(
    p_review_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_review RECORD;
    v_phone TEXT;
    v_existing_job UUID;
    v_job_id UUID;
    v_consent BOOLEAN := TRUE;
BEGIN
    SELECT
        r.id,
        r.hospital_id,
        r.patient_id,
        r.status,
        p.phone
    INTO v_review
    FROM public.hospital_patient_reviews r
    JOIN public.hospital_patients p ON p.id = r.patient_id
    WHERE r.id = p_review_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('queued', false, 'reason', 'review_not_found');
    END IF;

    IF v_review.status IN ('completed', 'cancelled') THEN
        RETURN jsonb_build_object('queued', false, 'reason', 'review_not_active');
    END IF;

    v_phone := NULLIF(TRIM(COALESCE(v_review.phone, '')), '');
    IF v_phone IS NULL THEN
        INSERT INTO public.hospital_review_notification_jobs (
            review_id, hospital_id, patient_id, notification_type, scheduled_for, status, error_message, created_by
        ) VALUES (
            v_review.id, v_review.hospital_id, v_review.patient_id, 'manual_reminder', now(), 'skipped', 'missing_phone', auth.uid()
        );
        RETURN jsonb_build_object('queued', false, 'reason', 'missing_phone');
    END IF;

    BEGIN
        SELECT EXISTS (
            SELECT 1
            FROM public.patient_hospital_links phl
            WHERE phl.hospital_id = v_review.hospital_id
              AND phl.patient_id = v_review.patient_id
              AND phl.consent_given = TRUE
        ) INTO v_consent;
    EXCEPTION
        WHEN undefined_table THEN
            v_consent := TRUE;
    END;

    IF NOT v_consent THEN
        INSERT INTO public.hospital_review_notification_jobs (
            review_id, hospital_id, patient_id, notification_type, scheduled_for, status, error_message, created_by
        ) VALUES (
            v_review.id, v_review.hospital_id, v_review.patient_id, 'manual_reminder', now(), 'skipped', 'consent_missing', auth.uid()
        );
        RETURN jsonb_build_object('queued', false, 'reason', 'consent_missing');
    END IF;

    SELECT id INTO v_existing_job
    FROM public.hospital_review_notification_jobs
    WHERE review_id = v_review.id
      AND notification_type = 'manual_reminder'
      AND status IN ('pending', 'processing', 'retrying')
      AND created_at >= (now() - interval '10 minutes')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_job IS NOT NULL THEN
        RETURN jsonb_build_object('queued', true, 'job_id', v_existing_job, 'deduped', true);
    END IF;

    INSERT INTO public.hospital_review_notification_jobs (
        review_id,
        hospital_id,
        patient_id,
        notification_type,
        scheduled_for,
        status,
        created_by
    ) VALUES (
        v_review.id,
        v_review.hospital_id,
        v_review.patient_id,
        'manual_reminder',
        now(),
        'pending',
        auth.uid()
    )
    RETURNING id INTO v_job_id;

    RETURN jsonb_build_object('queued', true, 'job_id', v_job_id, 'deduped', false);
END;
$$;

REVOKE ALL ON FUNCTION public.queue_manual_review_reminder(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_manual_review_reminder(UUID) TO authenticated;

-- Worker helper: atomically claim due jobs.
CREATE OR REPLACE FUNCTION public.claim_review_notification_jobs(
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    review_id UUID,
    hospital_id UUID,
    patient_id UUID,
    notification_type TEXT,
    scheduled_for TIMESTAMPTZ,
    attempt_count INTEGER,
    max_attempts INTEGER
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    WITH due_jobs AS (
        SELECT j.id
        FROM public.hospital_review_notification_jobs j
        WHERE j.status IN ('pending', 'retrying')
          AND j.scheduled_for <= now()
          AND j.attempt_count < j.max_attempts
        ORDER BY j.scheduled_for ASC
        LIMIT GREATEST(COALESCE(p_limit, 20), 1)
        FOR UPDATE SKIP LOCKED
    ),
    claimed AS (
        UPDATE public.hospital_review_notification_jobs j
        SET
            status = 'processing',
            updated_at = now()
        FROM due_jobs d
        WHERE j.id = d.id
        RETURNING
            j.id,
            j.review_id,
            j.hospital_id,
            j.patient_id,
            j.notification_type,
            j.scheduled_for,
            j.attempt_count,
            j.max_attempts
    )
    SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_review_notification_jobs(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_review_notification_jobs(INTEGER) TO service_role;

COMMIT;
