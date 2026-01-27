-- Hospital Doctors Setup
-- Run this in Supabase SQL Editor

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.hospital_doctors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT,
    access_code TEXT NOT NULL, -- Ideally hashed in production, plain for now as requested
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable Security
ALTER TABLE public.hospital_doctors ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow Enterprise to manage ONLY their own doctors
DROP POLICY IF EXISTS "Hospitals can manage their own doctors" ON public.hospital_doctors;
CREATE POLICY "Hospitals can manage their own doctors" 
ON public.hospital_doctors FOR ALL 
USING (auth.uid() = hospital_id);

-- 4. Seed Data (So you have something to click on)
-- We use your known Enterprise ID: 9618d88d-9e52-4cc4-afee-387b1f295498
INSERT INTO public.hospital_doctors (hospital_id, name, specialty, access_code)
VALUES 
  ('9618d88d-9e52-4cc4-afee-387b1f295498', 'Dr. Sarah Wilson', 'Cardiologist', 'doc1'),
  ('9618d88d-9e52-4cc4-afee-387b1f295498', 'Dr. James Chen', 'Pediatrician', 'doc2'),
  ('9618d88d-9e52-4cc4-afee-387b1f295498', 'Dr. Emily Ross', 'General Physician', 'doc3');
