-- 1. Ensure the user profile exists and has the 'hospital' role
-- Note: The ID 'f97c94ac-891b-408d-ac04-fe100e3a371f' must match the User UID from Supabase Authentication.

INSERT INTO public.users (id, email, name, role)
VALUES (
  'f97c94ac-891b-408d-ac04-fe100e3a371f',
  'testing@beanhealth.in',
  'BeanHealth General Hospital', 
  'hospital'
)
ON CONFLICT (id) DO UPDATE
SET 
  role = 'hospital',
  name = 'BeanHealth General Hospital';

-- 2. Create the Hospital Entry linked to that User
INSERT INTO public.hospitals (
  user_id,
  name,
  email,
  phone,
  address,
  license_number,
  details_completed
)
VALUES (
  'f97c94ac-891b-408d-ac04-fe100e3a371f',
  'BeanHealth General Hospital',
  'testing@beanhealth.in',
  '+91 99999 88888',
  '123, Tech Park, Innovation City',
  'BH-TEST-2025',
  true
);
