-- FINAL CLEANUP: Re-link test data to restored doctor
-- 
-- 1. Identify the NEW doctor ID for Prabhakar in the Test Account
-- 2. Update prescriptions and queues to point to it
-- 3. Cleanup any stray session/audit links

BEGIN;

-- Find the ID of the doctor we just restored to the test account
DO $$
DECLARE
    v_test_hospital_id UUID := '50ae939b-8a54-47a4-99bc-88ccb24ef459';
    v_real_hospital_id UUID := '1fd98796-61ac-4fdb-bd4e-607b7e35e9b1';
    v_new_doctor_id UUID;
    v_wrong_doctor_id UUID := '15bfa890-0377-48fa-b736-e04c4c4097b9';
BEGIN
    SELECT id INTO v_new_doctor_id 
    FROM public.hospital_doctors 
    WHERE hospital_id = v_test_hospital_id AND name ILIKE '%Prabhakar%'
    LIMIT 1;

    IF v_new_doctor_id IS NOT NULL THEN
        -- Fix prescriptions in test account that point to the wrong hospital's doctor
        UPDATE public.hospital_prescriptions
        SET doctor_id = v_new_doctor_id
        WHERE hospital_id = v_test_hospital_id
          AND doctor_id = v_wrong_doctor_id;

        -- Fix queues in test account
        UPDATE public.hospital_queues
        SET doctor_id = v_new_doctor_id
        WHERE hospital_id = v_test_hospital_id
          AND doctor_id = v_wrong_doctor_id;
          
        -- Fix reviews in test account
        UPDATE public.hospital_patient_reviews
        SET doctor_id = v_new_doctor_id
        WHERE hospital_id = v_test_hospital_id
          AND doctor_id = v_wrong_doctor_id;
          
        -- Fix audit logs in test account
        UPDATE public.hospital_activity_audit_log
        SET chief_doctor_id = v_new_doctor_id
        WHERE hospital_id = v_test_hospital_id
          AND chief_doctor_id = v_wrong_doctor_id;
    END IF;
END $$;

COMMIT;
