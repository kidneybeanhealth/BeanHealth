-- DIAGNOSTIC QUERY: Find all versions of doctor_save_prescription_and_send
-- Run this FIRST to see what exists

SELECT 
    p.oid::regprocedure as full_signature,
    pg_get_function_arguments(p.oid) as arguments,
    p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'doctor_save_prescription_and_send'
  AND n.nspname = 'public';
