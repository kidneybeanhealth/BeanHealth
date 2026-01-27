-- Complete fix for patient_doctor_relationships table
-- Run this in Supabase SQL Editor

-- First, let's check the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patient_doctor_relationships';

-- Make sure RLS is enabled
ALTER TABLE patient_doctor_relationships ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on this table to start fresh
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'patient_doctor_relationships') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON patient_doctor_relationships';
    END LOOP;
END $$;

-- Create comprehensive policies

-- 1. SELECT: Users can see relationships they're part of
CREATE POLICY "Select own relationships" ON patient_doctor_relationships
  FOR SELECT USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

-- 2. INSERT: Patients can create new relationships (key fix!)
CREATE POLICY "Patients can link to doctors" ON patient_doctor_relationships
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- 3. UPDATE: Users can update their relationships
CREATE POLICY "Update own relationships" ON patient_doctor_relationships
  FOR UPDATE USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

-- 4. DELETE: Users can delete their relationships
CREATE POLICY "Delete own relationships" ON patient_doctor_relationships
  FOR DELETE USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

-- Verify
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'patient_doctor_relationships';
