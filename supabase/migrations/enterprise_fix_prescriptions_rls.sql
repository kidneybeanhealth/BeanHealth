-- Refine RLS for prescriptions to ensure UPDATE works
DROP POLICY IF EXISTS "Hospitals view/manage own prescriptions" ON public.hospital_prescriptions;

-- Allow everything if hospital_id matches
CREATE POLICY "Enable full access for hospitals"
ON public.hospital_prescriptions FOR ALL
USING (auth.uid() = hospital_id);

-- Ensure user exists in users table (just in case)
INSERT INTO auth.users (id, email)
SELECT id, 'support@beanhealth.so'
FROM public.users
WHERE id = '9618d88d-9e52-4cc4-afee-387b1f295498'
ON CONFLICT (id) DO NOTHING;
