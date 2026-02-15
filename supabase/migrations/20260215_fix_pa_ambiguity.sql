-- Migration: Fix ambiguous "id" references and rename output columns for clarity
-- Created: 2026-02-15
-- Objectives: 
-- 1. Identify and fix ambiguous 'id' references in PA/Audit functions.
-- 2. Rename output columns to avoid shading with table columns.
-- 3. Ensure all UPDATES and DELETES are fully qualified.

BEGIN;

-- 0. Ensure attribution columns exist (robustness against schema resets)
ALTER TABLE public.hospital_prescriptions
ADD COLUMN IF NOT EXISTS prescribed_by_actor_type TEXT NOT NULL DEFAULT 'chief' CHECK (prescribed_by_actor_type IN ('chief', 'assistant')),
ADD COLUMN IF NOT EXISTS prescribed_by_assistant_id UUID NULL REFERENCES public.hospital_doctor_assistants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS prescribed_by_name TEXT NULL,
ADD COLUMN IF NOT EXISTS actor_session_id UUID NULL REFERENCES public.hospital_doctor_actor_sessions(id) ON DELETE SET NULL;

-- 1. Fix _doctor_resolve_actor_session
CREATE OR REPLACE FUNCTION public._doctor_resolve_actor_session(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT
)
RETURNS TABLE(
    session_id UUID,
    actor_type TEXT,
    assistant_id UUID,
    actor_display_name TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_token_hash TEXT;
    v_actor RECORD;
BEGIN
    IF NULLIF(TRIM(COALESCE(p_session_token, '')), '') IS NULL THEN
        RETURN;
    END IF;

    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    SELECT
        s.id,
        s.actor_type,
        s.assistant_id,
        CASE
            WHEN s.actor_type = 'assistant' THEN COALESCE(a.assistant_name, 'Assistant')
            ELSE COALESCE(d.name, 'Chief Doctor')
        END AS actor_display_name,
        s.expires_at
    INTO v_actor
    FROM public.hospital_doctor_actor_sessions s
    JOIN public.hospital_doctors d
      ON d.id = s.chief_doctor_id
     AND d.hospital_id = s.hospital_id
    LEFT JOIN public.hospital_doctor_assistants a
      ON a.id = s.assistant_id
    WHERE s.hospital_id = p_hospital_id
      AND s.chief_doctor_id = p_chief_doctor_id
      AND s.session_token_hash = v_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND (
        s.actor_type = 'chief'
        OR (s.actor_type = 'assistant' AND a.is_active = true)
      );
    RAISE NOTICE 'DEBUG: Resolving session for hospital=%, chief=%, token_hash=%', p_hospital_id, p_chief_doctor_id, v_token_hash;

    IF v_actor.id IS NULL THEN
        RAISE NOTICE 'DEBUG: Session NOT FOUND or EXPIRED for token_hash=%', v_token_hash;
        RETURN;
    END IF;

    RAISE NOTICE 'DEBUG: Session FOUND id=%, actor=%, assistant=%', v_actor.id, v_actor.actor_type, v_actor.assistant_id;

    UPDATE public.hospital_doctor_actor_sessions
    SET last_seen_at = now()
    WHERE public.hospital_doctor_actor_sessions.id = v_actor.id;

    RETURN QUERY
    SELECT
        v_actor.id::UUID,
        v_actor.actor_type::TEXT,
        v_actor.assistant_id::UUID,
        v_actor.actor_display_name::TEXT,
        v_actor.expires_at::TIMESTAMPTZ;
END;
$$;

-- 2. Fix doctor_actor_login (qualify returning id)
-- No changes needed to signature, just the internal qualification.
CREATE OR REPLACE FUNCTION public.doctor_actor_login(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_actor_type TEXT,
    p_assistant_code TEXT DEFAULT NULL,
    p_passcode TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT NULL
)
RETURNS TABLE(
    session_token TEXT,
    session_id UUID,
    actor_type TEXT,
    assistant_id UUID,
    actor_display_name TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_doctor RECORD;
    v_assistant RECORD;
    v_actor_type TEXT;
    v_session_id UUID;
    v_session_token TEXT;
    v_session_token_hash TEXT;
    v_expires_at TIMESTAMPTZ := now() + interval '4 hours';
    v_actor_display_name TEXT;
    v_assistant_id UUID;
BEGIN
    v_actor_type := lower(trim(COALESCE(p_actor_type, '')));

    IF v_actor_type NOT IN ('chief', 'assistant') THEN
        RAISE EXCEPTION 'Invalid actor type';
    END IF;

    IF NULLIF(TRIM(COALESCE(p_passcode, '')), '') IS NULL THEN
        PERFORM public._doctor_insert_audit_log(
            p_hospital_id,
            p_chief_doctor_id,
            v_actor_type,
            NULL,
            CASE WHEN v_actor_type = 'assistant' THEN COALESCE(p_assistant_code, 'Unknown Assistant') ELSE 'Chief Doctor' END,
            'auth.login.failed',
            'auth',
            NULL,
            NULL,
            NULL,
            '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT,
            jsonb_build_object('reason', 'missing_passcode')
        );
        RAISE EXCEPTION 'Invalid credentials';
    END IF;

    SELECT d.id, d.name, d.access_code
    INTO v_doctor
    FROM public.hospital_doctors d
    WHERE d.id = p_chief_doctor_id
      AND d.hospital_id = p_hospital_id
      AND d.is_active = true
    LIMIT 1;

    IF v_doctor.id IS NULL THEN
        PERFORM public._doctor_insert_audit_log(
            p_hospital_id,
            p_chief_doctor_id,
            v_actor_type,
            NULL,
            'Unknown',
            'auth.login.failed',
            'auth',
            NULL,
            NULL,
            NULL,
            '/enterprise-dashboard/doctors',
            jsonb_build_object('reason', 'doctor_not_found')
        );
        RAISE EXCEPTION 'Invalid credentials';
    END IF;

    IF v_actor_type = 'chief' THEN
        IF NOT public._doctor_passcode_matches(v_doctor.access_code, p_passcode) THEN
            PERFORM public._doctor_insert_audit_log(
                p_hospital_id,
                p_chief_doctor_id,
                'chief',
                NULL,
                COALESCE(v_doctor.name, 'Chief Doctor'),
                'auth.login.failed',
                'auth',
                NULL,
                NULL,
                NULL,
                '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT,
                jsonb_build_object('reason', 'invalid_passcode')
            );
            RAISE EXCEPTION 'Invalid credentials';
        END IF;

        IF v_doctor.access_code IS NOT NULL AND v_doctor.access_code NOT LIKE '$2%' THEN
            UPDATE public.hospital_doctors
            SET access_code = crypt(p_passcode, gen_salt('bf', 10))
            WHERE public.hospital_doctors.id = p_chief_doctor_id;
        END IF;

        v_actor_display_name := COALESCE(v_doctor.name, 'Chief Doctor');
        v_assistant_id := NULL;
    ELSE
        SELECT a.*
        INTO v_assistant
        FROM public.hospital_doctor_assistants a
        WHERE a.hospital_id = p_hospital_id
          AND a.chief_doctor_id = p_chief_doctor_id
          AND lower(a.assistant_code) = lower(trim(COALESCE(p_assistant_code, '')))
          AND a.is_active = true
        LIMIT 1;

        IF v_assistant.id IS NULL OR NOT public._doctor_passcode_matches(v_assistant.passcode_hash, p_passcode) THEN
            PERFORM public._doctor_insert_audit_log(
                p_hospital_id,
                p_chief_doctor_id,
                'assistant',
                COALESCE(v_assistant.id, NULL),
                COALESCE(v_assistant.assistant_name, COALESCE(p_assistant_code, 'Unknown Assistant')),
                'auth.login.failed',
                'auth',
                NULL,
                NULL,
                NULL,
                '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT,
                jsonb_build_object('reason', 'invalid_assistant_credentials')
            );
            RAISE EXCEPTION 'Invalid credentials';
        END IF;

        UPDATE public.hospital_doctor_assistants
        SET last_login_at = now(), updated_at = now()
        WHERE public.hospital_doctor_assistants.id = v_assistant.id;

        v_actor_display_name := v_assistant.assistant_name;
        v_assistant_id := v_assistant.id;
    END IF;

    v_session_token := encode(gen_random_bytes(32), 'hex');
    v_session_token_hash := encode(digest(v_session_token, 'sha256'), 'hex');

    INSERT INTO public.hospital_doctor_actor_sessions (
        hospital_id,
        chief_doctor_id,
        actor_type,
        assistant_id,
        session_token_hash,
        expires_at,
        device_info
    ) VALUES (
        p_hospital_id,
        p_chief_doctor_id,
        v_actor_type,
        v_assistant_id,
        v_session_token_hash,
        v_expires_at,
        p_device_info
    )
    RETURNING public.hospital_doctor_actor_sessions.id INTO v_session_id;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_actor_type,
        v_assistant_id,
        v_actor_display_name,
        'auth.login.success',
        'auth',
        NULL,
        NULL,
        NULL,
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT,
        jsonb_build_object('device_info', COALESCE(p_device_info, '{}'::jsonb))
    );

    RETURN QUERY
    SELECT
        v_session_token,
        v_session_id,
        v_actor_type,
        v_assistant_id,
        v_actor_display_name,
        v_expires_at;
END;
$$;

-- 3. Fix doctor_list_assistants (rename id -> assistant_id)
DROP FUNCTION IF EXISTS public.doctor_list_assistants(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.doctor_list_assistants(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT
)
RETURNS TABLE(
    assistant_id UUID,
    assistant_name TEXT,
    assistant_code TEXT,
    is_active BOOLEAN,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    PERFORM 1
    FROM public._doctor_require_chief_session(p_hospital_id, p_chief_doctor_id, p_session_token);

    RETURN QUERY
    SELECT
        a.id as assistant_id,
        a.assistant_name,
        a.assistant_code,
        a.is_active,
        a.last_login_at,
        a.created_at,
        a.updated_at
    FROM public.hospital_doctor_assistants a
    WHERE a.hospital_id = p_hospital_id
      AND a.chief_doctor_id = p_chief_doctor_id
    ORDER BY a.created_at DESC;
END;
$$;

-- 4. Fix doctor_create_assistant (rename id -> assistant_id)
DROP FUNCTION IF EXISTS public.doctor_create_assistant(UUID, UUID, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.doctor_create_assistant(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_assistant_name TEXT,
    p_assistant_code TEXT,
    p_passcode TEXT
)
RETURNS TABLE(
    assistant_id UUID,
    assistant_name TEXT,
    assistant_code TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_chief RECORD;
    v_assistant_id UUID;
    v_assistant_name TEXT;
    v_assistant_code TEXT;
BEGIN
    SELECT *
    INTO v_chief
    FROM public._doctor_require_chief_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    v_assistant_name := NULLIF(TRIM(COALESCE(p_assistant_name, '')), '');
    v_assistant_code := upper(NULLIF(TRIM(COALESCE(p_assistant_code, '')), ''));

    IF v_assistant_name IS NULL OR v_assistant_code IS NULL THEN
        RAISE EXCEPTION 'Assistant name and code are required';
    END IF;

    IF NULLIF(TRIM(COALESCE(p_passcode, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Assistant passcode is required';
    END IF;

    INSERT INTO public.hospital_doctor_assistants (
        hospital_id,
        chief_doctor_id,
        assistant_name,
        assistant_code,
        passcode_hash,
        is_active
    )
    VALUES (
        p_hospital_id,
        p_chief_doctor_id,
        v_assistant_name,
        v_assistant_code,
        crypt(p_passcode, gen_salt('bf', 10)),
        true
    )
    RETURNING id INTO v_assistant_id;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_chief.actor_type,
        v_chief.assistant_id,
        v_chief.actor_display_name,
        'write.assistant.create',
        'write',
        NULL,
        NULL,
        NULL,
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT || '/dashboard',
        jsonb_build_object('assistant_id', v_assistant_id, 'assistant_code', v_assistant_code)
    );

    RETURN QUERY
    SELECT
        a.id as assistant_id,
        a.assistant_name,
        a.assistant_code,
        a.is_active,
        a.created_at
    FROM public.hospital_doctor_assistants a
    WHERE a.id = v_assistant_id;
END;
$$;

-- 5. Fix doctor_save_prescription_and_send (qualify id at 1071)
DROP FUNCTION IF EXISTS public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, TEXT, JSONB, TEXT, DATE, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.doctor_save_prescription_and_send(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_patient_id UUID,
    p_queue_id UUID,
    p_token_number TEXT,
    p_medications JSONB,
    p_notes TEXT,
    p_next_review_date DATE DEFAULT NULL,
    p_tests_to_review TEXT DEFAULT NULL,
    p_specialists_to_review TEXT DEFAULT NULL
)
RETURNS TABLE(
    saved_prescription_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_patient RECORD;
    v_existing_prescription_id UUID;
    v_prescription_id UUID;
    v_pharmacy_queue_id UUID;
    v_medication_count INTEGER := 0;
BEGIN
    SELECT *
    INTO v_actor
    FROM public._doctor_require_actor_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    SELECT id, name
    INTO v_patient
    FROM public.hospital_patients
    WHERE id = p_patient_id
      AND hospital_id = p_hospital_id
    LIMIT 1;

    IF v_patient.id IS NULL THEN
        RAISE EXCEPTION 'Patient not found';
    END IF;

    SELECT id 
    INTO v_existing_prescription_id
    FROM public.hospital_prescriptions
    WHERE hospital_id = p_hospital_id
      AND doctor_id = p_chief_doctor_id
      AND patient_id = p_patient_id
      AND CAST(created_at AS DATE) = CURRENT_DATE
    LIMIT 1;

    IF v_existing_prescription_id IS NOT NULL THEN
        UPDATE public.hospital_prescriptions
        SET 
            medications = p_medications,
            notes = p_notes,
            token_number = COALESCE(p_token_number, token_number),
            next_review_date = p_next_review_date,
            tests_to_review = p_tests_to_review,
            specialists_to_review = p_specialists_to_review,
            updated_at = now(),
            prescribed_by_actor_type = v_actor.actor_type,
            prescribed_by_assistant_id = v_actor.assistant_id,
            prescribed_by_name = v_actor.actor_display_name,
            actor_session_id = v_actor.session_id
        WHERE id = v_existing_prescription_id;

        v_prescription_id := v_existing_prescription_id;
    ELSE
        INSERT INTO public.hospital_prescriptions (
            hospital_id,
            doctor_id,
            patient_id,
            token_number,
            medications,
            notes,
            next_review_date,
            tests_to_review,
            specialists_to_review,
            prescribed_by_actor_type,
            prescribed_by_assistant_id,
            prescribed_by_name,
            actor_session_id
        )
        VALUES (
            p_hospital_id,
            p_chief_doctor_id,
            p_patient_id,
            p_token_number,
            p_medications,
            p_notes,
            p_next_review_date,
            p_tests_to_review,
            p_specialists_to_review,
            v_actor.actor_type,
            v_actor.assistant_id,
            v_actor.actor_display_name,
            v_actor.session_id
        )
        RETURNING id INTO v_prescription_id;
    END IF;

    v_medication_count := jsonb_array_length(p_medications);

    SELECT q.id INTO v_pharmacy_queue_id
    FROM public.hospital_pharmacy_queue q
    WHERE q.prescription_id = v_prescription_id
    LIMIT 1;

    IF v_pharmacy_queue_id IS NULL THEN
        INSERT INTO public.hospital_pharmacy_queue (
            hospital_id,
            prescription_id,
            patient_name,
            token_number,
            status
        )
        VALUES (
            p_hospital_id,
            v_prescription_id,
            v_patient.name,
            COALESCE(p_token_number, ''),
            'waiting'
        );
    ELSE
        UPDATE public.hospital_pharmacy_queue q
        SET
            patient_name = v_patient.name,
            token_number = COALESCE(p_token_number, q.token_number),
            status = 'waiting'
        WHERE q.id = v_pharmacy_queue_id;
    END IF;

    UPDATE public.hospital_queues q
    SET
        status = 'completed',
        updated_at = now(),
        completed_by_actor_type = v_actor.actor_type,
        completed_by_assistant_id = v_actor.assistant_id,
        completed_by_name = v_actor.actor_display_name,
        completed_actor_session_id = v_actor.session_id
    WHERE q.id = p_queue_id;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_actor.actor_type,
        v_actor.assistant_id,
        v_actor.actor_display_name,
        'write.prescription.save_send',
        'write',
        p_patient_id,
        p_queue_id,
        v_prescription_id,
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT || '/dashboard',
        jsonb_build_object('medication_count', v_medication_count)
    );

    RETURN QUERY SELECT v_prescription_id;
END;
$$;

-- 6. Fix doctor_mark_queue_done (qualify id at 1143)
CREATE OR REPLACE FUNCTION public.doctor_mark_queue_done(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_queue_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_queue RECORD;
BEGIN
    SELECT *
    INTO v_actor
    FROM public._doctor_require_actor_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    SELECT q.id, q.patient_id
    INTO v_queue
    FROM public.hospital_queues q
    WHERE q.id = p_queue_id
      AND q.hospital_id = p_hospital_id
      AND q.doctor_id = p_chief_doctor_id
    LIMIT 1;

    IF v_queue.id IS NULL THEN
        RAISE EXCEPTION 'Queue entry not found';
    END IF;

    UPDATE public.hospital_queues
    SET
        status = 'completed',
        updated_at = now(),
        completed_by_actor_type = v_actor.actor_type,
        completed_by_assistant_id = v_actor.assistant_id,
        completed_by_name = v_actor.actor_display_name,
        completed_actor_session_id = v_actor.session_id
    WHERE public.hospital_queues.id = p_queue_id;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_actor.actor_type,
        v_actor.assistant_id,
        v_actor.actor_display_name,
        'write.queue.mark_done',
        'write',
        v_queue.patient_id,
        p_queue_id,
        NULL,
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT || '/dashboard',
        jsonb_build_object('queue_id', p_queue_id)
    );

    RETURN true;
END;
$$;

-- 7. Fix doctor_get_audit_logs (rename id -> audit_id)
DROP FUNCTION IF EXISTS public.doctor_get_audit_logs(UUID, UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.doctor_get_audit_logs(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_page INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 50,
    p_start_at TIMESTAMPTZ DEFAULT NULL,
    p_end_at TIMESTAMPTZ DEFAULT NULL,
    p_assistant_id UUID DEFAULT NULL,
    p_patient_id UUID DEFAULT NULL,
    p_event_type TEXT DEFAULT NULL,
    p_event_category TEXT DEFAULT NULL
)
RETURNS TABLE(
    audit_id BIGINT,
    created_at TIMESTAMPTZ,
    actor_type TEXT,
    assistant_id UUID,
    actor_display_name TEXT,
    event_type TEXT,
    event_category TEXT,
    audit_patient_id UUID,
    patient_name TEXT,
    patient_mr_number TEXT,
    audit_queue_id UUID,
    audit_prescription_id UUID,
    route TEXT,
    metadata JSONB,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
    v_offset INTEGER := GREATEST(COALESCE(p_page, 0), 0) * LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
    PERFORM 1
    FROM public._doctor_require_chief_session(p_hospital_id, p_chief_doctor_id, p_session_token);

    RETURN QUERY
    WITH filtered AS (
        SELECT
            a.id,
            a.created_at,
            a.actor_type,
            a.assistant_id,
            a.actor_display_name,
            a.event_type,
            a.event_category,
            a.patient_id as audit_patient_id,
            p.name AS patient_name,
            p.mr_number AS patient_mr_number,
            a.queue_id as audit_queue_id,
            a.prescription_id as audit_prescription_id,
            a.route,
            a.metadata
        FROM public.hospital_activity_audit_log a
        LEFT JOIN public.hospital_patients p
            ON p.id = a.patient_id
        WHERE a.hospital_id = p_hospital_id
          AND a.chief_doctor_id = p_chief_doctor_id
          AND (p_start_at IS NULL OR a.created_at >= p_start_at)
          AND (p_end_at IS NULL OR a.created_at <= p_end_at)
          AND (p_assistant_id IS NULL OR a.assistant_id = p_assistant_id)
          AND (p_patient_id IS NULL OR a.patient_id = p_patient_id)
          AND (p_event_type IS NULL OR a.event_type = p_event_type)
          AND (p_event_category IS NULL OR a.event_category = p_event_category)
    )
    SELECT
        f.id as audit_id,
        f.created_at,
        f.actor_type,
        f.assistant_id,
        f.actor_display_name,
        f.event_type,
        f.event_category,
        f.audit_patient_id,
        f.patient_name,
        f.patient_mr_number,
        f.audit_queue_id,
        f.audit_prescription_id,
        f.route,
        f.metadata,
        COUNT(*) OVER () AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;

COMMIT;
