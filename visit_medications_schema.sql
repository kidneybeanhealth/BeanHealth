-- Visit Medications Schema
-- Links medications to specific patient visits
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. VISIT MEDICATIONS TABLE
-- Links medications to specific visits with status tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visit_medications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    visit_id UUID NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    dosage_unit TEXT,
    frequency TEXT,
    status TEXT DEFAULT 'unchanged' CHECK (status IN ('added', 'removed', 'dosage_increased', 'dosage_decreased', 'unchanged')),
    previous_dosage TEXT,
    previous_dosage_unit TEXT,
    instructions TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_extracted', 'synced')),
    source_medication_id UUID,  -- Optional reference to source medication
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_visit_medications_visit_id ON public.visit_medications(visit_id);

-- ============================================================================
-- 2. ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE public.visit_medications ENABLE ROW LEVEL SECURITY;

-- Doctors can view medications for visits they have access to
CREATE POLICY "Doctors can view visit medications" ON public.visit_medications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.patient_visits pv
            WHERE pv.id = visit_medications.visit_id
            AND (
                pv.doctor_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.patient_doctor_relationships pdr
                    WHERE pdr.patient_id = pv.patient_id AND pdr.doctor_id = auth.uid()
                )
            )
        )
    );

-- Patients can view medications for their visible visits
CREATE POLICY "Patients can view their visit medications" ON public.visit_medications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.patient_visits pv
            WHERE pv.id = visit_medications.visit_id
            AND pv.patient_id = auth.uid()
            AND pv.is_visible_to_patient = true
        )
    );

-- Admins can do everything
CREATE POLICY "Admins can manage visit medications" ON public.visit_medications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Doctors can insert medications for their visits
CREATE POLICY "Doctors can add visit medications" ON public.visit_medications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.patient_visits pv
            WHERE pv.id = visit_medications.visit_id
            AND pv.doctor_id = auth.uid()
        )
    );

-- Doctors can update medications for their visits
CREATE POLICY "Doctors can update visit medications" ON public.visit_medications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.patient_visits pv
            WHERE pv.id = visit_medications.visit_id
            AND pv.doctor_id = auth.uid()
        )
    );

-- Doctors can delete medications from their visits
CREATE POLICY "Doctors can delete visit medications" ON public.visit_medications
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.patient_visits pv
            WHERE pv.id = visit_medications.visit_id
            AND pv.doctor_id = auth.uid()
        )
    );

-- ============================================================================
-- 3. UPDATED_AT TRIGGER (uses existing function if available)
-- ============================================================================

-- Create the update function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger
DROP TRIGGER IF EXISTS update_visit_medications_updated_at ON public.visit_medications;
CREATE TRIGGER update_visit_medications_updated_at
    BEFORE UPDATE ON public.visit_medications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'visit_medications table created successfully!' as result;
