-- Enterprise (Hospital) Setup Script
-- Run this in your Supabase SQL Editor

-- 1. Update Role Constraint
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('patient', 'doctor', 'admin', 'enterprise'));

-- 2. Insert Enterprise User
-- This inserts the user into public.users. 
-- IMPORTANT: The user must also exist in auth.users (Supabase Auth). 
-- If you haven't created the user in the Auth tab yet, do that first!
INSERT INTO public.users (id, email, name, role)
VALUES (
  '9618d88d-9e52-4cc4-afee-387b1f295498',
  'chitti@beanhealth.com',
  'Enterprise Hospital',
  'enterprise'
)
ON CONFLICT (id) DO UPDATE
SET 
  role = 'enterprise',
  email = 'chitti@beanhealth.com';

-- 3. Enterprise RLS Policies (Basic)
-- Allow enterprise users to view their own profile
CREATE POLICY "Enterprise can view own profile" ON public.users
  FOR SELECT USING (
    auth.uid() = id AND role = 'enterprise'
  );

-- Placeholder for future: Allow enterprise users to view ALL patients?
-- That would go here. For now, we stick to the basics.
