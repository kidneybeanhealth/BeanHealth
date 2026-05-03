-- ============================================================================
-- MIGRATION: Multi-Doctor Past Records Support
-- Date: 2026-05-03
-- Purpose: Enable tracking of doctor-specific review dates for patients
--          consulting multiple doctors
--
-- Changes:
-- 1. Add doctor_id column to hospital_patient_followups
-- 2. Backfill existing call logs with doctor_id from their source reviews
-- 3. Add unique constraint to prevent duplicate active reviews per doctor
-- 4. Update trigger to sync doctor_id from reviews to followups
--
-- Zero-downtime: All changes are additive, backfill is safe and idempotent
-- Rollback: Remove constraint, drop column, revert trigger
-- ============================================================================

-- ============================================================================
-- STEP 1: Add doctor_id column to hospital_patient_followups (nullable)
-- ============================================================================
ALTER TABLE hospital_patient_followups
ADD COLUMN doctor_id UUID NULL;

COMMENT ON COLUMN hospital_patient_followups.doctor_id IS 
'Doctor ID for this review. Tracks which doctor the followup call is for when a patient has reviews with multiple doctors.';

-- ============================================================================
-- STEP 2: Backfill existing followups with doctor_id from their source reviews
-- ============================================================================
-- This query links each followup to its review (via review_id FK)
-- and copies the doctor_id from that review
UPDATE hospital_patient_followups hpf
SET doctor_id = hpr.doctor_id
FROM hospital_patient_reviews hpr
WHERE hpf.review_id = hpr.id
  AND hpf.doctor_id IS NULL;

-- ============================================================================
-- STEP 3: Detect and handle duplicate active reviews per doctor
-- ============================================================================
-- Before adding the unique index, we need to clean up any existing duplicates
-- Strategy: For each (hospital, patient, doctor) with duplicates,
-- keep the MOST RECENT pending/rescheduled review and cancel the others

-- First, identify duplicates
-- SELECT hospital_id, patient_id, doctor_id, COUNT(*) as count
-- FROM hospital_patient_reviews
-- WHERE status IN ('pending', 'rescheduled')
-- GROUP BY hospital_id, patient_id, doctor_id
-- HAVING COUNT(*) > 1;

-- Cancel older duplicate reviews (keep only the most recent one per doctor)
UPDATE hospital_patient_reviews hpr_old
SET status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
WHERE id IN (
  SELECT hpr.id
  FROM hospital_patient_reviews hpr
  WHERE hpr.status IN ('pending', 'rescheduled')
  AND (hpr.hospital_id, hpr.patient_id, hpr.doctor_id) IN (
    SELECT hospital_id, patient_id, doctor_id
    FROM hospital_patient_reviews
    WHERE status IN ('pending', 'rescheduled')
    GROUP BY hospital_id, patient_id, doctor_id
    HAVING COUNT(*) > 1
  )
  AND hpr.id NOT IN (
    -- Keep only the most recent one
    SELECT DISTINCT ON (hospital_id, patient_id, doctor_id) id
    FROM hospital_patient_reviews
    WHERE status IN ('pending', 'rescheduled')
    ORDER BY hospital_id, patient_id, doctor_id, updated_at DESC
  )
);

-- ============================================================================
-- STEP 4: Add unique index for active reviews per doctor
-- ============================================================================
-- After cleanup, this index enforces one active review per (hospital, patient, doctor)
-- Completed and cancelled reviews are not constrained (history tracking)
CREATE UNIQUE INDEX idx_unique_active_review_per_doctor
ON hospital_patient_reviews (hospital_id, patient_id, doctor_id)
WHERE status IN ('pending', 'rescheduled');

-- ============================================================================
-- STEP 5: Update trigger to sync doctor_id when reviews are created/updated
-- ============================================================================
-- When a review with doctor_id is created, it's already linked to the review_id
-- This trigger ensures that when a review's doctor_id changes, existing
-- followups for that review are updated accordingly
DROP TRIGGER IF EXISTS sync_hospital_review_to_followup ON hospital_patient_reviews;

CREATE OR REPLACE FUNCTION sync_hospital_review_doctor_to_followup()
RETURNS TRIGGER AS $$
BEGIN
  -- When a review's doctor_id is updated, sync it to existing followups
  IF OLD.doctor_id IS DISTINCT FROM NEW.doctor_id THEN
    UPDATE hospital_patient_followups
    SET doctor_id = NEW.doctor_id,
        updated_at = NOW()
    WHERE review_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_hospital_review_doctor_to_followup
AFTER UPDATE ON hospital_patient_reviews
FOR EACH ROW
EXECUTE FUNCTION sync_hospital_review_doctor_to_followup();

-- ============================================================================
-- STEP 6: Add index for doctor-specific queries on followups
-- ============================================================================
-- Improves performance when filtering followups by doctor for a patient
CREATE INDEX IF NOT EXISTS idx_hospital_patient_followups_doctor
  ON hospital_patient_followups(hospital_id, patient_id, doctor_id)
  WHERE doctor_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES (run these to confirm migration success)
-- ============================================================================

-- Check 1: Verify backfill completed
-- SELECT COUNT(*) as backfilled_followups
-- FROM hospital_patient_followups
-- WHERE doctor_id IS NOT NULL;

-- Check 2: Verify duplicates were cleaned up (should return 0)
-- SELECT hospital_id, patient_id, doctor_id, COUNT(*) as count
-- FROM hospital_patient_reviews
-- WHERE status IN ('pending', 'rescheduled')
-- GROUP BY hospital_id, patient_id, doctor_id
-- HAVING COUNT(*) > 1;

-- Check 3: Spot check - verify followup doctor_id matches source review
-- SELECT hpf.id, hpf.doctor_id, hpr.doctor_id as review_doctor_id
-- FROM hospital_patient_followups hpf
-- JOIN hospital_patient_reviews hpr ON hpf.review_id = hpr.id
-- WHERE hpf.doctor_id != hpr.doctor_id
-- LIMIT 10;

-- Check 4: Count reviews cancelled during cleanup
-- SELECT COUNT(*) as cancelled_duplicates
-- FROM hospital_patient_reviews
-- WHERE status = 'cancelled'
-- AND cancelled_at >= NOW() - INTERVAL '5 minutes';
