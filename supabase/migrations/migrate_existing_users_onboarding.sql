-- RESET ALL USERS FOR FRESH ONBOARDING
-- This script resets ALL users so they must complete the new onboarding flow
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. ENSURE onboarding_completed COLUMN EXISTS
-- ============================================

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- ============================================
-- 2. RESET ALL USERS TO REQUIRE ONBOARDING
-- This forces everyone to go through the new onboarding
-- ============================================

UPDATE public.users
SET onboarding_completed = false
WHERE onboarding_completed IS NULL OR onboarding_completed = true;

-- ============================================
-- 3. VERIFY THE RESET
-- ============================================

SELECT 
  role,
  COUNT(*) as total_users,
  SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as already_onboarded,
  SUM(CASE WHEN onboarding_completed = false OR onboarding_completed IS NULL THEN 1 ELSE 0 END) as needs_onboarding
FROM public.users
GROUP BY role
ORDER BY role;

-- ============================================
-- 4. SHOW MESSAGE
-- ============================================

DO $$
DECLARE
  total_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM public.users WHERE onboarding_completed = false OR onboarding_completed IS NULL;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESET COMPLETE!';
  RAISE NOTICE '% users will now see the onboarding flow', total_users;
  RAISE NOTICE '========================================';
END $$;
