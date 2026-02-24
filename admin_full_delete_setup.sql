-- FUNCTION: admin_delete_user_completely
-- PURPOSE: Allows admins to completely remove a user from both public.users and auth.users
--          This ensures the email can be reused and no orphan data remains.
--
-- HOW TO USE: Run this script in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION admin_delete_user_completely(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Security Check: Ensure the executor is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Only administrators can perform this action.';
  END IF;

  -- 2. Delete from public.users
  -- Because dependencies (vitals, meds, etc.) are set to ON DELETE CASCADE,
  -- deleting the user profile will automatically clean up those records.
  DELETE FROM public.users WHERE id = target_user_id;

  -- 3. Delete from auth.users
  -- This removes the login credentials, allowing the user to sign up again with the same email.
  -- This requires the function to run with SECURITY DEFINER privileges.
  DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;
