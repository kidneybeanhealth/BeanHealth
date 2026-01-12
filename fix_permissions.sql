-- Re-apply RLS policies for Hospital tables to ensure write access is enabled
-- Run this in Supabase SQL Editor

-- 1. Enable RLS (idempotent)
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_queues ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Hospitals can view own record" ON public.hospitals;
DROP POLICY IF EXISTS "Hospitals can update own record" ON public.hospitals;
DROP POLICY IF EXISTS "View hospital patients" ON public.hospital_patients;
DROP POLICY IF EXISTS "Manage hospital patients" ON public.hospital_patients;
DROP POLICY IF EXISTS "View hospital queues" ON public.hospital_queues;
DROP POLICY IF EXISTS "Manage hospital queues" ON public.hospital_queues;

-- 3. Re-create Policies

-- Hospital Profile Access
CREATE POLICY "Hospitals can view own record" ON public.hospitals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Hospitals can update own record" ON public.hospitals
  FOR UPDATE USING (auth.uid() = user_id);

-- Patient Access: Hospitals (Owners) can do EVERYTHING (Insert, Update, Select, Delete)
CREATE POLICY "Manage hospital patients" ON public.hospital_patients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = hospital_id AND h.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.hospital_id = hospital_patients.hospital_id)
  );

-- Queue Access: Hospitals (Owners) can do EVERYTHING
CREATE POLICY "Manage hospital queues" ON public.hospital_queues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = hospital_id AND h.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.hospital_id = hospital_queues.hospital_id)
  );
