-- Supabase Storage Setup for BeanHealth
-- IMPORTANT: Most of these operations should be done through the Supabase Dashboard
-- Only run the policy commands below in the SQL editor

-- ============================================================================
-- MANUAL SETUP REQUIRED (Do this in Supabase Dashboard):
-- ============================================================================
-- 1. Go to Storage > Buckets in your Supabase dashboard
-- 2. Click "Create Bucket"
-- 3. Name: medical-records
-- 4. Public bucket: YES (checked)
-- 5. File size limit: 10485760 (10MB)
-- 6. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, application/pdf
-- 7. Click "Save"

-- ============================================================================
-- SQL COMMANDS (Run these in SQL Editor):
-- ============================================================================

-- Storage policies for medical records bucket
-- These policies allow authenticated users to manage their medical record files

-- First, ensure RLS is enabled on storage.objects (it should be by default)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to upload files to medical-records bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to medical-records" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to medical-records" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'medical-records' 
  AND auth.role() = 'authenticated'
);

-- Policy 2: Allow public read access to medical-records bucket (since it's a public bucket)
DROP POLICY IF EXISTS "Allow public read access to medical-records" ON storage.objects;
CREATE POLICY "Allow public read access to medical-records" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'medical-records');

-- Policy 3: Allow authenticated users to update their own files
DROP POLICY IF EXISTS "Allow authenticated updates to medical-records" ON storage.objects;
CREATE POLICY "Allow authenticated updates to medical-records" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'medical-records' 
  AND auth.role() = 'authenticated'
);

-- Policy 4: Allow authenticated users to delete files (optional - you may want to restrict this)
DROP POLICY IF EXISTS "Allow authenticated deletes from medical-records" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from medical-records" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'medical-records' 
  AND auth.role() = 'authenticated'
);

-- ============================================================================
-- QUICK FIX: If you're getting RLS policy violations, run this simple policy:
-- ============================================================================

-- This creates a permissive policy that allows all operations on the medical-records bucket
-- You can run this first to get uploads working, then add more restrictive policies later

-- First, drop the policy if it exists (to avoid "already exists" errors)
DROP POLICY IF EXISTS "Allow all operations on medical-records" ON storage.objects;

-- Then create the new policy
CREATE POLICY "Allow all operations on medical-records" 
ON storage.objects FOR ALL 
USING (bucket_id = 'medical-records');

-- ============================================================================
-- IMPORTANT: Run the above policy in your Supabase SQL Editor to fix upload issues
-- ============================================================================

-- Note: RLS is already enabled on storage.objects by default in Supabase
-- Note: Permissions are already granted by default in Supabase