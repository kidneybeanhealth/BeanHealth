-- Create Prescriptions Table
CREATE TABLE IF NOT EXISTS public.hospital_prescriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    queue_id UUID REFERENCES public.hospital_queues(id) ON DELETE SET NULL,
    medications JSONB NOT NULL DEFAULT '[]', -- Array of { name, dosage, frequency, duration, instruction }
    notes TEXT,
    token_number TEXT, -- Snapshot of token number for easy display
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_hospital ON public.hospital_prescriptions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON public.hospital_prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.hospital_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_queue_id ON public.hospital_prescriptions(queue_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON public.hospital_prescriptions(status);
