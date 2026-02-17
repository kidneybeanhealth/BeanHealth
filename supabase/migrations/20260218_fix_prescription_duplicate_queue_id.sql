-- Migration: Fix duplicate queue_id constraint violation
-- Issue: Double-clicking "Send to Pharmacy" causes duplicate key errors
-- Solution: Make the RPC function idempotent using UPSERT (ON CONFLICT)

-- ============================================================================
-- STEP 1: Drop ALL existing versions using dynamic SQL
-- ============================================================================
DO $$
DECLARE
    func_signature text;
BEGIN
    -- Find and drop ALL versions of the function
    FOR func_signature IN
        SELECT p.oid::regprocedure::text
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'doctor_save_prescription_and_send'
          AND n.nspname = 'public'
    LOOP
        EXECUTE format('DROP FUNCTION %s', func_signature);
        RAISE NOTICE 'Dropped function: %', func_signature;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Create the new idempotent version using UPSERT
-- ============================================================================
CREATE FUNCTION public.doctor_save_prescription_and_send(
    p_hospital_id UUID,
    p_chief_doctor_id UUID,
    p_session_token TEXT,
    p_patient_id UUID,
    p_queue_id UUID,
    p_token_number INTEGER,
    p_medications JSONB,
    p_notes TEXT,
    p_next_review_date DATE,
    p_tests_to_review TEXT,
    p_specialists_to_review TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(saved_prescription_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prescription_id UUID;
BEGIN
    -- UPSERT: Insert new prescription or update existing one for the same queue_id
    -- This prevents duplicate key violations when the function is called multiple times
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
    -- Handle conflict on the unique constraint (queue_id)
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

    -- Update the queue status to 'completed'
    -- Use UPDATE with WHERE to make it idempotent (won't fail if already updated)
    UPDATE public.hospital_queues
    SET 
        status = 'completed',
        updated_at = now()
    WHERE id = p_queue_id
      AND status != 'completed';

    -- Return the prescription ID
    RETURN QUERY SELECT v_prescription_id;
END;
$$;

-- ============================================================================
-- STEP 3: Set permissions
-- ============================================================================
REVOKE ALL ON FUNCTION public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, INTEGER, JSONB, TEXT, DATE, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, INTEGER, JSONB, TEXT, DATE, TEXT, TEXT, JSONB) TO authenticated;
