-- ============================================
-- SCHEMA UPDATE: Doctor Medications & AI Extraction
-- Run this AFTER the initial schema is set up
-- ============================================

-- Add new columns to patient_medications for tracking source
ALTER TABLE patient_medications 
ADD COLUMN IF NOT EXISTS added_by_doctor_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL;

-- source options: 'manual', 'ai_extracted', 'doctor_prescribed'

-- Create index for source record lookups
CREATE INDEX IF NOT EXISTS idx_patient_medications_source_record 
ON patient_medications(source_record_id);

-- Update RLS policy to allow doctors to add medications for their patients
DROP POLICY IF EXISTS patient_medications_doctor_policy ON patient_medications;

CREATE POLICY patient_medications_doctor_policy ON patient_medications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM patient_doctor_relationships pd
            WHERE pd.patient_id = patient_medications.patient_id
            AND pd.doctor_id = auth.uid()
        )
    );

-- Similarly update adherence policy for doctors to view
DROP POLICY IF EXISTS medication_adherence_doctor_policy ON medication_adherence;

CREATE POLICY medication_adherence_doctor_policy ON medication_adherence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patient_doctor_relationships pd
            WHERE pd.patient_id = medication_adherence.patient_id
            AND pd.doctor_id = auth.uid()
        )
    );

-- Update case details policy for doctors to update (for AI extraction)
DROP POLICY IF EXISTS patient_case_details_doctor_policy ON patient_case_details;

CREATE POLICY patient_case_details_doctor_policy ON patient_case_details
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM patient_doctor_relationships pd
            WHERE pd.patient_id = patient_case_details.patient_id
            AND pd.doctor_id = auth.uid()
        )
    );
