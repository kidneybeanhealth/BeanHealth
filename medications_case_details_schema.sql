-- ============================================
-- ENHANCED MEDICATIONS & CASE DETAILS SCHEMA
-- Run this in your Supabase SQL editor
-- ============================================

-- Enhanced Medications Table
CREATE TABLE IF NOT EXISTS patient_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    dosage_unit VARCHAR(20) NOT NULL DEFAULT 'mg',
    frequency VARCHAR(50) NOT NULL DEFAULT 'once_daily',
    scheduled_times TEXT[] DEFAULT ARRAY['08:00'], -- Array of HH:mm times
    instructions TEXT,
    category VARCHAR(100),
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    is_custom BOOLEAN DEFAULT false, -- True if user added custom medication
    reminder_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster patient lookups
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id ON patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_active ON patient_medications(patient_id, is_active);

-- Medication Adherence Log
CREATE TABLE IF NOT EXISTS medication_adherence (
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
    
    -- Unique constraint to prevent duplicate entries
    UNIQUE(medication_id, scheduled_date, scheduled_time)
);

-- Indexes for adherence lookups
CREATE INDEX IF NOT EXISTS idx_medication_adherence_patient ON medication_adherence(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_adherence_date ON medication_adherence(patient_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_medication_adherence_medication ON medication_adherence(medication_id);

-- Case Details Table
CREATE TABLE IF NOT EXISTS patient_case_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    primary_condition TEXT,
    latest_complaint TEXT,
    complaint_date DATE,
    medical_history TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of history items
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for case details
CREATE INDEX IF NOT EXISTS idx_patient_case_details_patient ON patient_case_details(patient_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_adherence ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_case_details ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS patient_medications_patient_policy ON patient_medications;
DROP POLICY IF EXISTS patient_medications_doctor_policy ON patient_medications;
DROP POLICY IF EXISTS medication_adherence_patient_policy ON medication_adherence;
DROP POLICY IF EXISTS medication_adherence_doctor_policy ON medication_adherence;
DROP POLICY IF EXISTS patient_case_details_patient_policy ON patient_case_details;
DROP POLICY IF EXISTS patient_case_details_doctor_policy ON patient_case_details;

-- Patients can manage their own medications
CREATE POLICY patient_medications_patient_policy ON patient_medications
    FOR ALL USING (auth.uid() = patient_id);

-- Doctors can view their patients' medications (read-only)
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

-- Doctors can view their patients' adherence (read-only)
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

-- Doctors can view their patients' case details (read-only)
CREATE POLICY patient_case_details_doctor_policy ON patient_case_details
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM patient_doctor_relationships pd
            WHERE pd.patient_id = patient_case_details.patient_id
            AND pd.doctor_id = auth.uid()
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_patient_medications_updated_at ON patient_medications;
CREATE TRIGGER update_patient_medications_updated_at
    BEFORE UPDATE ON patient_medications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_case_details_updated_at ON patient_case_details;
CREATE TRIGGER update_patient_case_details_updated_at
    BEFORE UPDATE ON patient_case_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE patient_medications;
ALTER PUBLICATION supabase_realtime ADD TABLE medication_adherence;
ALTER PUBLICATION supabase_realtime ADD TABLE patient_case_details;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment and modify to add sample data:
/*
INSERT INTO patient_case_details (patient_id, primary_condition, latest_complaint, medical_history)
VALUES (
    'your-patient-uuid-here',
    'Chronic Kidney Disease Stage 3b',
    'Increased fatigue and mild swelling in ankles',
    ARRAY['Hypertension diagnosed 2018', 'Type 2 Diabetes diagnosed 2020', 'Previous AKI episode 2022']
);
*/
