-- Enhanced Medication Fields Migration
-- Run this in Supabase SQL Editor to add composition, timing, and duration fields

-- Add new columns to visit_medications table
ALTER TABLE public.visit_medications 
ADD COLUMN IF NOT EXISTS composition TEXT,
ADD COLUMN IF NOT EXISTS timing TEXT,
ADD COLUMN IF NOT EXISTS duration TEXT;

-- Update existing instructions field comment (for reference)
COMMENT ON COLUMN public.visit_medications.composition IS 'Drug composition, e.g., ROSUVASTATIN - 10MG';
COMMENT ON COLUMN public.visit_medications.timing IS 'When to take medication, e.g., AFTER FOOD - DINNER';
COMMENT ON COLUMN public.visit_medications.duration IS 'Treatment duration, e.g., 1 MONTH';
COMMENT ON COLUMN public.visit_medications.frequency IS 'Dosage schedule, e.g., 0-0-1 :: DAILY';

SELECT 'Enhanced medication fields added successfully!' as result;
