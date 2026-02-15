-- Migration: Prevent duplicate prescriptions for same queue visit
-- This addresses the race condition where two doctors could create
-- duplicate prescriptions if they click "Send to Pharmacy" simultaneously

-- Add unique constraint to ensure one prescription per queue visit
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_prescription_per_queue 
ON public.hospital_prescriptions(queue_id) 
WHERE queue_id IS NOT NULL AND status != 'cancelled';

-- Add comment for documentation
COMMENT ON INDEX idx_one_prescription_per_queue IS 
'Ensures idempotency: one active prescription per queue visit. Allows cancelled prescriptions to be recreated.';
