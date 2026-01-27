-- Deletes the specific clinic to allow re-registration
-- This will Trigger 'ON DELETE SET NULL' for users and 'ON DELETE CASCADE' for relationships
DELETE FROM public.clinics WHERE name ILIKE 'Kongunad Kidney Center%';

-- Optional: If you want to delete ALL clinics to be absolutely sure (Uncomment to use)
-- DELETE FROM public.clinics;
