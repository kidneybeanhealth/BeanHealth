-- Ensure the Enterprise User exists in public.users to satisfy Foreign Key
-- ID: 9618d88d-9e52-4cc4-afee-387b1f295498

INSERT INTO public.users (id, email, name, role)
VALUES (
    '9618d88d-9e52-4cc4-afee-387b1f295498',
    'chitti@beanhealth.com',
    'BeanHealth Hospital',
    'enterprise'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'enterprise'; -- Ensure role is correct

-- Also verify the id exists
SELECT * FROM public.users WHERE id = '9618d88d-9e52-4cc4-afee-387b1f295498';
