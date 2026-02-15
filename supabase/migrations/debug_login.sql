-- Diagnostic Script: Pinpoint Login Failure
-- Run this in your Supabase SQL Editor. 
-- Then call the function to see what's really happening.

CREATE OR REPLACE FUNCTION public.debug_doctor_login(
    p_hospital_id UUID,
    p_doctor_id UUID,
    p_passcode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_doctor RECORD;
    v_matches BOOLEAN;
    v_step TEXT := 'start';
    v_pgcrypto_check TEXT;
BEGIN
    -- Step 1: Check pgcrypto functions
    BEGIN
        v_step := 'pgcrypto_check';
        SELECT n.nspname INTO v_pgcrypto_check
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'crypt' LIMIT 1;
        
        IF v_pgcrypto_check IS NULL THEN
            v_pgcrypto_check := 'NOT FOUND';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_pgcrypto_check := 'ERROR: ' || SQLERRM;
    END;

    -- Step 2: Check for doctor record
    v_step := 'fetch_doctor';
    SELECT id, name, access_code, is_active, hospital_id
    INTO v_doctor
    FROM public.hospital_doctors
    WHERE id = p_doctor_id;

    IF v_doctor.id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'fail',
            'step', v_step,
            'error', 'Doctor record not found in hospital_doctors table',
            'p_doctor_id', p_doctor_id,
            'pgcrypto_schema', v_pgcrypto_check
        );
    END IF;

    IF v_doctor.hospital_id != p_hospital_id THEN
        RETURN jsonb_build_object(
            'status', 'fail',
            'step', v_step,
            'error', 'Hospital ID mismatch',
            'db_hospital_id', v_doctor.hospital_id,
            'passed_hospital_id', p_hospital_id
        );
    END IF;

    -- Step 3: Check passcode match logic
    v_step := 'passcode_match_test';
    BEGIN
        v_matches := public._doctor_passcode_matches(v_doctor.access_code, p_passcode);
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'step', v_step,
            'error', SQLERRM,
            'hint', 'Ensure pgcrypto is in extensions and search_path is correct'
        );
    END;

    -- Step 5: Test FULL login flow and capture error
    v_step := 'full_login_test';
    BEGIN
        RETURN (
            SELECT jsonb_build_object(
                'status', 'success',
                'login_result', jsonb_build_object(
                    'session_token', session_token,
                    'actor_display_name', actor_display_name
                ),
                'pgcrypto_schema', v_pgcrypto_check
            )
            FROM public.doctor_actor_login(
                p_hospital_id,
                p_doctor_id,
                'chief',
                NULL,
                p_passcode,
                '{"debug": true}'::jsonb
            )
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'fail',
            'step', v_step,
            'error_code', SQLSTATE,
            'error_message', SQLERRM,
            'hint', 'This is the error blocking your login'
        );
    END;
END;
$$;
