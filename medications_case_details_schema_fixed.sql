-- ============================================
-- MEDICATIONS & CASE DETAILS SCHEMA
-- Clean version - handles missing tables gracefully
-- Run this in your Supabase SQL editor
-- ============================================

-- Step 1: Drop tables (CASCADE will drop policies automatically)
DROP TABLE IF EXISTS medication_adherence CASCADE;
DROP TABLE IF EXISTS patient_medications CASCADE;
DROP TABLE IF EXISTS patient_case_details CASCADE;

-- Step 2: Create Enhanced Medications Table
CREATE TABLE patient_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    dosage_unit VARCHAR(20) NOT NULL DEFAULT 'mg',
    frequency VARCHAR(50) NOT NULL DEFAULT 'once_daily',
    scheduled_times TEXT[] DEFAULT ARRAY['08:00'],
    instructions TEXT,
    category VARCHAR(100),
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    is_custom BOOLEAN DEFAULT false,
    reminder_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create Medication Adherence Log
CREATE TABLE medication_adherence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id UUID NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    taken BOOLEAN DEFAULT false,
    taken_at TIMESTAMPTZ,
    skipped BOOLEAN DEFAULT false,
    skip_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(medication_id, scheduled_date, scheduled_time)
);

-- Step 4: Create Case Details Table
CREATE TABLE patient_case_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    primary_condition TEXT,
    latest_complaint TEXT,
    complaint_date DATE,
    medical_history TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create Indexes
CREATE INDEX idx_patient_medications_patient_id ON patient_medications(patient_id);
CREATE INDEX idx_patient_medications_active ON patient_medications(patient_id, is_active);
CREATE INDEX idx_medication_adherence_patient ON medication_adherence(patient_id);
CREATE INDEX idx_medication_adherence_date ON medication_adherence(patient_id, scheduled_date);
CREATE INDEX idx_medication_adherence_medication ON medication_adherence(medication_id);
CREATE INDEX idx_patient_case_details_patient ON patient_case_details(patient_id);

-- Step 6: Enable Row Level Security
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_adherence ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_case_details ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS Policies

-- Patients can manage their own medications
CREATE POLICY patient_medications_patient_policy ON patient_medications
    FOR ALL USING (auth.uid() = patient_id);

-- Doctors can view their patients' medications
CREATE POLICY patient_medications_doctor_policy ON patient_medications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patient_doctor_relationships pd
            WHERE pd.patient_id = patient_medications.patient_id
            AND pd.doctor_id = auth.uid()
        )
    );

-- Patients can manage their own adherence logs
CREATE POLICY medication_adherence_patient_policy ON medication_adherence
    FOR ALL USING (auth.uid() = patient_id);

-- Doctors can view their patients' adherence
CREATE POLICY medication_adherence_doctor_policy ON medication_adherence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patient_doctor_relationships pd
            WHERE pd.patient_id = medication_adherence.patient_id
            AND pd.doctor_id = auth.uid()
        )
    );

-- Patients can manage their own case details
CREATE POLICY patient_case_details_patient_policy ON patient_case_details
    FOR ALL USING (auth.uid() = patient_id);

-- Doctors can view their patients' case details
CREATE POLICY patient_case_details_doctor_policy ON patient_case_details
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patient_doctor_relationships pd
            WHERE pd.patient_id = patient_case_details.patient_id
            AND pd.doctor_id = auth.uid()
        )
    );

-- Step 8: Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 9: Create triggers
CREATE TRIGGER update_patient_medications_updated_at
    BEFORE UPDATE ON patient_medications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_case_details_updated_at
    BEFORE UPDATE ON patient_case_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Done! All tables created successfully.
