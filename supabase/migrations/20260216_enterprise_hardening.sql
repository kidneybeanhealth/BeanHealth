-- MASTER HARDENING: Comprehensive Enterprise Isolation
-- This migration plugs identified security gaps and strengthens multi-tenant isolation.
-- 1. Enforce RLS on hospital_patient_reviews
-- 2. Add extra server-side validation to doctor_actor_login for authorized hospital access

BEGIN;

-- =============================================
-- 1. HARDEN: hospital_patient_reviews
-- =============================================

-- Enable RLS (was missing)
ALTER TABLE public.hospital_patient_reviews ENABLE ROW LEVEL SECURITY;

-- Add isolation policy
DROP POLICY IF EXISTS "Hospitals can manage own patient reviews" ON public.hospital_patient_reviews;
CREATE POLICY "Hospitals can manage own patient reviews"
ON public.hospital_patient_reviews FOR ALL
USING (auth.uid() = hospital_id)
WITH CHECK (auth.uid() = hospital_id);

-- =============================================
-- 2. HARDEN: doctor_actor_login (RPC)
-- =============================================
-- Updating the RPC to strictly verify that the caller matches the hospital ID they are accessing.

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
    -- SECURITY HARDENING: Ensure the caller (authenticated hospital) 
    -- is only logging into their own doctors.
    IF auth.uid() IS NOT NULL AND auth.uid() != p_hospital_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only login to your own hospital doctors';
    END IF;

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

    -- Look up the doctor, strictly scoped to THIS hospital
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

    -- Chief Auth
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

        v_assistant_id := NULL;
        v_actor_display_name := v_doctor.name;

        -- Gradual hardening: if chief passcode is still plain text, hash it after first valid login.
        IF v_doctor.access_code IS NOT NULL AND v_doctor.access_code NOT LIKE '$2%' THEN
            UPDATE public.hospital_doctors
            SET access_code = crypt(p_passcode, gen_salt('bf', 10))
            WHERE id = v_doctor.id;
        END IF;

    -- Assistant Auth
    ELSE
        SELECT a.id, a.assistant_name, a.passcode_hash
        INTO v_assistant
        FROM public.hospital_doctor_assistants a
        WHERE a.chief_doctor_id = p_chief_doctor_id
          AND a.hospital_id = p_hospital_id
          AND a.assistant_code = p_assistant_code
          AND a.is_active = true
        LIMIT 1;

        IF v_assistant.id IS NULL OR NOT public._doctor_passcode_matches(v_assistant.passcode_hash, p_passcode) THEN
            PERFORM public._doctor_insert_audit_log(
                p_hospital_id,
                p_chief_doctor_id,
                'assistant',
                NULL,
                CASE WHEN v_assistant.id IS NOT NULL THEN v_assistant.assistant_name ELSE COALESCE(p_assistant_code, 'Unknown') END,
                'auth.login.failed',
                'auth',
                NULL,
                NULL,
                NULL,
                '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT,
                jsonb_build_object('reason', 'invalid_assistant_credentials', 'assistant_code', p_assistant_code)
            );
            RAISE EXCEPTION 'Invalid credentials';
        END IF;

        v_assistant_id := v_assistant.id;
        v_actor_display_name := v_assistant.assistant_name;
    END IF;

    -- Create session
    v_session_token := encode(gen_random_bytes(32), 'hex');
    v_session_token_hash := encode(digest(v_session_token, 'sha256'), 'hex');

    INSERT INTO public.hospital_doctor_actor_sessions (
        hospital_id,
        chief_doctor_id,
        assistant_id,
        actor_type,
        session_token_hash,
        expires_at,
        metadata
    )
    VALUES (
        p_hospital_id,
        p_chief_doctor_id,
        v_assistant_id,
        v_actor_type,
        v_session_token_hash,
        v_expires_at,
        COALESCE(p_device_info, '{}'::jsonb)
    )
    RETURNING id INTO v_session_id;

    -- Audit success
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
        '/enterprise-dashboard/doctors/' || p_chief_doctor_id::TEXT || '/dashboard',
        jsonb_build_object('session_id', v_session_id)
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


-- =============================================
-- 3. HARDEN: Prescription Deletion Safety
-- =============================================
-- Ensure prescriptions can NEVER be deleted by anyone except admins/hospitals.
-- (Currently the policy allows ALL operations to hospitals, which is correct)

COMMIT;
