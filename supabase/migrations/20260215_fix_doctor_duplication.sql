-- Migration: Resolve doctor duplication and add unique constraint
-- Created: 2026-02-15
-- Version: 1.3 (Idempotent constraint handling + Aggressive Name Normalization)
-- Objectives: 
-- 1. Merge duplicate doctor records (aggressive normalization: ignore Dr., spaces, dots, case)
-- 2. Update dependent tables to point to the "winning" record
-- 3. Resolve conflicts in tables with unique constraints (drugs, assistants)
-- 4. Add a UNIQUE constraint with DROP CONSTRAINT IF EXISTS to ensure it completes

BEGIN;

-- -----------------------------------------------------------------------------
-- Pre-cleanup: Identification
-- -----------------------------------------------------------------------------

-- Helper to find duplicates based on aggressive normalization
-- Normalization: remove "Dr. ", remove all spaces, remove all dots, lowercase
CREATE TEMP TABLE doctor_cleanup_temp AS
WITH normalized_doctors AS (
    SELECT 
        id,
        hospital_id,
        name,
        created_at,
        lower(regexp_replace(regexp_replace(regexp_replace(name, '^(dr\.?\s*)', '', 'i'), '\s+', '', 'g'), '\.', '', 'g')) as norm_name
    FROM public.hospital_doctors
),
ranked_doctors AS (
    SELECT 
        id,
        hospital_id,
        name,
        norm_name,
        ROW_NUMBER() OVER(PARTITION BY hospital_id, norm_name ORDER BY created_at ASC, id ASC) as rank,
        FIRST_VALUE(id) OVER(PARTITION BY hospital_id, norm_name ORDER BY created_at ASC, id ASC) as winning_id
    FROM normalized_doctors
)
SELECT id, winning_id, rank
FROM ranked_doctors;

-- Map "losing" IDs to their corresponding "winning" ID
CREATE TEMP TABLE doctor_id_mapping AS
SELECT id as losing_id, winning_id
FROM doctor_cleanup_temp
WHERE rank > 1;

-- -----------------------------------------------------------------------------
-- Handle child tables with UNIQUE constraints
-- -----------------------------------------------------------------------------

-- 1. Resolve conflicts in hospital_doctor_drugs (Unique on doctor_id, name)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_doctor_drugs') THEN
        -- Delete drugs from "losing" doctor if the "winning" doctor already has the same drug
        DELETE FROM public.hospital_doctor_drugs d
        USING doctor_id_mapping m, public.hospital_doctor_drugs w
        WHERE d.doctor_id = m.losing_id
          AND w.doctor_id = m.winning_id
          AND lower(trim(d.name)) = lower(trim(w.name));
          
        -- Update the remaining unique drugs
        UPDATE public.hospital_doctor_drugs d
        SET doctor_id = m.winning_id
        FROM doctor_id_mapping m
        WHERE d.doctor_id = m.losing_id;
    END IF;
END $$;

-- 2. Resolve conflicts in hospital_doctor_assistants (Unique on chief_doctor_id, assistant_code)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_doctor_assistants') THEN
        -- Delete assistants from "losing" doctor if the "winning" doctor already has an assistant with the same code
        DELETE FROM public.hospital_doctor_assistants a
        USING doctor_id_mapping m, public.hospital_doctor_assistants w
        WHERE a.chief_doctor_id = m.losing_id
          AND w.chief_doctor_id = m.winning_id
          AND a.assistant_code = w.assistant_code;
          
        -- Update the remaining unique assistants
        UPDATE public.hospital_doctor_assistants a
        SET chief_doctor_id = m.winning_id
        FROM doctor_id_mapping m
        WHERE a.chief_doctor_id = m.losing_id;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Update references in tables WITHOUT unique constraints
-- -----------------------------------------------------------------------------

-- 3. hospital_queues
UPDATE public.hospital_queues q
SET doctor_id = m.winning_id
FROM doctor_id_mapping m
WHERE q.doctor_id = m.losing_id;

-- 4. hospital_prescriptions
UPDATE public.hospital_prescriptions p
SET doctor_id = m.winning_id
FROM doctor_id_mapping m
WHERE p.doctor_id = m.losing_id;

-- 5. hospital_patient_reviews
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_patient_reviews') THEN
        UPDATE public.hospital_patient_reviews r
        SET doctor_id = m.winning_id
        FROM doctor_id_mapping m
        WHERE r.doctor_id = m.losing_id;
    END IF;
END $$;

-- 6. hospital_doctor_actor_sessions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_doctor_actor_sessions') THEN
        UPDATE public.hospital_doctor_actor_sessions s
        SET chief_doctor_id = m.winning_id
        FROM doctor_id_mapping m
        WHERE s.chief_doctor_id = m.losing_id;
    END IF;
END $$;

-- 7. hospital_activity_audit_log
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_activity_audit_log') THEN
        UPDATE public.hospital_activity_audit_log l
        SET chief_doctor_id = m.winning_id
        FROM doctor_id_mapping m
        WHERE l.chief_doctor_id = m.losing_id;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Finalize: Delete duplicates and add constraint
-- -----------------------------------------------------------------------------

-- Delete the duplicate doctor records
DELETE FROM public.hospital_doctors
WHERE id IN (SELECT losing_id FROM doctor_id_mapping);

-- Drop the constraint if it exists (handles partial re-runs)
ALTER TABLE public.hospital_doctors
DROP CONSTRAINT IF EXISTS hospital_doctors_hospital_id_name_key;

-- Add the UNIQUE constraint on (hospital_id, name)
ALTER TABLE public.hospital_doctors
ADD CONSTRAINT hospital_doctors_hospital_id_name_key UNIQUE (hospital_id, name);

COMMIT;
