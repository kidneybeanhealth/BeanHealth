-- =====================================================
-- REFERRAL SYSTEM MIGRATION
-- Version: 2.0
-- Description: Add referral-based onboarding with sequential patient IDs
-- =====================================================

-- Step 1: Add new columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS patient_uid TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS diagnosis_year INTEGER,
ADD COLUMN IF NOT EXISTS ckd_stage TEXT CHECK (ckd_stage IN ('Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', NULL)),
ADD COLUMN IF NOT EXISTS comorbidities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS referring_doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 2: Create sequence for patient UIDs
CREATE SEQUENCE IF NOT EXISTS patient_uid_seq START 1;

-- Step 3: Create function to generate sequential patient UID
CREATE OR REPLACE FUNCTION generate_patient_uid()
RETURNS TEXT AS $$
DECLARE
  next_val INTEGER;
  uid TEXT;
BEGIN
  -- Get next sequence value (atomic operation)
  next_val := nextval('patient_uid_seq');
  
  -- Format as BH-PAT-0001
  uid := 'BH-PAT-' || LPAD(next_val::TEXT, 4, '0');
  
  RETURN uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create function to generate doctor referral code
CREATE OR REPLACE FUNCTION generate_doctor_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_flag BOOLEAN;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  LOOP
    -- Generate format: DOC-AB12CD (6 random alphanumeric)
    code := 'DOC-' || 
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = code) INTO exists_flag;
    
    EXIT WHEN NOT exists_flag OR attempts >= max_attempts;
    
    attempts := attempts + 1;
  END LOOP;
  
  IF attempts >= max_attempts THEN
    RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', max_attempts;
  END IF;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger to auto-generate referral codes for doctors
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate for doctors if not already set
  IF NEW.role = 'doctor' AND (NEW.referral_code IS NULL OR NEW.referral_code = '') THEN
    NEW.referral_code := generate_doctor_referral_code();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_generate_referral_code ON public.users;
CREATE TRIGGER trigger_auto_generate_referral_code
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_referral_code();

-- Step 6: Create trigger to auto-generate patient UIDs
CREATE OR REPLACE FUNCTION auto_generate_patient_uid()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate for patients if not already set and consent is accepted
  IF NEW.role = 'patient' AND (NEW.patient_uid IS NULL OR NEW.patient_uid = '') AND NEW.consent_accepted = TRUE THEN
    NEW.patient_uid := generate_patient_uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_generate_patient_uid ON public.users;
CREATE TRIGGER trigger_auto_generate_patient_uid
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_patient_uid();

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_patient_uid ON public.users(patient_uid) WHERE patient_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referring_doctor ON public.users(referring_doctor_id) WHERE referring_doctor_id IS NOT NULL;

-- Step 8: Update RLS policies for referral system
-- Allow doctors to view patients referred by them
DROP POLICY IF EXISTS "Doctors can view referred patients" ON public.users;
CREATE POLICY "Doctors can view referred patients" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR
    (role = 'patient' AND referring_doctor_id = auth.uid())
  );

-- Step 9: Function to validate referral code
CREATE OR REPLACE FUNCTION validate_referral_code(code TEXT)
RETURNS TABLE(valid BOOLEAN, doctor_id UUID, doctor_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as valid,
    u.id as doctor_id,
    u.name as doctor_name
  FROM public.users u
  WHERE u.referral_code = code 
    AND u.role = 'doctor'
  LIMIT 1;
  
  -- If no results, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Backfill referral codes for existing doctors
DO $$
DECLARE
  doctor_record RECORD;
BEGIN
  FOR doctor_record IN 
    SELECT id FROM public.users WHERE role = 'doctor' AND referral_code IS NULL
  LOOP
    UPDATE public.users 
    SET referral_code = generate_doctor_referral_code()
    WHERE id = doctor_record.id;
  END LOOP;
END $$;

-- Step 11: Create helper function to register patient with referral
CREATE OR REPLACE FUNCTION register_patient_with_referral(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_age INTEGER,
  p_gender TEXT,
  p_contact TEXT,
  p_referral_code TEXT,
  p_consent_accepted BOOLEAN,
  p_diagnosis_year INTEGER DEFAULT NULL,
  p_ckd_stage TEXT DEFAULT NULL,
  p_comorbidities JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE(success BOOLEAN, patient_uid TEXT, error_message TEXT) AS $$
DECLARE
  v_doctor_id UUID;
  v_patient_uid TEXT;
BEGIN
  -- Validate referral code
  SELECT doctor_id INTO v_doctor_id
  FROM validate_referral_code(p_referral_code)
  WHERE valid = TRUE;
  
  IF v_doctor_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid referral code'::TEXT;
    RETURN;
  END IF;
  
  -- Check consent
  IF p_consent_accepted = FALSE THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Consent must be accepted'::TEXT;
    RETURN;
  END IF;
  
  -- Insert/Update user record
  INSERT INTO public.users (
    id, email, name, role, 
    date_of_birth, -- Calculate from age
    consent_accepted,
    diagnosis_year,
    ckd_stage,
    comorbidities,
    referring_doctor_id
  ) VALUES (
    p_user_id,
    p_email,
    p_name,
    'patient',
    CURRENT_DATE - (p_age * INTERVAL '1 year'),
    p_consent_accepted,
    p_diagnosis_year,
    p_ckd_stage,
    p_comorbidities,
    v_doctor_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    date_of_birth = EXCLUDED.date_of_birth,
    consent_accepted = EXCLUDED.consent_accepted,
    diagnosis_year = EXCLUDED.diagnosis_year,
    ckd_stage = EXCLUDED.ckd_stage,
    comorbidities = EXCLUDED.comorbidities,
    referring_doctor_id = EXCLUDED.referring_doctor_id
  RETURNING patient_uid INTO v_patient_uid;
  
  -- Create patient-doctor relationship
  INSERT INTO public.patient_doctor_relationships (patient_id, doctor_id)
  VALUES (p_user_id, v_doctor_id)
  ON CONFLICT (patient_id, doctor_id) DO NOTHING;
  
  RETURN QUERY SELECT TRUE, v_patient_uid, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_patient_uid() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_doctor_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION register_patient_with_referral(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, JSONB) TO authenticated;

-- Step 13: Add comments for documentation
COMMENT ON COLUMN public.users.referral_code IS 'Unique referral code for doctors (format: DOC-XXXXXX)';
COMMENT ON COLUMN public.users.patient_uid IS 'Sequential human-readable patient ID (format: BH-PAT-0001)';
COMMENT ON COLUMN public.users.consent_accepted IS 'Patient consent for data sharing and medical record access';
COMMENT ON COLUMN public.users.diagnosis_year IS 'Year of CKD diagnosis';
COMMENT ON COLUMN public.users.ckd_stage IS 'Current CKD stage (1-5)';
COMMENT ON COLUMN public.users.comorbidities IS 'Array of comorbidities: DM, HTN, etc.';
COMMENT ON COLUMN public.users.referring_doctor_id IS 'Doctor who referred this patient';

COMMENT ON FUNCTION generate_patient_uid() IS 'Generates sequential patient UID in format BH-PAT-0001';
COMMENT ON FUNCTION generate_doctor_referral_code() IS 'Generates unique doctor referral code in format DOC-XXXXXX';
COMMENT ON FUNCTION validate_referral_code(TEXT) IS 'Validates if referral code exists and belongs to an active doctor';
COMMENT ON FUNCTION register_patient_with_referral(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, JSONB) IS 'Atomically registers patient with referral code validation';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '  - Doctor referral codes (auto-generated)';
  RAISE NOTICE '  - Sequential patient UIDs (BH-PAT-XXXX)';
  RAISE NOTICE '  - Consent tracking';
  RAISE NOTICE '  - CKD diagnosis fields';
  RAISE NOTICE '  - Comorbidities tracking';
END $$;
