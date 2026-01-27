-- Recreate Prescriptions Table to ensure schema is correct
DROP TABLE IF EXISTS public.hospital_prescriptions CASCADE;

CREATE TABLE public.hospital_prescriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    medications JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    token_number TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE public.hospital_prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospitals view/manage own prescriptions" 
ON public.hospital_prescriptions FOR ALL 
USING (auth.uid() = hospital_id)
WITH CHECK (auth.uid() = hospital_id);

-- Indexes
CREATE INDEX idx_prescriptions_hospital ON public.hospital_prescriptions(hospital_id);
CREATE INDEX idx_prescriptions_status ON public.hospital_prescriptions(status);
