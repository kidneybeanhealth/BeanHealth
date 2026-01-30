-- Run this SQL in your Supabase SQL Editor to create the missing diagnoses table

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.hospital_doctor_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.hospital_doctors(id) ON DELETE CASCADE,
    hospital_id UUID, -- Optional field for easier filtering
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique diagnosis names per doctor
    UNIQUE(doctor_id, name)
);

-- 2. Enable RLS
ALTER TABLE public.hospital_doctor_diagnoses ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy: Allow doctors (via their hospital login) to manage their diagnoses
DROP POLICY IF EXISTS "Doctors can manage their own diagnoses" ON public.hospital_doctor_diagnoses;
CREATE POLICY "Doctors can manage their own diagnoses"
ON public.hospital_doctor_diagnoses FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.hospital_doctors hd
        JOIN public.users u ON u.id = hd.hospital_id
        WHERE hd.id = hospital_doctor_diagnoses.doctor_id
        AND u.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.hospital_doctors hd
        JOIN public.users u ON u.id = hd.hospital_id
        WHERE hd.id = hospital_doctor_diagnoses.doctor_id
        AND u.id = auth.uid()
    )
);

-- 4. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hospital_doctor_diagnoses_doctor ON public.hospital_doctor_diagnoses(doctor_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctor_diagnoses_name ON public.hospital_doctor_diagnoses(doctor_id, name);
