-- Recreate Reception Tables (v2)
-- Run this entire script to reset the tables.

-- 1. Explicitly drop the tables with CASCADE
DROP TABLE IF EXISTS public.hospital_queues CASCADE;
DROP TABLE IF EXISTS public.hospital_patients CASCADE;

-- 2. Verify and Create Hospital Patients
CREATE TABLE public.hospital_patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL, 
    name TEXT NOT NULL,
    age INTEGER,
    token_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT hospital_patients_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 3. Verify and Create Hospital Queues
CREATE TABLE public.hospital_queues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    doctor_id UUID,
    queue_number INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    -- Attribution columns (added for PA support)
    completed_by_actor_type TEXT NULL CHECK (completed_by_actor_type IN ('chief', 'assistant')),
    completed_by_assistant_id UUID NULL REFERENCES public.hospital_doctor_assistants(id) ON DELETE SET NULL,
    completed_by_name TEXT NULL,
    completed_actor_session_id UUID NULL REFERENCES public.hospital_doctor_actor_sessions(id) ON DELETE SET NULL,
    CONSTRAINT hospital_queues_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT hospital_queues_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    CONSTRAINT hospital_queues_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.hospital_doctors(id) ON DELETE SET NULL
);

-- 4. Enable RLS
ALTER TABLE public.hospital_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_queues ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Hospitals view/manage own patients" 
ON public.hospital_patients FOR ALL 
USING (auth.uid() = hospital_id)
WITH CHECK (auth.uid() = hospital_id);

CREATE POLICY "Hospitals view/manage own queues" 
ON public.hospital_queues FOR ALL 
USING (auth.uid() = hospital_id)
WITH CHECK (auth.uid() = hospital_id);
