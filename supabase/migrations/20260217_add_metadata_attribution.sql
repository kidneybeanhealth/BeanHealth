-- Migration: Add metadata column to hospital_prescriptions for attribution
ALTER TABLE public.hospital_prescriptions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_hospital_prescriptions_metadata ON public.hospital_prescriptions USING gin (metadata);

-- IMPORTANT: If you are using PA features, the RPC 'doctor_save_prescription_and_send' 
-- also needs to be updated to accept and save the 'p_metadata' parameter.
-- Please run the updated RPC script if provided.
