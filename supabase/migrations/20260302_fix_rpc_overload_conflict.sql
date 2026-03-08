-- Migration: Resolve function overload conflict on doctor_save_prescription_and_send
-- Problem: PGRST203 — two overloads exist (p_token_number INTEGER vs TEXT, with/without
--          p_patient_name), PostgREST cannot pick a candidate.
-- Fix: Drop ALL overloads first, then create exactly one canonical version.

-- ============================================================================
-- STEP 1: Drop every overload of doctor_save_prescription_and_send
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
-- STEP 2: Create the single canonical version with patient existence guard
-- ============================================================================
CREATE FUNCTION public.doctor_save_prescription_and_send(
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
    -- Guard: validate patient exists before the FK-constrained insert.
    -- Converts a cryptic 23503 FK violation into a clear, catchable error.
    IF p_patient_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.hospital_patients WHERE id = p_patient_id) THEN
            RAISE EXCEPTION 'patient_not_found: Patient record (id: %) does not exist in hospital_patients. The queue may contain stale data — please refresh.', p_patient_id
                USING ERRCODE = 'P0002';
        END IF;
    END IF;

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

    RETURN QUERY SELECT v_prescription_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, TEXT, JSONB, TEXT, DATE, TEXT, TEXT, JSONB, TEXT) TO authenticated;
