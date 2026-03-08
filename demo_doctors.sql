-- Create Sample Doctors for Demo
-- Run this in Supabase SQL Editor

INSERT INTO public.hospital_doctors (hospital_id, name, specialty, access_code, is_active)
VALUES 
    ('9618d88d-9e52-4cc4-afee-387b1f295498', 'Sarah Williams', 'Cardiology', 'doc123', true),
    ('9618d88d-9e52-4cc4-afee-387b1f295498', 'Mike Johnson', 'General Medicine', 'doc456', true)
ON CONFLICT DO NOTHING;
