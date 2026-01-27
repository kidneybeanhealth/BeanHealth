-- Fix RLS Policies for Insert
-- We need WITH CHECK for INSERT operations to work correctly

-- 1. Patients
DROP POLICY IF EXISTS "Hospitals view/manage own patients" ON public.hospital_patients;
CREATE POLICY "Hospitals view/manage own patients" 
ON public.hospital_patients FOR ALL 
USING (auth.uid() = hospital_id)
WITH CHECK (auth.uid() = hospital_id);

-- 2. Queues
DROP POLICY IF EXISTS "Hospitals view/manage own queues" ON public.hospital_queues;
CREATE POLICY "Hospitals view/manage own queues" 
ON public.hospital_queues FOR ALL 
USING (auth.uid() = hospital_id)
WITH CHECK (auth.uid() = hospital_id);
