-- Query to retrieve all PA (Physician Assistant) login credentials
-- Note: Passcodes are hashed for security, so original passcodes cannot be retrieved
-- This query shows what information is available in the database

SELECT 
    a.id,
    a.assistant_name,
    a.assistant_code,
    a.passcode_hash,
    a.is_active,
    a.created_at,
    a.last_login_at,
    u.name as hospital_name,
    d.name as chief_doctor_name
FROM public.hospital_doctor_assistants a
LEFT JOIN public.users u ON a.hospital_id = u.id
LEFT JOIN public.hospital_doctors d ON a.chief_doctor_id = d.id
WHERE a.is_active = true
ORDER BY a.created_at DESC;

-- To get recently created PAs (last 30 days)
SELECT 
    a.id,
    a.assistant_name,
    a.assistant_code,
    a.passcode_hash,
    a.is_active,
    a.created_at,
    a.last_login_at,
    u.name as hospital_name,
    d.name as chief_doctor_name
FROM public.hospital_doctor_assistants a
LEFT JOIN public.users u ON a.hospital_id = u.id
LEFT JOIN public.hospital_doctors d ON a.chief_doctor_id = d.id
WHERE a.is_active = true
  AND a.created_at >= NOW() - INTERVAL '30 days'
ORDER BY a.created_at DESC;
