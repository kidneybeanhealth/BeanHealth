-- ============================================================
-- Patient follow-up stop workflow
-- Supports marking patients as transferred out and stopping all
-- upcoming review operations when they move care externally.
--
-- Safe to run multiple times (idempotent).
-- Date: 2026-04-24
-- ============================================================

ALTER TABLE public.hospital_patients
    ADD COLUMN IF NOT EXISTS continuity_status TEXT NOT NULL DEFAULT 'active_followup',
    ADD COLUMN IF NOT EXISTS followup_stopped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS followup_stop_reason TEXT,
    ADD COLUMN IF NOT EXISTS followup_stop_notes TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hospital_patients_continuity_status_check'
          AND conrelid = 'public.hospital_patients'::regclass
    ) THEN
        ALTER TABLE public.hospital_patients
            DROP CONSTRAINT hospital_patients_continuity_status_check;
    END IF;

    ALTER TABLE public.hospital_patients
        ADD CONSTRAINT hospital_patients_continuity_status_check
        CHECK (
            continuity_status IN (
                'active_followup',
                'transferred_out',
                'inactive_lost_followup'
            )
        );
END$$;

CREATE INDEX IF NOT EXISTS idx_hospital_patients_continuity_status
    ON public.hospital_patients(hospital_id, continuity_status, followup_stopped_at DESC);
