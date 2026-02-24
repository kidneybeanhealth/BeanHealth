-- ============================================
-- Custom Lab Types Schema for BeanHealth
-- Run this in your Supabase SQL editor
-- ============================================

-- 1. Create custom lab types table
CREATE TABLE IF NOT EXISTS public.custom_lab_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                        -- Display name (e.g., "Phosphorus")
  code TEXT NOT NULL UNIQUE,                 -- Internal code (e.g., "phosphorus")
  unit TEXT NOT NULL,                        -- Unit of measurement (e.g., "mg/dL")
  reference_range_min DECIMAL(10,2),         -- Normal range minimum
  reference_range_max DECIMAL(10,2),         -- Normal range maximum
  category TEXT DEFAULT 'custom' CHECK (category IN ('system', 'custom')),
  description TEXT,                          -- Optional description
  is_universal BOOLEAN DEFAULT true,         -- If true, available to all patients
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  enabled BOOLEAN DEFAULT true,              -- Soft delete flag
  display_order INTEGER DEFAULT 100,         -- For ordering in dropdowns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create patient-specific lab type assignments table
CREATE TABLE IF NOT EXISTS public.patient_lab_type_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  lab_type_id UUID REFERENCES public.custom_lab_types(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, lab_type_id)
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_lab_types_code ON public.custom_lab_types(code);
CREATE INDEX IF NOT EXISTS idx_custom_lab_types_enabled ON public.custom_lab_types(enabled);
CREATE INDEX IF NOT EXISTS idx_custom_lab_types_category ON public.custom_lab_types(category);
CREATE INDEX IF NOT EXISTS idx_patient_lab_assignments_patient ON public.patient_lab_type_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_assignments_type ON public.patient_lab_type_assignments(lab_type_id);

-- 4. Enable Row Level Security
ALTER TABLE public.custom_lab_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_lab_type_assignments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for custom_lab_types

-- Everyone can view enabled lab types
CREATE POLICY "Anyone can view enabled lab types" ON public.custom_lab_types
  FOR SELECT USING (enabled = true);

-- Admins can do everything
CREATE POLICY "Admins can manage lab types" ON public.custom_lab_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. RLS Policies for patient_lab_type_assignments

-- Patients can view their own assignments
CREATE POLICY "Patients can view own lab type assignments" ON public.patient_lab_type_assignments
  FOR SELECT USING (patient_id = auth.uid());

-- Admins can manage all assignments
CREATE POLICY "Admins can manage lab type assignments" ON public.patient_lab_type_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Doctors can view their patients' assignments
CREATE POLICY "Doctors can view patient lab type assignments" ON public.patient_lab_type_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.patient_doctor_relationships 
      WHERE patient_id = patient_lab_type_assignments.patient_id 
      AND doctor_id = auth.uid()
    )
  );

-- 7. Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_custom_lab_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_custom_lab_types ON public.custom_lab_types;
CREATE TRIGGER trigger_update_custom_lab_types
  BEFORE UPDATE ON public.custom_lab_types
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_lab_types_updated_at();

-- 8. Seed system default lab types (the built-in CKD tests)
INSERT INTO public.custom_lab_types (name, code, unit, reference_range_min, reference_range_max, category, description, display_order, is_universal) VALUES
  ('eGFR', 'egfr', 'ml/min/1.73m²', 60, 120, 'system', 'Estimated Glomerular Filtration Rate - measures kidney function', 1, true),
  ('Creatinine', 'creatinine', 'mg/dL', 0.7, 1.3, 'system', 'Waste product filtered by kidneys', 2, true),
  ('BUN', 'bun', 'mg/dL', 7, 20, 'system', 'Blood Urea Nitrogen - kidney function marker', 3, true),
  ('Potassium', 'potassium', 'mmol/L', 3.5, 5.0, 'system', 'Essential electrolyte', 4, true),
  ('Hemoglobin', 'hemoglobin', 'g/dL', 12.0, 16.0, 'system', 'Oxygen-carrying protein in blood', 5, true),
  ('Bicarbonate', 'bicarbonate', 'mmol/L', 22, 29, 'system', 'Blood pH buffer', 6, true),
  ('ACR', 'acr', 'mg/g', 0, 30, 'system', 'Albumin-to-Creatinine Ratio - detects kidney damage', 7, true)
ON CONFLICT (code) DO NOTHING;

-- 9. Modify lab_results table to support custom lab types
-- First, drop the existing CHECK constraint on test_type
ALTER TABLE public.lab_results DROP CONSTRAINT IF EXISTS lab_results_test_type_check;

-- Add lab_type_id column (optional foreign key to custom_lab_types)
ALTER TABLE public.lab_results 
  ADD COLUMN IF NOT EXISTS lab_type_id UUID REFERENCES public.custom_lab_types(id);

-- Create index on the new column
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_type_id ON public.lab_results(lab_type_id);

-- 10. Migrate existing lab results to use lab_type_id
-- This updates existing records to link to the corresponding system lab type
UPDATE public.lab_results lr
SET lab_type_id = clt.id
FROM public.custom_lab_types clt
WHERE lr.test_type = clt.code AND lr.lab_type_id IS NULL;

-- ============================================
-- DONE! Custom lab types are now enabled.
-- ============================================
