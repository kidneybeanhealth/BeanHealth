-- Enterprise queue integrity hardening:
-- 1) Link prescriptions to exact queue visit via queue_id
-- 2) Deduplicate pharmacy queue rows and enforce one row per prescription
-- 3) Add atomic queue-entry creator RPC for reception

BEGIN;

-- 1) queue_id linkage on prescriptions
ALTER TABLE public.hospital_prescriptions
ADD COLUMN IF NOT EXISTS queue_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hospital_prescriptions_queue_id_fkey'
    ) THEN
        ALTER TABLE public.hospital_prescriptions
        ADD CONSTRAINT hospital_prescriptions_queue_id_fkey
        FOREIGN KEY (queue_id) REFERENCES public.hospital_queues(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prescriptions_queue_id
ON public.hospital_prescriptions(queue_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prescriptions_queue_id_nonnull
ON public.hospital_prescriptions(queue_id)
WHERE queue_id IS NOT NULL;

-- 2) pharmacy queue dedupe + uniqueness
WITH ranked_duplicates AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY prescription_id
            ORDER BY created_at DESC, id DESC
        ) AS row_rank
    FROM public.hospital_pharmacy_queue
    WHERE prescription_id IS NOT NULL
)
DELETE FROM public.hospital_pharmacy_queue q
USING ranked_duplicates r
WHERE q.id = r.id
  AND r.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacy_queue_prescription_id
ON public.hospital_pharmacy_queue(prescription_id)
WHERE prescription_id IS NOT NULL;

-- 3) atomic queue row creation RPC
CREATE OR REPLACE FUNCTION public.create_hospital_queue_entry(
    p_hospital_id UUID,
    p_patient_id UUID,
    p_doctor_id UUID
)
RETURNS TABLE(queue_id UUID, queue_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next_queue_number INTEGER;
    v_inserted_queue_id UUID;
    v_lock_key BIGINT;
BEGIN
    -- Lock per (doctor, date) to make queue_number allocation atomic.
    v_lock_key := ('x' || substr(md5(p_doctor_id::text || ':' || CURRENT_DATE::text), 1, 16))::bit(64)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT COALESCE(MAX(hq.queue_number), 0) + 1
    INTO v_next_queue_number
    FROM public.hospital_queues hq
    WHERE hq.hospital_id = p_hospital_id
      AND hq.doctor_id = p_doctor_id
      AND hq.created_at::date = CURRENT_DATE;

    INSERT INTO public.hospital_queues (
        hospital_id,
        patient_id,
        doctor_id,
        queue_number,
        status
    ) VALUES (
        p_hospital_id,
        p_patient_id,
        p_doctor_id,
        v_next_queue_number,
        'pending'
    )
    RETURNING id INTO v_inserted_queue_id;

    RETURN QUERY SELECT v_inserted_queue_id, v_next_queue_number;
END;
$$;

REVOKE ALL ON FUNCTION public.create_hospital_queue_entry(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_hospital_queue_entry(UUID, UUID, UUID) TO authenticated;

COMMIT;
