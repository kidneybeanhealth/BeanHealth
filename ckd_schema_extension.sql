-- BeanHealth CKD Extension Schema
-- This file extends the base schema with CKD-specific tables and fields
-- Run these commands in your Supabase SQL editor AFTER running supabase_schema.sql

-- ============================================
-- 1. EXTEND USERS TABLE WITH CKD FIELDS
-- ============================================

-- Add CKD-specific fields to users table
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS ckd_stage TEXT CHECK (ckd_stage IN ('1', '2', '3a', '3b', '4', '5')),
  ADD COLUMN IF NOT EXISTS comorbidities TEXT[],
  ADD COLUMN IF NOT EXISTS baseline_weight DECIMAL(5,2), -- in kg
  ADD COLUMN IF NOT EXISTS daily_fluid_target INTEGER DEFAULT 1500; -- in ml, default 1.5L

-- ============================================
-- 2. EXTEND VITALS TABLE WITH WEIGHT AND SPO2
-- ============================================

-- Add weight and SpO2 to vitals table
ALTER TABLE public.vitals
  ADD COLUMN IF NOT EXISTS weight_value DECIMAL(5,2), -- in kg
  ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS spo2_value TEXT,
  ADD COLUMN IF NOT EXISTS spo2_unit TEXT DEFAULT '%',
  ADD COLUMN IF NOT EXISTS spo2_trend TEXT CHECK (spo2_trend IN ('up', 'down', 'stable'));

-- ============================================
-- 3. FLUID INTAKE TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.fluid_intake (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
  fluid_type TEXT DEFAULT 'water',
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_fluid_intake_patient_id ON public.fluid_intake(patient_id);
CREATE INDEX IF NOT EXISTS idx_fluid_intake_recorded_at ON public.fluid_intake(recorded_at);
CREATE INDEX IF NOT EXISTS idx_fluid_intake_patient_date ON public.fluid_intake(patient_id, recorded_at);

-- ============================================
-- 4. LAB RESULTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.lab_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('creatinine', 'egfr', 'bun', 'potassium', 'hemoglobin', 'bicarbonate', 'acr')),
  value DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  reference_range_min DECIMAL(10,2),
  reference_range_max DECIMAL(10,2),
  status TEXT CHECK (status IN ('normal', 'borderline', 'abnormal', 'critical')),
  test_date DATE NOT NULL,
  lab_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_lab_results_patient_id ON public.lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_test_type ON public.lab_results(test_type);
CREATE INDEX IF NOT EXISTS idx_lab_results_test_date ON public.lab_results(test_date);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient_type ON public.lab_results(patient_id, test_type, test_date);

-- ============================================
-- 5. UPCOMING TESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.upcoming_tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  test_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  location TEXT,
  doctor_name TEXT,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_upcoming_tests_patient_id ON public.upcoming_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_upcoming_tests_scheduled_date ON public.upcoming_tests(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_upcoming_tests_completed ON public.upcoming_tests(completed);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.fluid_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upcoming_tests ENABLE ROW LEVEL SECURITY;

-- Fluid intake policies
CREATE POLICY "Patients can view own fluid intake" ON public.fluid_intake
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.patient_doctor_relationships 
      WHERE patient_id = fluid_intake.patient_id AND doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own fluid intake" ON public.fluid_intake
  FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update own fluid intake" ON public.fluid_intake
  FOR UPDATE USING (patient_id = auth.uid());

CREATE POLICY "Patients can delete own fluid intake" ON public.fluid_intake
  FOR DELETE USING (patient_id = auth.uid());

-- Lab results policies
CREATE POLICY "Patients can view own lab results" ON public.lab_results
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.patient_doctor_relationships 
      WHERE patient_id = lab_results.patient_id AND doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own lab results" ON public.lab_results
  FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update own lab results" ON public.lab_results
  FOR UPDATE USING (patient_id = auth.uid());

CREATE POLICY "Patients can delete own lab results" ON public.lab_results
  FOR DELETE USING (patient_id = auth.uid());

-- Upcoming tests policies
CREATE POLICY "Patients can view own upcoming tests" ON public.upcoming_tests
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.patient_doctor_relationships 
      WHERE patient_id = upcoming_tests.patient_id AND doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own upcoming tests" ON public.upcoming_tests
  FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update own upcoming tests" ON public.upcoming_tests
  FOR UPDATE USING (patient_id = auth.uid());

CREATE POLICY "Patients can delete own upcoming tests" ON public.upcoming_tests
  FOR DELETE USING (patient_id = auth.uid());

-- ============================================
-- 7. TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_upcoming_tests_updated_at BEFORE UPDATE ON public.upcoming_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. FUNCTIONS FOR CKD STAGE AUTO-CALCULATION
-- ============================================

-- Function to automatically calculate and update CKD stage based on eGFR
CREATE OR REPLACE FUNCTION calculate_ckd_stage(egfr_value DECIMAL)
RETURNS TEXT AS $$
BEGIN
  IF egfr_value >= 90 THEN
    RETURN '1';
  ELSIF egfr_value >= 60 THEN
    RETURN '2';
  ELSIF egfr_value >= 45 THEN
    RETURN '3a';
  ELSIF egfr_value >= 30 THEN
    RETURN '3b';
  ELSIF egfr_value >= 15 THEN
    RETURN '4';
  ELSE
    RETURN '5';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update CKD stage when eGFR lab result is added
CREATE OR REPLACE FUNCTION auto_update_ckd_stage()
RETURNS TRIGGER AS $$
DECLARE
  new_stage TEXT;
BEGIN
  -- Only process if this is an eGFR result
  IF NEW.test_type = 'egfr' THEN
    -- Calculate the new stage
    new_stage := calculate_ckd_stage(NEW.value);
    
    -- Update the user's CKD stage
    UPDATE public.users
    SET ckd_stage = new_stage,
        updated_at = NOW()
    WHERE id = NEW.patient_id;
    
    -- Log the stage update (optional - you could create a separate audit table)
    RAISE NOTICE 'Updated CKD stage for patient % to stage % (eGFR: %)', 
      NEW.patient_id, new_stage, NEW.value;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on lab_results table
DROP TRIGGER IF EXISTS trigger_auto_update_ckd_stage ON public.lab_results;
CREATE TRIGGER trigger_auto_update_ckd_stage
  AFTER INSERT ON public.lab_results
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_ckd_stage();

-- ============================================
-- 9. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================

-- Sample fluid intake data
INSERT INTO public.fluid_intake (patient_id, amount_ml, fluid_type, recorded_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', 250, 'water', NOW() - INTERVAL '2 hours'),
  ('550e8400-e29b-41d4-a716-446655440003', 500, 'water', NOW() - INTERVAL '4 hours'),
  ('550e8400-e29b-41d4-a716-446655440003', 200, 'juice', NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;

-- Sample lab results
INSERT INTO public.lab_results (patient_id, test_type, value, unit, reference_range_min, reference_range_max, status, test_date) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', 'creatinine', 1.2, 'mg/dL', 0.7, 1.3, 'normal', CURRENT_DATE - INTERVAL '7 days'),
  ('550e8400-e29b-41d4-a716-446655440003', 'egfr', 65, 'ml/min/1.73m²', 60, 120, 'normal', CURRENT_DATE - INTERVAL '7 days'),
  ('550e8400-e29b-41d4-a716-446655440003', 'potassium', 4.2, 'mmol/L', 3.5, 5.0, 'normal', CURRENT_DATE - INTERVAL '7 days'),
  ('550e8400-e29b-41d4-a716-446655440003', 'hemoglobin', 13.5, 'g/dL', 12.0, 16.0, 'normal', CURRENT_DATE - INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- Sample upcoming tests
INSERT INTO public.upcoming_tests (patient_id, test_name, scheduled_date, location) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', 'Comprehensive Metabolic Panel', CURRENT_DATE + INTERVAL '14 days', 'City Hospital Lab'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Renal Function Test', CURRENT_DATE + INTERVAL '30 days', 'City Hospital Lab'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Kidney Ultrasound', CURRENT_DATE + INTERVAL '45 days', 'Radiology Center')
ON CONFLICT DO NOTHING;

-- Update sample patient with CKD data
UPDATE public.users 
SET 
  age = 58,
  ckd_stage = '2',
  comorbidities = ARRAY['Hypertension', 'Type 2 Diabetes Mellitus'],
  baseline_weight = 75.5,
  daily_fluid_target = 1800
WHERE id = '550e8400-e29b-41d4-a716-446655440003';
