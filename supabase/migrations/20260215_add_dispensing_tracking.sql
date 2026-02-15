-- Add Dispensing Tracking Columns to hospital_prescriptions
-- This migration adds columns to track actual medication dispensing

-- Add new columns for dispensing tracking
ALTER TABLE public.hospital_prescriptions
ADD COLUMN IF NOT EXISTS dispensed_days INTEGER,
ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS dispensed_by TEXT;

-- Add index for querying dispensed prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_dispensed_at 
ON public.hospital_prescriptions(dispensed_at);

-- Add comment for documentation
COMMENT ON COLUMN public.hospital_prescriptions.dispensed_days IS 'Number of days of medication actually dispensed to patient';
COMMENT ON COLUMN public.hospital_prescriptions.dispensed_at IS 'Timestamp when medication was dispensed';
COMMENT ON COLUMN public.hospital_prescriptions.dispensed_by IS 'Staff member who dispensed the medication';
