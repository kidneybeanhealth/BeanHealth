-- ============================================================
-- Patient Admission workflow extension for hospital_queues
-- Adds admission tracking columns so a doctor can "Admit" a
-- patient directly from the live queue without issuing a
-- prescription. Admitted patients leave the live queue
-- (status='completed' per existing semantics) and surface
-- in a new "Admitted Patients" view until they are discharged.
--
-- Safe to run multiple times (idempotent).
-- Date: 2026-04-16
-- ============================================================

ALTER TABLE public.hospital_queues
    ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS discharged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admission_status TEXT;

-- Add/replace CHECK constraint for admission_status
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hospital_queues_admission_status_check'
          AND conrelid = 'public.hospital_queues'::regclass
    ) THEN
        ALTER TABLE public.hospital_queues
            DROP CONSTRAINT hospital_queues_admission_status_check;
    END IF;

    ALTER TABLE public.hospital_queues
        ADD CONSTRAINT hospital_queues_admission_status_check
        CHECK (admission_status IS NULL OR admission_status IN ('admitted', 'discharged'));
END$$;

-- Index to speed up Admitted Patients listing per hospital
CREATE INDEX IF NOT EXISTS idx_hospital_queues_admission_status
    ON public.hospital_queues(hospital_id, admission_status)
    WHERE admission_status IS NOT NULL;

-- Partial index for "still admitted" (most common filter)
CREATE INDEX IF NOT EXISTS idx_hospital_queues_currently_admitted
    ON public.hospital_queues(hospital_id, admitted_at)
    WHERE admission_status = 'admitted';
