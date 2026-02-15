-- Add SMS/WhatsApp multi-channel support for review reminders

BEGIN;

ALTER TABLE public.hospital_review_notification_jobs
ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'
CHECK (channel IN ('sms', 'whatsapp')),
ADD COLUMN IF NOT EXISTS template_key TEXT NULL,
ADD COLUMN IF NOT EXISTS provider_payload JSONB NULL,
ADD COLUMN IF NOT EXISTS provider_response JSONB NULL,
ADD COLUMN IF NOT EXISTS sent_to TEXT NULL;

DROP INDEX IF EXISTS uq_review_notification_jobs_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_notification_jobs_active_channel
ON public.hospital_review_notification_jobs(review_id, notification_type, channel)
WHERE status IN ('pending', 'processing', 'retrying');

CREATE TABLE IF NOT EXISTS public.hospital_notification_settings (
    hospital_id UUID PRIMARY KEY,
    default_channel TEXT NOT NULL DEFAULT 'sms' CHECK (default_channel IN ('sms', 'whatsapp')),
    sms_enabled BOOLEAN NOT NULL DEFAULT true,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
    sms_sender_id TEXT NULL,
    sms_route TEXT NULL,
    sms_template_review_d7 TEXT NULL,
    sms_template_review_d1 TEXT NULL,
    sms_template_review_d0 TEXT NULL,
    sms_template_manual TEXT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.hospital_review_notification_jobs(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
    status TEXT NOT NULL,
    provider_message_id TEXT NULL,
    provider_response JSONB NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.queue_manual_review_reminder(
    p_review_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, extensions
AS $fn$
DECLARE
    v_review RECORD;
    v_phone TEXT;
    v_existing_job UUID;
    v_job_id UUID;
    v_consent BOOLEAN := TRUE;
    v_channel TEXT := 'sms';
    v_sms_enabled BOOLEAN := TRUE;
    v_whatsapp_enabled BOOLEAN := FALSE;
    v_template_key TEXT := 'manual_reminder';
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
            review_id, hospital_id, patient_id, channel, notification_type, template_key,
            scheduled_for, status, error_message, created_by
        ) VALUES (
            v_review.id, v_review.hospital_id, v_review.patient_id, 'sms', 'manual_reminder', v_template_key,
            now(), 'skipped', 'missing_phone', auth.uid()
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
            review_id, hospital_id, patient_id, channel, notification_type, template_key,
            scheduled_for, status, error_message, created_by
        ) VALUES (
            v_review.id, v_review.hospital_id, v_review.patient_id, 'sms', 'manual_reminder', v_template_key,
            now(), 'skipped', 'consent_missing', auth.uid()
        );
        RETURN jsonb_build_object('queued', false, 'reason', 'consent_missing');
    END IF;

    SELECT
        COALESCE(default_channel, 'sms'),
        COALESCE(sms_enabled, TRUE),
        COALESCE(whatsapp_enabled, FALSE)
    INTO
        v_channel, v_sms_enabled, v_whatsapp_enabled
    FROM public.hospital_notification_settings
    WHERE hospital_id = v_review.hospital_id;

    v_channel := COALESCE(v_channel, 'sms');

    IF v_channel = 'sms' AND NOT v_sms_enabled THEN
        RETURN jsonb_build_object('queued', false, 'reason', 'sms_disabled');
    END IF;

    IF v_channel = 'whatsapp' AND NOT v_whatsapp_enabled THEN
        RETURN jsonb_build_object('queued', false, 'reason', 'whatsapp_disabled');
    END IF;

    SELECT id
    INTO v_existing_job
    FROM public.hospital_review_notification_jobs
    WHERE review_id = v_review.id
      AND notification_type = 'manual_reminder'
      AND channel = v_channel
      AND status IN ('pending', 'processing', 'retrying')
      AND created_at >= (now() - interval '10 minutes')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_job IS NOT NULL THEN
        RETURN jsonb_build_object(
            'queued', true,
            'job_id', v_existing_job,
            'channel', v_channel,
            'deduped', true
        );
    END IF;

    INSERT INTO public.hospital_review_notification_jobs (
        review_id,
        hospital_id,
        patient_id,
        channel,
        notification_type,
        template_key,
        scheduled_for,
        status,
        sent_to,
        created_by
    ) VALUES (
        v_review.id,
        v_review.hospital_id,
        v_review.patient_id,
        v_channel,
        'manual_reminder',
        v_template_key,
        now(),
        'pending',
        v_phone,
        auth.uid()
    )
    RETURNING id INTO v_job_id;

    RETURN jsonb_build_object(
        'queued', true,
        'job_id', v_job_id,
        'channel', v_channel,
        'deduped', false
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.queue_manual_review_reminder(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_manual_review_reminder(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_review_notification_jobs(
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    review_id UUID,
    hospital_id UUID,
    patient_id UUID,
    channel TEXT,
    notification_type TEXT,
    template_key TEXT,
    sent_to TEXT,
    scheduled_for TIMESTAMPTZ,
    attempt_count INTEGER,
    max_attempts INTEGER
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $fn$
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
            j.channel,
            j.notification_type,
            j.template_key,
            j.sent_to,
            j.scheduled_for,
            j.attempt_count,
            j.max_attempts
    )
    SELECT * FROM claimed;
END;
$fn$;

REVOKE ALL ON FUNCTION public.claim_review_notification_jobs(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_review_notification_jobs(INTEGER) TO service_role;

COMMIT;
