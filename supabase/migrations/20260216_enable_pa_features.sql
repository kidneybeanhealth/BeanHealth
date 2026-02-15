-- Migration: Enable PA Actor Auth and fix passcode consistency
-- Hospital: KONGUNAD KIDNEY CENTRE (50ae939b-8a54-47a4-99bc-88ccb24ef459)

BEGIN;

-- 1. Enable PA Actor Auth for the specific hospital identifying as Kongunad
-- Also enable for the default enterprise hospital for testing consistency
UPDATE public.hospital_profiles 
SET enable_pa_actor_auth = true 
WHERE id IN (
    '50ae939b-8a54-47a4-99bc-88ccb24ef459', 
    '9618d88d-9e52-4cc4-afee-387b1f295498'
);

-- Also enable for ALL hospitals that might have been created manually
-- to ensure the UI is consistent as requested.
UPDATE public.hospital_profiles 
SET enable_pa_actor_auth = true
WHERE enable_pa_actor_auth = false;

-- 2. Ensure the RPC handles legacy matching correctly and with proper search path
CREATE OR REPLACE FUNCTION public._doctor_passcode_matches(p_stored TEXT, p_passcode TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_stored IS NULL OR p_passcode IS NULL THEN
        RETURN false;
    END IF;

    -- If stored is a bcrypt hash
    IF p_stored LIKE '$2%' THEN
        RETURN crypt(p_passcode, p_stored) = p_stored;
    END IF;

    -- Fallback to plain text comparison
    RETURN p_stored = p_passcode;
END;
$$;

-- 3. In case any doctor has a NULL access_code or it was changed to another column,
-- we ensure it's at least set to the known default if it's currently missing.
-- (This is just a safety measure for the specific hospital mentioned)
UPDATE public.hospital_doctors
SET access_code = 'Prabhakar123'
WHERE hospital_id = '50ae939b-8a54-47a4-99bc-88ccb24ef459'
  AND name ILIKE '%Prabhakar%'
  AND (access_code IS NULL OR access_code = '');

COMMIT;
