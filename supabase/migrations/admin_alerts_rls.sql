-- Add Admin Policies for CDS Alert Definitions
-- Run this in Supabase to allow admins to manage alert rules

-- Drop existing admin policy if it exists
DROP POLICY IF EXISTS "Admins can manage alert definitions" ON cds_alert_definitions;
DROP POLICY IF EXISTS "Admins can view all alert definitions" ON cds_alert_definitions;
DROP POLICY IF EXISTS "Admins can update alert definitions" ON cds_alert_definitions;
DROP POLICY IF EXISTS "Admins can insert alert definitions" ON cds_alert_definitions;

-- Allow admins to SELECT all alert definitions
CREATE POLICY "Admins can view all alert definitions" 
ON cds_alert_definitions FOR SELECT
USING (
  is_admin() OR enabled = true
);

-- Allow admins to UPDATE alert definitions
CREATE POLICY "Admins can update alert definitions" 
ON cds_alert_definitions FOR UPDATE
USING (is_admin());

-- Allow admins to INSERT alert definitions
CREATE POLICY "Admins can insert alert definitions" 
ON cds_alert_definitions FOR INSERT
WITH CHECK (is_admin());

-- Verify policies
SELECT policyname FROM pg_policies WHERE tablename = 'cds_alert_definitions';
