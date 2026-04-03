-- Add a features JSONB column for flexible feature flagging per hospital
ALTER TABLE public.hospital_profiles
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"capture_phone": true}'::jsonb;

-- Describe the column for documenting purpose
COMMENT ON COLUMN public.hospital_profiles.features IS 'Stores boolean feature flags for customizing the hospital dashboard experience (e.g. {"capture_phone": true}).';
