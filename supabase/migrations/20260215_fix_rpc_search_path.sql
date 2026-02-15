-- Master Fix: RPC Search Path for Extension Accessibility (Universal Version)
-- This script updates the search_path for all SECURITY DEFINER functions 
-- to ensure they can access extensions (like pgcrypto) installed in the 'extensions' schema.
-- This uses a DO block to safely apply the fix only where the function exists.

DO $$
DECLARE
    f_sig TEXT;
    f_sigs TEXT[] := ARRAY[
        -- PA Login & Actor functions
        '_doctor_passcode_matches(text, text)',
        '_doctor_insert_audit_log(uuid, uuid, text, uuid, text, text, text, uuid, uuid, uuid, text, jsonb)',
        '_doctor_resolve_actor_session(uuid, uuid, text)',
        '_doctor_require_actor_session(uuid, uuid, text)',
        '_doctor_require_chief_session(uuid, uuid, text)',
        'doctor_actor_login(uuid, uuid, text, text, text, jsonb)',
        'doctor_actor_validate(uuid, uuid, text)',
        'doctor_actor_logout(uuid, uuid, text)',
        'doctor_list_assistants(uuid, uuid, text)',
        'doctor_create_assistant(uuid, uuid, text, text, text, text)',
        'doctor_update_assistant(uuid, uuid, text, uuid, text, text)',

        -- Notification & Review functions
        'queue_manual_review_reminder(uuid)',
        'claim_review_notification_jobs(integer)',

        -- Referral & Registration functions
        'generate_patient_uid()',
        'generate_doctor_referral_code()',
        'generate_doctor_referral_code(text)',
        'validate_referral_code(text)',
        'register_patient_with_referral(uuid, text, text, integer, text, text, text, boolean, integer, text, jsonb)',

        -- BeanHealth ID & Onboarding functions
        'generate_beanhealth_id()',
        'find_patient_by_phone(text)',
        'generate_patient_id()',
        'get_doctor_by_referral_code(text)',
        'accept_terms(uuid, text)',

        -- Hospital Patient Auth functions
        'verify_hospital_patient(text, text)',
        'find_patients_by_phone(text)'
    ];
BEGIN
    FOREACH f_sig IN ARRAY f_sigs
    LOOP
        BEGIN
            EXECUTE 'ALTER FUNCTION public.' || f_sig || ' SET search_path = public, extensions';
            RAISE NOTICE 'Updated search_path for %', f_sig;
        EXCEPTION WHEN undefined_function THEN
            RAISE NOTICE 'Function % not found, skipping.', f_sig;
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not update %: %', f_sig, SQLERRM;
        END;
    END LOOP;
END $$;
