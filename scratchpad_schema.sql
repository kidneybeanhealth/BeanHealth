-- Nephrologist Scratchpad Schema
-- Run this in Supabase SQL Editor
-- Creates: patient_visits, doctor_notes, patient_lab_thresholds tables with RLS

-- ============================================================================
-- 1. PATIENT VISITS TABLE
-- Stores structured visit records (previously derived from prescriptions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patient_visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    complaint TEXT,
    observations TEXT,
    diet_recommendation TEXT,
    notes TEXT,
    is_visible_to_patient BOOLEAN DEFAULT true,
    -- Link to original prescription if migrated
    source_prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient_id ON public.patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_doctor_id ON public.patient_visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_date ON public.patient_visits(visit_date DESC);

-- ============================================================================
-- 2. DOCTOR NOTES TABLE
-- Quick scratchpad notes from doctors about patients
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.doctor_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_visible_to_patient BOOLEAN DEFAULT false,
    note_type TEXT DEFAULT 'quick_note' CHECK (note_type IN ('quick_note', 'clinical_observation', 'follow_up')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doctor_notes_patient_id ON public.doctor_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_notes_doctor_id ON public.doctor_notes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_notes_created_at ON public.doctor_notes(created_at DESC);

-- ============================================================================
-- 3. PATIENT LAB THRESHOLDS TABLE
-- Per-patient custom normal ranges for lab values
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patient_lab_thresholds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lab_type TEXT NOT NULL, -- 'creatinine', 'egfr', 'potassium', etc.
    custom_min DECIMAL(10,2),
    custom_max DECIMAL(10,2),
    reason TEXT, -- Clinical justification for custom range
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one threshold per patient per lab type
    UNIQUE(patient_id, lab_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_lab_thresholds_patient_id ON public.patient_lab_thresholds(patient_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_lab_thresholds ENABLE ROW LEVEL SECURITY;

-- PATIENT_VISITS policies
CREATE POLICY "Doctors can view visits for their patients" ON public.patient_visits
    FOR SELECT USING (
        doctor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.patient_doctor_relationships
            WHERE patient_id = patient_visits.patient_id AND doctor_id = auth.uid()
        )
    );

CREATE POLICY "Patients can view their own visits" ON public.patient_visits
    FOR SELECT USING (patient_id = auth.uid() AND is_visible_to_patient = true);

CREATE POLICY "Doctors can create visits" ON public.patient_visits
    FOR INSERT WITH CHECK (
        doctor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.patient_doctor_relationships
            WHERE patient_id = patient_visits.patient_id AND doctor_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can update their own visits" ON public.patient_visits
    FOR UPDATE USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can delete their own visits" ON public.patient_visits
    FOR DELETE USING (doctor_id = auth.uid());

-- DOCTOR_NOTES policies
CREATE POLICY "Doctors can view notes for their patients" ON public.doctor_notes
    FOR SELECT USING (
        doctor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.patient_doctor_relationships
            WHERE patient_id = doctor_notes.patient_id AND doctor_id = auth.uid()
        )
    );

CREATE POLICY "Patients can view visible notes" ON public.doctor_notes
    FOR SELECT USING (patient_id = auth.uid() AND is_visible_to_patient = true);

CREATE POLICY "Doctors can create notes" ON public.doctor_notes
    FOR INSERT WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Doctors can update their own notes" ON public.doctor_notes
    FOR UPDATE USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can delete their own notes" ON public.doctor_notes
    FOR DELETE USING (doctor_id = auth.uid());

-- PATIENT_LAB_THRESHOLDS policies
CREATE POLICY "Doctors can view thresholds for their patients" ON public.patient_lab_thresholds
    FOR SELECT USING (
        doctor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.patient_doctor_relationships
            WHERE patient_id = patient_lab_thresholds.patient_id AND doctor_id = auth.uid()
        )
    );

CREATE POLICY "Patients can view their own thresholds" ON public.patient_lab_thresholds
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "Doctors can manage thresholds" ON public.patient_lab_thresholds
    FOR ALL USING (doctor_id = auth.uid());

-- ============================================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patient_visits_updated_at
    BEFORE UPDATE ON public.patient_visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctor_notes_updated_at
    BEFORE UPDATE ON public.doctor_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_lab_thresholds_updated_at
    BEFORE UPDATE ON public.patient_lab_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. MIGRATION: Convert existing prescriptions to patient_visits
-- ============================================================================

INSERT INTO public.patient_visits (
    patient_id,
    doctor_id,
    visit_date,
    complaint,
    notes,
    is_visible_to_patient,
    source_prescription_id,
    created_at
)
SELECT 
    p.patient_id,
    p.doctor_id,
    DATE(p.created_at) as visit_date,
    COALESCE(
        (SELECT pcd.latest_complaint FROM public.patient_case_details pcd WHERE pcd.patient_id = p.patient_id),
        'Follow-up visit'
    ) as complaint,
    p.notes,
    true as is_visible_to_patient,
    p.id as source_prescription_id,
    p.created_at
FROM public.prescriptions p
WHERE NOT EXISTS (
    -- Don't duplicate if already migrated
    SELECT 1 FROM public.patient_visits pv WHERE pv.source_prescription_id = p.id
)
ON CONFLICT DO NOTHING;

-- Log migration results
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count FROM public.patient_visits WHERE source_prescription_id IS NOT NULL;
    RAISE NOTICE 'Migration complete: % prescription-based visits migrated to patient_visits table', migrated_count;
END $$;
