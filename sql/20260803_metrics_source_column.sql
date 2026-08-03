-- ============================================================================
-- Distinguish OPD-recorded metrics from patient-app submissions
-- ============================================================================
-- Problem
-- -------
-- Clinician-entered (OPD) metrics and patient-app submissions write to the same
-- three tables with identical columns and no origin marker, so the doctor's
-- queue panel cannot separate "what we measured here" from "what the patient
-- logged at home".
--
-- Fix
-- ---
-- Add a `source` column defaulting to 'patient_app'. Existing rows keep their
-- meaning (they were all patient-app submissions), the patient app needs no
-- code change, and OPD entries stamp 'opd' explicitly.
--
-- Non-breaking and safe to re-run.
-- ============================================================================

ALTER TABLE public.hospital_patient_vitals
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'patient_app';

ALTER TABLE public.hospital_patient_intakes
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'patient_app';

ALTER TABLE public.hospital_patient_urine_outputs
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'patient_app';

-- Constrain to known values (guarded so re-running doesn't error)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospital_patient_vitals_source_check') THEN
        ALTER TABLE public.hospital_patient_vitals
            ADD CONSTRAINT hospital_patient_vitals_source_check
            CHECK (source IN ('patient_app', 'opd'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospital_patient_intakes_source_check') THEN
        ALTER TABLE public.hospital_patient_intakes
            ADD CONSTRAINT hospital_patient_intakes_source_check
            CHECK (source IN ('patient_app', 'opd'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospital_patient_urine_outputs_source_check') THEN
        ALTER TABLE public.hospital_patient_urine_outputs
            ADD CONSTRAINT hospital_patient_urine_outputs_source_check
            CHECK (source IN ('patient_app', 'opd'));
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- CRITICAL: widen the daily-uniqueness rule to include source.
--
-- The old UNIQUE (patient_id, recorded_date) means an OPD entry upserted for a
-- day the patient already logged at home would OVERWRITE the patient's reading
-- and flip its source to 'opd' — destroying data and defeating the separation.
-- Both sources must be able to hold one row per patient per day.
--
-- Widening is safe: every existing row is 'patient_app', so no duplicates can
-- arise from the looser key.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hospital_patient_vitals
    DROP CONSTRAINT IF EXISTS hospital_patient_vitals_unique_daily;
ALTER TABLE public.hospital_patient_vitals
    ADD CONSTRAINT hospital_patient_vitals_unique_daily_source
    UNIQUE (patient_id, recorded_date, source);

ALTER TABLE public.hospital_patient_intakes
    DROP CONSTRAINT IF EXISTS hospital_patient_intakes_unique_daily;
ALTER TABLE public.hospital_patient_intakes
    ADD CONSTRAINT hospital_patient_intakes_unique_daily_source
    UNIQUE (patient_id, recorded_date, source);

-- Filtering by source is the common read pattern in the doctor's queue panel
CREATE INDEX IF NOT EXISTS idx_hp_vitals_patient_source
    ON public.hospital_patient_vitals(patient_id, source, recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_hp_intakes_patient_source
    ON public.hospital_patient_intakes(patient_id, source, recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_hp_urine_patient_source
    ON public.hospital_patient_urine_outputs(patient_id, source, recorded_at DESC);
