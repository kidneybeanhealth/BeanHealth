-- Migration: Sync hospital_pharmacy_queue in doctor_save_prescription_and_send RPC
-- Issue: When using PA actor auth, prescriptions were not appearing in the pharmacy queue display
-- Solution: Add insertion into hospital_pharmacy_queue inside the RPC function

-- ============================================================================
-- STEP 1: Drop the old function signature to avoid overloading issues
-- ============================================================================
DO $$
DECLARE
    func_signature text;
BEGIN
    FOR func_signature IN
        SELECT p.oid::regprocedure::text
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'doctor_save_prescription_and_send'
          AND n.nspname = 'public'
    LOOP
        EXECUTE format('DROP FUNCTION %s', func_signature);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Create the updated version with pharmacy queue sync
-- ============================================================================
CREATE OR REPLACE FUNCTION public.doctor_save_prescription_and_send(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_patient_id UUID,
    p_queue_id UUID,
    p_token_number TEXT,
    p_medications JSONB,
    p_notes TEXT,
    p_next_review_date DATE,
    p_tests_to_review TEXT,
    p_specialists_to_review TEXT,
    p_metadata JSONB DEFAULT '{}',
    p_patient_name TEXT DEFAULT NULL
)
RETURNS TABLE(saved_prescription_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prescription_id UUID;
    v_patient_name TEXT;
BEGIN
    -- 1. UPSERT into hospital_prescriptions
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
        status,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        p_hospital_id,
        p_chief_doctor_id,
        p_patient_id,
        p_queue_id,
        p_token_number,
        p_medications,
        p_notes,
        p_next_review_date,
        p_tests_to_review,
        p_specialists_to_review,
        'pending',
        p_metadata,
        now(),
        now()
    )
    ON CONFLICT (queue_id) 
    WHERE queue_id IS NOT NULL
    DO UPDATE SET
        medications = EXCLUDED.medications,
        notes = EXCLUDED.notes,
        next_review_date = EXCLUDED.next_review_date,
        tests_to_review = EXCLUDED.tests_to_review,
        specialists_to_review = EXCLUDED.specialists_to_review,
        metadata = EXCLUDED.metadata,
        status = 'pending',
        updated_at = now()
    RETURNING id INTO v_prescription_id;

    -- 2. Update the doctor's queue status to 'completed'
    UPDATE public.hospital_queues
    SET 
        status = 'completed',
        updated_at = now()
    WHERE id = p_queue_id
      AND status != 'completed';

    -- 3. Get patient name if not provided
    IF p_patient_name IS NULL OR p_patient_name = '' THEN
        SELECT name INTO v_patient_name FROM public.hospital_patients WHERE id = p_patient_id LIMIT 1;
    ELSE
        v_patient_name := p_patient_name;
    END IF;

    -- 4. Sync with hospital_pharmacy_queue
    INSERT INTO public.hospital_pharmacy_queue (
        hospital_id,
        prescription_id,
        patient_name,
        token_number,
        status,
        created_at
    ) VALUES (
        p_hospital_id,
        v_prescription_id,
        COALESCE(v_patient_name, 'Unknown'),
        p_token_number,
        'waiting',
        now()
    )
    ON CONFLICT (prescription_id)
    WHERE prescription_id IS NOT NULL
    DO UPDATE SET
        patient_name = EXCLUDED.patient_name,
        token_number = EXCLUDED.token_number,
        status = 'waiting';

    -- Return the prescription ID
    RETURN QUERY SELECT v_prescription_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, TEXT, JSONB, TEXT, DATE, TEXT, TEXT, JSONB, TEXT) TO authenticated;
