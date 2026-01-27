-- Reception & Queue Management Schema

-- 1. Hospital Patients (Walk-ins)
CREATE TABLE IF NOT EXISTS public.hospital_patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER,
    token_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Hospital Queues
CREATE TABLE IF NOT EXISTS public.hospital_queues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    queue_number INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. RLS
ALTER TABLE public.hospital_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_queues ENABLE ROW LEVEL SECURITY;

-- Patients Policies
DROP POLICY IF EXISTS "Hospitals view/manage own patients" ON public.hospital_patients;
CREATE POLICY "Hospitals view/manage own patients" 
ON public.hospital_patients FOR ALL 
USING (auth.uid() = hospital_id);

-- Queue Policies
DROP POLICY IF EXISTS "Hospitals view/manage own queues" ON public.hospital_queues;
CREATE POLICY "Hospitals view/manage own queues" 
ON public.hospital_queues FOR ALL 
USING (auth.uid() = hospital_id);
