-- Terms and Conditions Schema Extension
-- This migration adds terms acceptance tracking to the users table
-- Run this in your Supabase SQL editor

-- Add terms acceptance columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT '1.0';

-- Create an index for faster lookups on terms_accepted
CREATE INDEX IF NOT EXISTS idx_users_terms_accepted ON public.users(terms_accepted);

-- Update existing users to have terms_accepted = false (they'll need to accept)
-- This ensures all existing patients will be prompted to accept terms
UPDATE public.users 
SET terms_accepted = FALSE, terms_version = '1.0'
WHERE terms_accepted IS NULL AND role = 'patient';

-- Create a function to update terms acceptance
CREATE OR REPLACE FUNCTION accept_terms(user_id UUID, version TEXT DEFAULT '1.0')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.users
  SET 
    terms_accepted = TRUE,
    terms_accepted_at = NOW(),
    terms_version = version,
    updated_at = NOW()
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_terms(UUID, TEXT) TO authenticated;

-- Comment for documentation
COMMENT ON COLUMN public.users.terms_accepted IS 'Whether the user has accepted the terms and conditions';
COMMENT ON COLUMN public.users.terms_accepted_at IS 'Timestamp when the user accepted the terms';
COMMENT ON COLUMN public.users.terms_version IS 'Version of terms and conditions the user accepted';
