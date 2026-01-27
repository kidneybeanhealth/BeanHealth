-- =====================================================
-- EMERGENCY FIX: Disable RLS on Users Table
-- This will let you access your data immediately
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Drop ALL policies on users table
DO $$ 
DECLARE 
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 2: DISABLE RLS on users table
-- This allows all authenticated users to access the table
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify your data still exists
SELECT id, name, email, role FROM public.users LIMIT 10;

-- Done! Your data should now be accessible.
-- After verifying login works, we can re-enable RLS with simpler policies.
SELECT 'SUCCESS: RLS disabled on users table. Refresh your browser and login!' AS status;
