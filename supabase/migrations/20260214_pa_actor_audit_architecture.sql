-- Enterprise PA actor identity + chief-only audit architecture
-- Adds:
-- 1) Feature flag on hospital profiles
-- 2) Assistant identities, actor sessions, and activity audit tables
-- 3) Attribution columns on prescriptions and queues
-- 4) SECURITY DEFINER RPCs for login/session validation, assistant management,
--    attributed write actions, and chief-only audit reads

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Feature flag
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.hospital_profiles') IS NOT NULL THEN
        ALTER TABLE public.hospital_profiles
        ADD COLUMN IF NOT EXISTS enable_pa_actor_auth BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Actor identity + audit tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospital_doctor_assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    chief_doctor_id UUID NOT NULL REFERENCES public.hospital_doctors(id) ON DELETE CASCADE,
    assistant_name TEXT NOT NULL,
    assistant_code TEXT NOT NULL,
    passcode_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT hospital_doctor_assistants_chief_code_key UNIQUE (chief_doctor_id, assistant_code)
);

CREATE INDEX IF NOT EXISTS idx_hospital_doctor_assistants_hospital_chief_active
ON public.hospital_doctor_assistants(hospital_id, chief_doctor_id, is_active);

CREATE TABLE IF NOT EXISTS public.hospital_doctor_actor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    chief_doctor_id UUID NOT NULL REFERENCES public.hospital_doctors(id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('chief', 'assistant')),
    assistant_id UUID NULL REFERENCES public.hospital_doctor_assistants(id) ON DELETE SET NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    device_info JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_doctor_actor_sessions_chief_expires
ON public.hospital_doctor_actor_sessions(chief_doctor_id, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS public.hospital_activity_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    chief_doctor_id UUID NOT NULL REFERENCES public.hospital_doctors(id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('chief', 'assistant')),
    assistant_id UUID NULL REFERENCES public.hospital_doctor_assistants(id) ON DELETE SET NULL,
    actor_display_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_category TEXT NOT NULL CHECK (event_category IN ('auth', 'view', 'write', 'print')),
    patient_id UUID NULL REFERENCES public.hospital_patients(id) ON DELETE SET NULL,
    queue_id UUID NULL REFERENCES public.hospital_queues(id) ON DELETE SET NULL,
    prescription_id UUID NULL REFERENCES public.hospital_prescriptions(id) ON DELETE SET NULL,
    route TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_activity_audit_log_chief_created
ON public.hospital_activity_audit_log(chief_doctor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hospital_activity_audit_log_assistant_created
ON public.hospital_activity_audit_log(assistant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hospital_activity_audit_log_patient_created
ON public.hospital_activity_audit_log(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hospital_activity_audit_log_event_created
ON public.hospital_activity_audit_log(event_type, created_at DESC);

ALTER TABLE public.hospital_doctor_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_doctor_actor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_activity_audit_log ENABLE ROW LEVEL SECURITY;

-- Block direct table access from clients; use RPC only.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'hospital_doctor_assistants'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS "Hospitals can manage own doctor assistants" ON public.hospital_doctor_assistants';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'hospital_doctor_actor_sessions'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS "Hospitals can manage own doctor actor sessions" ON public.hospital_doctor_actor_sessions';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'hospital_activity_audit_log'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS "Hospitals can read own activity audit" ON public.hospital_activity_audit_log';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Attribution columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.hospital_prescriptions
ADD COLUMN IF NOT EXISTS prescribed_by_actor_type TEXT NOT NULL DEFAULT 'chief' CHECK (prescribed_by_actor_type IN ('chief', 'assistant')),
ADD COLUMN IF NOT EXISTS prescribed_by_assistant_id UUID NULL REFERENCES public.hospital_doctor_assistants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS prescribed_by_name TEXT NULL,
ADD COLUMN IF NOT EXISTS actor_session_id UUID NULL REFERENCES public.hospital_doctor_actor_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.hospital_queues
ADD COLUMN IF NOT EXISTS completed_by_actor_type TEXT NULL CHECK (completed_by_actor_type IN ('chief', 'assistant')),
ADD COLUMN IF NOT EXISTS completed_by_assistant_id UUID NULL REFERENCES public.hospital_doctor_assistants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS completed_by_name TEXT NULL,
ADD COLUMN IF NOT EXISTS completed_actor_session_id UUID NULL REFERENCES public.hospital_doctor_actor_sessions(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- Helper functions (internal)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._doctor_passcode_matches(
    p_stored TEXT,
    p_passcode TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF p_stored IS NULL OR p_passcode IS NULL THEN
        RETURN false;
    END IF;

    IF p_stored LIKE '$2%' THEN
        RETURN crypt(p_passcode, p_stored) = p_stored;
    END IF;

    RETURN p_stored = p_passcode;
END;
$$;

CREATE OR REPLACE FUNCTION public._doctor_insert_audit_log(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_actor_type TEXT,
    p_assistant_id UUID,
    p_actor_display_name TEXT,
    p_event_type TEXT,
    p_event_category TEXT,
    p_patient_id UUID DEFAULT NULL,
    p_queue_id UUID DEFAULT NULL,
    p_prescription_id UUID DEFAULT NULL,
    p_route TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    INSERT INTO public.hospital_activity_audit_log (
        hospital_id,
        chief_doctor_id,
        actor_type,
        assistant_id,
        actor_display_name,
        event_type,
        event_category,
        patient_id,
        queue_id,
        prescription_id,
        route,
        metadata
    )
    VALUES (
        p_hospital_id,
        p_chief_doctor_id,
        p_actor_type,
        p_assistant_id,
        COALESCE(NULLIF(TRIM(p_actor_display_name), ''), 'Unknown Actor'),
        p_event_type,
        p_event_category,
        p_patient_id,
        p_queue_id,
        p_prescription_id,
        p_route,
        COALESCE(p_metadata, '{}'::jsonb)
    );
END;
$$;

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
      )
    LIMIT 1;

    IF v_actor.id IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.hospital_doctor_actor_sessions
    SET last_seen_at = now()
    WHERE id = v_actor.id;

    RETURN QUERY
    SELECT
        v_actor.id::UUID,
        v_actor.actor_type::TEXT,
        v_actor.assistant_id::UUID,
        v_actor.actor_display_name::TEXT,
        v_actor.expires_at::TIMESTAMPTZ;
END;
$$;

CREATE OR REPLACE FUNCTION public._doctor_require_actor_session(
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
    v_actor RECORD;
BEGIN
    SELECT *
    INTO v_actor
    FROM public._doctor_resolve_actor_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    IF v_actor.session_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired doctor actor session';
    END IF;

    RETURN QUERY
    SELECT
        v_actor.session_id::UUID,
        v_actor.actor_type::TEXT,
        v_actor.assistant_id::UUID,
        v_actor.actor_display_name::TEXT,
        v_actor.expires_at::TIMESTAMPTZ;
END;
$$;

CREATE OR REPLACE FUNCTION public._doctor_require_chief_session(
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
    v_actor RECORD;
BEGIN
    SELECT *
    INTO v_actor
    FROM public._doctor_require_actor_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    IF v_actor.actor_type <> 'chief' THEN
        RAISE EXCEPTION 'Chief authorization required';
    END IF;

    RETURN QUERY
    SELECT
        v_actor.session_id::UUID,
        v_actor.actor_type::TEXT,
        v_actor.assistant_id::UUID,
        v_actor.actor_display_name::TEXT,
        v_actor.expires_at::TIMESTAMPTZ;
END;
$$;

-- -----------------------------------------------------------------------------
-- Public RPCs
-- -----------------------------------------------------------------------------
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

        -- Gradual hardening: if chief passcode is still plain text, hash it after first valid login.
        IF v_doctor.access_code IS NOT NULL AND v_doctor.access_code NOT LIKE '$2%' THEN
            UPDATE public.hospital_doctors
            SET access_code = crypt(p_passcode, gen_salt('bf', 10))
            WHERE id = p_chief_doctor_id;
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
        WHERE id = v_assistant.id;

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
    RETURNING id INTO v_session_id;

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

CREATE OR REPLACE FUNCTION public.doctor_actor_validate(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT
)
RETURNS TABLE(
    session_id UUID,
    actor_type TEXT,
    assistant_id UUID,
    actor_display_name TEXT,
    expires_at TIMESTAMPTZ,
    can_manage_team BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.session_id,
        r.actor_type,
        r.assistant_id,
        r.actor_display_name,
        r.expires_at,
        (r.actor_type = 'chief') AS can_manage_team
    FROM public._doctor_resolve_actor_session(p_hospital_id, p_chief_doctor_id, p_session_token) r;
END;
$$;

CREATE OR REPLACE FUNCTION public.doctor_actor_logout(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT *
    INTO v_actor
    FROM public._doctor_resolve_actor_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    IF v_actor.session_id IS NULL THEN
        RETURN false;
    END IF;

    UPDATE public.hospital_doctor_actor_sessions
    SET revoked_at = now()
    WHERE id = v_actor.session_id;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_actor.actor_type,
        v_actor.assistant_id,
        v_actor.actor_display_name,
        'auth.logout',
        'auth',
        NULL,
        NULL,
        NULL,
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT || '/dashboard',
        '{}'::jsonb
    );

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.doctor_list_assistants(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT
)
RETURNS TABLE(
    id UUID,
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
        a.id,
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

CREATE OR REPLACE FUNCTION public.doctor_create_assistant(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_assistant_name TEXT,
    p_assistant_code TEXT,
    p_passcode TEXT
)
RETURNS TABLE(
    id UUID,
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
        a.id,
        a.assistant_name,
        a.assistant_code,
        a.is_active,
        a.created_at
    FROM public.hospital_doctor_assistants a
    WHERE a.id = v_assistant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.doctor_update_assistant(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_assistant_id UUID,
    p_assistant_name TEXT DEFAULT NULL,
    p_assistant_code TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    assistant_name TEXT,
    assistant_code TEXT,
    is_active BOOLEAN,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_chief RECORD;
BEGIN
    SELECT *
    INTO v_chief
    FROM public._doctor_require_chief_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    UPDATE public.hospital_doctor_assistants a
    SET
        assistant_name = COALESCE(NULLIF(TRIM(COALESCE(p_assistant_name, '')), ''), a.assistant_name),
        assistant_code = COALESCE(upper(NULLIF(TRIM(COALESCE(p_assistant_code, '')), '')), a.assistant_code),
        updated_at = now()
    WHERE a.id = p_assistant_id
      AND a.hospital_id = p_hospital_id
      AND a.chief_doctor_id = p_chief_doctor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assistant not found';
    END IF;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_chief.actor_type,
        v_chief.assistant_id,
        v_chief.actor_display_name,
        'write.assistant.update',
        'write',
        NULL,
        NULL,
        NULL,
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT || '/dashboard',
        jsonb_build_object('assistant_id', p_assistant_id)
    );

    RETURN QUERY
    SELECT
        a.id,
        a.assistant_name,
        a.assistant_code,
        a.is_active,
        a.updated_at
    FROM public.hospital_doctor_assistants a
    WHERE a.id = p_assistant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.doctor_reset_assistant_passcode(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_assistant_id UUID,
    p_new_passcode TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_chief RECORD;
BEGIN
    SELECT *
    INTO v_chief
    FROM public._doctor_require_chief_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    IF NULLIF(TRIM(COALESCE(p_new_passcode, '')), '') IS NULL THEN
        RAISE EXCEPTION 'New passcode is required';
    END IF;

    UPDATE public.hospital_doctor_assistants a
    SET
        passcode_hash = crypt(p_new_passcode, gen_salt('bf', 10)),
        updated_at = now()
    WHERE a.id = p_assistant_id
      AND a.hospital_id = p_hospital_id
      AND a.chief_doctor_id = p_chief_doctor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assistant not found';
    END IF;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_chief.actor_type,
        v_chief.assistant_id,
        v_chief.actor_display_name,
        'write.assistant.passcode_reset',
        'write',
        NULL,
        NULL,
        NULL,
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT || '/dashboard',
        jsonb_build_object('assistant_id', p_assistant_id)
    );

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.doctor_set_assistant_active(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_assistant_id UUID,
    p_is_active BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_chief RECORD;
BEGIN
    SELECT *
    INTO v_chief
    FROM public._doctor_require_chief_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    UPDATE public.hospital_doctor_assistants a
    SET
        is_active = COALESCE(p_is_active, a.is_active),
        updated_at = now()
    WHERE a.id = p_assistant_id
      AND a.hospital_id = p_hospital_id
      AND a.chief_doctor_id = p_chief_doctor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assistant not found';
    END IF;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_chief.actor_type,
        v_chief.assistant_id,
        v_chief.actor_display_name,
        'write.assistant.status',
        'write',
        NULL,
        NULL,
        NULL,
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT || '/dashboard',
        jsonb_build_object('assistant_id', p_assistant_id, 'is_active', p_is_active)
    );

    RETURN true;
END;
$$;

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
    prescription_id UUID
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

    SELECT p.id, p.name
    INTO v_patient
    FROM public.hospital_patients p
    WHERE p.id = p_patient_id
      AND p.hospital_id = p_hospital_id
    LIMIT 1;

    IF v_patient.id IS NULL THEN
        RAISE EXCEPTION 'Patient not found';
    END IF;

    PERFORM 1
    FROM public.hospital_queues q
    WHERE q.id = p_queue_id
      AND q.hospital_id = p_hospital_id
      AND q.doctor_id = p_chief_doctor_id
      AND q.patient_id = p_patient_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue entry not found for this doctor/patient';
    END IF;

    IF jsonb_typeof(COALESCE(p_medications, '[]'::jsonb)) = 'array' THEN
        v_medication_count := jsonb_array_length(COALESCE(p_medications, '[]'::jsonb));
    END IF;

    SELECT hp.id
    INTO v_existing_prescription_id
    FROM public.hospital_prescriptions hp
    WHERE hp.queue_id = p_queue_id
    ORDER BY hp.created_at DESC
    LIMIT 1;

    IF v_existing_prescription_id IS NULL THEN
        INSERT INTO public.hospital_prescriptions (
            hospital_id,
            doctor_id,
            patient_id,
            queue_id,
            token_number,
            medications,
            notes,
            next_review_date,
            tests_to_review,
            specialists_to_review,
            prescribed_by_actor_type,
            prescribed_by_assistant_id,
            prescribed_by_name,
            actor_session_id,
            status
        )
        VALUES (
            p_hospital_id,
            p_chief_doctor_id,
            p_patient_id,
            p_queue_id,
            p_token_number,
            COALESCE(p_medications, '[]'::jsonb),
            p_notes,
            p_next_review_date,
            p_tests_to_review,
            p_specialists_to_review,
            v_actor.actor_type,
            v_actor.assistant_id,
            v_actor.actor_display_name,
            v_actor.session_id,
            'pending'
        )
        RETURNING id INTO v_prescription_id;
    ELSE
        UPDATE public.hospital_prescriptions hp
        SET
            medications = COALESCE(p_medications, '[]'::jsonb),
            notes = p_notes,
            next_review_date = p_next_review_date,
            tests_to_review = p_tests_to_review,
            specialists_to_review = p_specialists_to_review,
            prescribed_by_actor_type = v_actor.actor_type,
            prescribed_by_assistant_id = v_actor.assistant_id,
            prescribed_by_name = v_actor.actor_display_name,
            actor_session_id = v_actor.session_id,
            status = 'pending',
            updated_at = now()
        WHERE hp.id = v_existing_prescription_id;

        v_prescription_id := v_existing_prescription_id;
    END IF;

    SELECT q.id
    INTO v_pharmacy_queue_id
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
        UPDATE public.hospital_pharmacy_queue
        SET
            patient_name = v_patient.name,
            token_number = COALESCE(p_token_number, token_number),
            status = 'waiting'
        WHERE id = v_pharmacy_queue_id;
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
    WHERE id = p_queue_id;

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
        '{}'::jsonb
    );

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.doctor_log_view_event(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_event_type TEXT,
    p_event_category TEXT DEFAULT 'view',
    p_patient_id UUID DEFAULT NULL,
    p_queue_id UUID DEFAULT NULL,
    p_prescription_id UUID DEFAULT NULL,
    p_route TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_event_category TEXT;
BEGIN
    SELECT *
    INTO v_actor
    FROM public._doctor_require_actor_session(p_hospital_id, p_chief_doctor_id, p_session_token)
    LIMIT 1;

    v_event_category := lower(COALESCE(p_event_category, 'view'));
    IF v_event_category NOT IN ('auth', 'view', 'write', 'print') THEN
        v_event_category := 'view';
    END IF;

    PERFORM public._doctor_insert_audit_log(
        p_hospital_id,
        p_chief_doctor_id,
        v_actor.actor_type,
        v_actor.assistant_id,
        v_actor.actor_display_name,
        p_event_type,
        v_event_category,
        p_patient_id,
        p_queue_id,
        p_prescription_id,
        p_route,
        COALESCE(p_metadata, '{}'::jsonb)
    );

    RETURN true;
END;
$$;

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
    id BIGINT,
    created_at TIMESTAMPTZ,
    actor_type TEXT,
    assistant_id UUID,
    actor_display_name TEXT,
    event_type TEXT,
    event_category TEXT,
    patient_id UUID,
    patient_name TEXT,
    patient_mr_number TEXT,
    queue_id UUID,
    prescription_id UUID,
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
            a.patient_id,
            p.name AS patient_name,
            p.mr_number AS patient_mr_number,
            a.queue_id,
            a.prescription_id,
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
        f.id,
        f.created_at,
        f.actor_type,
        f.assistant_id,
        f.actor_display_name,
        f.event_type,
        f.event_category,
        f.patient_id,
        f.patient_name,
        f.patient_mr_number,
        f.queue_id,
        f.prescription_id,
        f.route,
        f.metadata,
        COUNT(*) OVER () AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_hospital_activity_audit_logs()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_deleted BIGINT := 0;
BEGIN
    DELETE FROM public.hospital_activity_audit_log
    WHERE created_at < now() - interval '12 months';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function access control
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._doctor_passcode_matches(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._doctor_insert_audit_log(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._doctor_resolve_actor_session(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._doctor_require_actor_session(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._doctor_require_chief_session(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_hospital_activity_audit_logs() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.doctor_actor_login(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_actor_validate(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_actor_logout(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_list_assistants(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_create_assistant(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_update_assistant(UUID, UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_reset_assistant_passcode(UUID, UUID, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_set_assistant_active(UUID, UUID, TEXT, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, TEXT, JSONB, TEXT, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_mark_queue_done(UUID, UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_log_view_event(UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doctor_get_audit_logs(UUID, UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.doctor_actor_login(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_actor_validate(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_actor_logout(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_list_assistants(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_create_assistant(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_update_assistant(UUID, UUID, TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_reset_assistant_passcode(UUID, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_set_assistant_active(UUID, UUID, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, TEXT, JSONB, TEXT, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_mark_queue_done(UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_log_view_event(UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_get_audit_logs(UUID, UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT) TO authenticated;

COMMIT;
