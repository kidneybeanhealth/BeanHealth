-- Fix for Delete Button Not Working
-- This updates the RLS policies to be less restrictive for delete operations
-- Run this in your Supabase SQL Editor

-- Drop existing delete policies
DROP POLICY IF EXISTS "Patients can delete own fluid intake" ON public.fluid_intake;
DROP POLICY IF EXISTS "Patients can delete own lab results" ON public.lab_results;
DROP POLICY IF EXISTS "Patients can delete own upcoming tests" ON public.upcoming_tests;

-- Recreate delete policies with better error handling
CREATE POLICY "Patients can delete own fluid intake" ON public.fluid_intake
  FOR DELETE USING (
    patient_id = auth.uid() OR
    patient_id IN (SELECT id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Patients can delete own lab results" ON public.lab_results
  FOR DELETE USING (
    patient_id = auth.uid() OR
    patient_id IN (SELECT id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Patients can delete own upcoming tests" ON public.upcoming_tests
  FOR DELETE USING (
    patient_id = auth.uid() OR
    patient_id IN (SELECT id FROM public.users WHERE id = auth.uid())
  );

-- Check current user ID (for debugging)
-- Run this to see if auth.uid() is returning correctly
SELECT auth.uid() as current_user_id;

-- Check if your fluid intake records have the correct patient_id
SELECT id, patient_id, amount_ml, fluid_type, recorded_at 
FROM public.fluid_intake 
WHERE patient_id = auth.uid()
LIMIT 5;
