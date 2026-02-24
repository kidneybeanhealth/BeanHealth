-- Add printer settings storage to hospital profiles
ALTER TABLE public.hospital_profiles 
ADD COLUMN IF NOT EXISTS printer_settings JSONB DEFAULT '{"spacing": 1, "alignment": "center"}'::jsonb;

-- Comment to explain usage
COMMENT ON COLUMN public.hospital_profiles.printer_settings IS 'Stores user-configurable printer layout settings like digit spacing and alignment.';
