-- Check if token_number exists and is populated in local prescriptions
SELECT 
    id,
    token_number,
    created_at,
    status,
    patient_id
FROM hospital_prescriptions
ORDER BY created_at DESC
LIMIT 10;

-- Count prescriptions with vs without token numbers
SELECT 
    COUNT(*) as total_prescriptions,
    COUNT(token_number) as with_token_number,
    COUNT(*) - COUNT(token_number) as missing_token_number
FROM hospital_prescriptions;
