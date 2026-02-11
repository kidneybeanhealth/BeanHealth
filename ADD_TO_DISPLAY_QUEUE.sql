-- ====================================================================
-- ADD TODAY'S PENDING PRESCRIPTIONS TO DISPLAY QUEUE
-- ====================================================================
-- This adds all pending prescriptions to the pharmacy display queue
-- ====================================================================

-- First, clear old stuck entries from display
UPDATE public.hospital_pharmacy_queue 
SET status = 'dispensed'
WHERE status IN ('waiting', 'calling');

-- Add all today's pending prescriptions to the display queue
INSERT INTO public.hospital_pharmacy_queue (hospital_id, prescription_id, patient_name, token_number, status, created_at)
SELECT 
    p.hospital_id,
    p.id as prescription_id,
    pt.name as patient_name,
    p.token_number,
    'waiting' as status,
    p.created_at
FROM public.hospital_prescriptions p
JOIN public.hospital_patients pt ON p.patient_id = pt.id
WHERE p.status = 'pending'
  AND p.created_at >= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM public.hospital_pharmacy_queue q 
    WHERE q.prescription_id = p.id 
    AND q.status IN ('waiting', 'calling')
  );

-- Verify: Show current display queue
SELECT 
    token_number,
    patient_name,
    status,
    created_at
FROM public.hospital_pharmacy_queue
WHERE status IN ('waiting', 'calling')
ORDER BY token_number::int ASC;

-- ====================================================================
-- Result: Display queue now shows all pending prescriptions from today
-- ====================================================================
