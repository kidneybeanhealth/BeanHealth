-- Add follow-up notes column to hospital_patient_reviews
-- Run this in Supabase SQL Editor

ALTER TABLE hospital_patient_reviews
ADD COLUMN IF NOT EXISTS followup_notes TEXT DEFAULT NULL;

COMMENT ON COLUMN hospital_patient_reviews.followup_notes
IS 'Persistent notes written by reception staff about follow-up status, visible to doctors';
