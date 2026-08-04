-- ============================================================================
-- Add heart rate, SpO2 and temperature to patient vitals
-- ============================================================================
-- The vitals table was built for the nephrology profile (BP, glucose, weight),
-- so standard OPD observations had nowhere to live. These are recorded by the
-- doctor/assistant in the live queue before prescribing.
--
-- Temperature is stored as a raw number plus the unit it was measured in, so a
-- clinic can work in either °F or °C without lossy conversion on write. Reads
-- convert for display when needed.
--
-- Non-breaking: existing rows get NULL, and the patient app never writes these.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE public.hospital_patient_vitals
    ADD COLUMN IF NOT EXISTS heart_rate integer,
    ADD COLUMN IF NOT EXISTS spo2 integer,
    ADD COLUMN IF NOT EXISTS temperature numeric,
    ADD COLUMN IF NOT EXISTS temperature_unit text;

-- Guarded so re-running doesn't error
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospital_patient_vitals_temp_unit_check') THEN
        ALTER TABLE public.hospital_patient_vitals
            ADD CONSTRAINT hospital_patient_vitals_temp_unit_check
            CHECK (temperature_unit IS NULL OR temperature_unit IN ('F', 'C'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospital_patient_vitals_spo2_check') THEN
        ALTER TABLE public.hospital_patient_vitals
            ADD CONSTRAINT hospital_patient_vitals_spo2_check
            CHECK (spo2 IS NULL OR (spo2 > 0 AND spo2 <= 100));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospital_patient_vitals_hr_check') THEN
        ALTER TABLE public.hospital_patient_vitals
            ADD CONSTRAINT hospital_patient_vitals_hr_check
            CHECK (heart_rate IS NULL OR (heart_rate > 0 AND heart_rate < 400));
    END IF;
END $$;
