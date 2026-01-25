-- Prescriptions Table Setup for BeanHealth
-- This file creates the prescriptions table and sets up RLS policies

-- Create prescriptions table
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doctor_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Medications stored as JSONB array
  -- Each medication: { name, dosage, frequency, duration, instructions, timing }
  medications JSONB NOT NULL,
  
  -- Additional prescription notes
  notes TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON public.prescriptions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Doctors can insert prescriptions for their patients
CREATE POLICY "Doctors can insert prescriptions for their patients"
ON public.prescriptions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patient_doctor_relationships pdr
    WHERE pdr.doctor_id = auth.uid()
    AND pdr.patient_id = prescriptions.patient_id
  )
  AND doctor_id = auth.uid()
);

-- RLS Policy: Doctors can view prescriptions they created
CREATE POLICY "Doctors can view their own prescriptions"
ON public.prescriptions
FOR SELECT
USING (doctor_id = auth.uid());

-- RLS Policy: Patients can view prescriptions created for them
CREATE POLICY "Patients can view their prescriptions"
ON public.prescriptions
FOR SELECT
USING (patient_id = auth.uid());

-- RLS Policy: Doctors can update their own prescriptions
CREATE POLICY "Doctors can update their prescriptions"
ON public.prescriptions
FOR UPDATE
USING (doctor_id = auth.uid())
WITH CHECK (doctor_id = auth.uid());

-- RLS Policy: Doctors can delete their own prescriptions
CREATE POLICY "Doctors can delete their prescriptions"
ON public.prescriptions
FOR DELETE
USING (doctor_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_prescriptions_updated_at
BEFORE UPDATE ON public.prescriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;

-- Sample query to verify setup (uncomment to test)
-- SELECT * FROM public.prescriptions LIMIT 5;
