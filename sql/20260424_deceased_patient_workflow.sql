-- ============================================================
-- Deceased patient workflow extension
-- Adds patient-level deceased flags and allows queue admission
-- status to represent deceased outcomes.
--
-- Safe to run multiple times (idempotent).
-- Date: 2026-04-24
-- ============================================================

ALTER TABLE public.hospital_patients
    ADD COLUMN IF NOT EXISTS is_deceased BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deceased_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deceased_note TEXT;

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
        CHECK (admission_status IS NULL OR admission_status IN ('admitted', 'discharged', 'deceased'));
END$$;

CREATE INDEX IF NOT EXISTS idx_hospital_patients_deceased
    ON public.hospital_patients(hospital_id, is_deceased, deceased_at DESC)
    WHERE is_deceased = TRUE;
