-- 1. Create a Doctor User linked to the Hospital
-- UUID: 32d2502d-762c-4c44-b02f-ad3eaa89e1a0
-- Name: Dr. Dhoni

INSERT INTO public.users (id, email, name, role, specialty, hospital_id)
VALUES (
  '32d2502d-762c-4c44-b02f-ad3eaa89e1a0',
  'dhoni@beanhealth.in', -- Assuming email based on name, or strictly linking the existing auth user
  'Dr. Dhoni',
  'doctor',
  'Sports Medicine',
  (SELECT id FROM public.hospitals WHERE email = 'testing@beanhealth.in' LIMIT 1)
)
ON CONFLICT (id) DO UPDATE
SET 
  role = 'doctor',
  name = 'Dr. Dhoni',
  specialty = 'Sports Medicine',
  hospital_id = (SELECT id FROM public.hospitals WHERE email = 'testing@beanhealth.in' LIMIT 1);
