-- Hospital Doctor Drugs - Per-doctor saved drug names
-- Each doctor can save their commonly prescribed drug names for quick selection

CREATE TABLE IF NOT EXISTS public.hospital_doctor_drugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.hospital_doctors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique drug names per doctor
    UNIQUE(doctor_id, name)
);

-- Enable RLS
ALTER TABLE public.hospital_doctor_drugs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow doctors to manage their own drugs
-- Since hospital_doctors don't have auth, we allow access based on hospital_id from hospital_doctors
DROP POLICY IF EXISTS "Doctors can manage their own drugs" ON public.hospital_doctor_drugs;
CREATE POLICY "Doctors can manage their own drugs"
ON public.hospital_doctor_drugs FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.hospital_doctors hd
        JOIN public.users u ON u.id = hd.hospital_id
        WHERE hd.id = hospital_doctor_drugs.doctor_id
        AND u.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.hospital_doctors hd
        JOIN public.users u ON u.id = hd.hospital_id
        WHERE hd.id = hospital_doctor_drugs.doctor_id
        AND u.id = auth.uid()
    )
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hospital_doctor_drugs_doctor ON public.hospital_doctor_drugs(doctor_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctor_drugs_name ON public.hospital_doctor_drugs(doctor_id, name);

-- Sample data (optional - uncomment to add default drugs for testing)
-- INSERT INTO public.hospital_doctor_drugs (doctor_id, name, default_number, default_morning, default_noon, default_night, default_before_food)
-- SELECT id, 'PARACETAMOL 500MG', '1', true, false, true, false FROM public.hospital_doctors LIMIT 1;
