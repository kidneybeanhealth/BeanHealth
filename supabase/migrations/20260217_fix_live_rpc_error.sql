-- Migration: Fix RPC parameter mismatch and update logic
-- This replaces the existing doctor_save_prescription_and_send with a version that accepts p_metadata (12 parameters)

-- First, ensure the metadata column exists (idempotent)
ALTER TABLE public.hospital_prescriptions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Postgres requires dropping the function if the return type changes (JSONB -> TABLE)
DROP FUNCTION IF EXISTS public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, INTEGER, JSONB, TEXT, DATE, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.doctor_save_prescription_and_send(
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
    -- 1. Insert the prescription
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
        metadata
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
        p_metadata
    )
    RETURNING id INTO v_prescription_id;

    -- 2. Update the queue status to 'completed'
    UPDATE public.hospital_queues
    SET status = 'completed'
    WHERE id = p_queue_id;

    -- 3. Return the ID in a table format (Supabase returns this as an array of objects)
    RETURN QUERY SELECT v_prescription_id;
END;
$$;

-- Re-grant permissions
REVOKE ALL ON FUNCTION public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, INTEGER, JSONB, TEXT, DATE, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.doctor_save_prescription_and_send(UUID, UUID, TEXT, UUID, UUID, INTEGER, JSONB, TEXT, DATE, TEXT, TEXT, JSONB) TO authenticated;
