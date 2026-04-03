-- Admin RLS Policies Fix
-- Run this in Supabase SQL Editor to allow admins to view/edit patient visits
-- Updated to handle existing policies

-- ============================================================================
-- 1. DROP EXISTING ADMIN POLICIES (if they exist)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all visits" ON public.patient_visits;
DROP POLICY IF EXISTS "Admins can create visits" ON public.patient_visits;
DROP POLICY IF EXISTS "Admins can update all visits" ON public.patient_visits;
DROP POLICY IF EXISTS "Admins can delete all visits" ON public.patient_visits;
DROP POLICY IF EXISTS "Admins can manage all doctor notes" ON public.doctor_notes;

-- ============================================================================
-- 2. CREATE ADMIN POLICIES FOR PATIENT_VISITS
-- ============================================================================

-- Allow admins to view all visits
CREATE POLICY "Admins can view all visits" ON public.patient_visits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Allow admins to create visits
CREATE POLICY "Admins can create visits" ON public.patient_visits
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Allow admins to update any visit
CREATE POLICY "Admins can update all visits" ON public.patient_visits
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Allow admins to delete any visit
CREATE POLICY "Admins can delete all visits" ON public.patient_visits
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ============================================================================
-- 3. ADD ADMIN POLICIES FOR DOCTOR_NOTES (if needed)
-- ============================================================================

CREATE POLICY "Admins can manage all doctor notes" ON public.doctor_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Admin RLS policies updated successfully!' as result;
